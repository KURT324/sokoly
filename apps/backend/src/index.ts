import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from './db';
import { authRoutes } from './routes/auth';
import { adminUsersRoutes } from './routes/admin/users';
import { adminCohortsRoutes } from './routes/admin/cohorts';
import { daysRoutes } from './routes/days';
import { testsRoutes } from './routes/tests';
import { cohortsRoutes } from './routes/cohorts';
import { cardTasksRoutes } from './routes/card-tasks';
import { cardFoldersRoutes } from './routes/card-folders';
import { analyticsRoutes } from './routes/analytics';
import { chatsRoutes } from './routes/chats';
import { setupSocket } from './socket';

// BigInt is not JSON-serializable by default; Prisma returns BigInt for some aggregate fields
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

const app = Fastify({ logger: true, bodyLimit: 510 * 1024 * 1024 });

// Support multiple comma-separated origins: FRONTEND_URL=https://sokolbla.ru,https://www.sokolbla.ru
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(s => s.trim());

export const io = new SocketIOServer(app.server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

setupSocket(io);

async function bootstrap() {
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await app.register(fastifyCors, {
    origin: allowedOrigins,
    credentials: true,
  });
  await app.register(fastifyCookie, {
    secret: process.env.JWT_SECRET || 'secret',
  });
  await app.register(fastifyMultipart, {
    limits: { fileSize: 500 * 1024 * 1024 },
  });
  await app.register(fastifyRateLimit, {
    global: false,
    max: 100,
    timeWindow: '1 minute',
  });

  // Health checks
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/health/db', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'connected' };
  });

  // API routes
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(adminUsersRoutes, { prefix: '/api/admin/users' });
  app.register(adminCohortsRoutes, { prefix: '/api/admin/cohorts' });
  app.register(daysRoutes, { prefix: '/api/days' });
  app.register(testsRoutes, { prefix: '/api/tests' });
  app.register(cohortsRoutes, { prefix: '/api/cohorts' });
  app.register(cardTasksRoutes, { prefix: '/api/card-tasks' });
  app.register(cardFoldersRoutes, { prefix: '/api/card-folders' });
  app.register(analyticsRoutes, { prefix: '/api/analytics' });
  app.register(chatsRoutes, { prefix: '/api/chats' });

  await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
