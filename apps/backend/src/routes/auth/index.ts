import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/authGuard';
import { redis } from '../../redis';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Account is deactivated' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    reply.setCookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return {
      id: user.id,
      email: user.email,
      callsign: user.callsign,
      role: user.role,
      cohort_id: user.cohort_id,
      must_change_password: user.must_change_password,
    };
  });

  // POST /api/auth/logout
  app.post('/logout', { preHandler: authGuard }, async (request, reply) => {
    const token = request.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.decode(token) as { exp?: number } | null;
        if (decoded?.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await redis.set(`blacklist:${token}`, '1', 'EX', ttl);
          }
        }
      } catch {
        // ignore decode errors — still clear the cookie
      }
    }
    reply.clearCookie('token', { path: '/' });
    return { success: true };
  });

  // POST /api/auth/change-password
  app.post('/change-password', { preHandler: authGuard }, async (request, reply) => {
    const { new_password, old_password } = request.body as {
      new_password: string;
      old_password?: string;
    };

    if (!new_password || new_password.length < 8 || !/\d/.test(new_password)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Password must be at least 8 characters and contain at least one number',
      });
    }

    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user) return reply.status(404).send({ error: 'Not Found' });

    // If not forced change — require old password
    if (!user.must_change_password) {
      if (!old_password) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Old password required' });
      }
      const valid = await bcrypt.compare(old_password, user.password_hash);
      if (!valid) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Old password is incorrect' });
      }
    }

    const hash = await bcrypt.hash(new_password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: hash, must_change_password: false },
    });

    return { success: true };
  });

  // GET /api/auth/me
  app.get('/me', { preHandler: authGuard }, async (request) => {
    return request.user;
  });
}
