import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

export interface JwtPayload {
  userId: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      callsign: string;
      role: string;
      cohort_id: string | null;
      must_change_password: boolean;
    };
  }
}

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies?.token;

  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Not authenticated' });
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as JwtPayload;
  } catch {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token' });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      callsign: true,
      role: true,
      cohort_id: true,
      must_change_password: true,
      is_active: true,
    },
  });

  if (!user || !user.is_active) {
    reply.clearCookie('token');
    return reply.status(401).send({ error: 'Unauthorized', message: 'Account inactive or not found' });
  }

  request.user = {
    id: user.id,
    email: user.email,
    callsign: user.callsign,
    role: user.role,
    cohort_id: user.cohort_id,
    must_change_password: user.must_change_password,
  };
}

export function roleGuard(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authGuard(request, reply);
    if (reply.sent) return;

    if (!request.user || !roles.includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
    }
  };
}
