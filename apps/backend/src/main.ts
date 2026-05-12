import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './events/redis-io.adapter';

// ── ANSI colors for startup banner (dev-friendly) ─────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function ok(label: string, detail = '') {
  console.log(
    `${c.green}  ✔${c.reset}  ${c.bold}${label}${c.reset}${detail ? `  ${c.gray}${detail}${c.reset}` : ''}`,
  );
}
function warn(label: string, detail = '') {
  console.log(
    `${c.yellow}  ⚠${c.reset}  ${c.bold}${label}${c.reset}${detail ? `  ${c.gray}${detail}${c.reset}` : ''}`,
  );
}
function fail(label: string, detail = '') {
  console.log(
    `${c.red}  ✘${c.reset}  ${c.bold}${label}${c.reset}${detail ? `  ${c.gray}${detail}${c.reset}` : ''}`,
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ── Structured JSON logging via Pino ──────────────────────────────────
  app.useLogger(app.get(Logger));

  // ── Print startup banner ──────────────────────────────────────────────
  const port = process.env.PORT ?? 4000;
  const env = process.env.NODE_ENV ?? 'development';
  const dbUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL ?? process.env.REDIS_CLUSTER_NODES;

  console.log('');
  console.log(
    `${c.cyan}${c.bold}  ⚡ Apio — Backend Starting${c.reset}  ${c.gray}(${env})${c.reset}`,
  );
  console.log(`${c.gray}  ─────────────────────────────────────────${c.reset}`);

  // ── 1. Database check ─────────────────────────────────────────────────
  if (!dbUrl) {
    fail('MongoDB', 'DATABASE_URL is not set — database will not connect');
    fail('Prisma', 'Cannot initialize Prisma without DATABASE_URL');
  } else {
    ok('MongoDB', dbUrl.replace(/:([^@]+)@/, ':***@')); // hide password
    ok('Prisma', 'Client ready');
  }

  // ── 2. Redis check ────────────────────────────────────────────────────
  if (!redisUrl) {
    warn(
      'Redis',
      'REDIS_URL not set — caching and BullMQ queue disabled, WebSocket pub/sub disabled',
    );
  } else {
    ok('Redis', redisUrl.replace(/:([^@]+)@/, ':***@'));
  }

  // ── 3. Socket.io Redis adapter (multi-instance WS sync) ───────────────
  //    Must be set BEFORE app.listen() so createIOServer picks it up.
  try {
    const redisAdapter = new RedisIoAdapter(app);
    await redisAdapter.connectToRedis(
      process.env.REDIS_URL,
      process.env.REDIS_CLUSTER_NODES,
    );
    app.useWebSocketAdapter(redisAdapter);
    if (redisUrl) {
      ok('WebSocket', 'Socket.io Redis adapter connected');
    } else {
      warn(
        'WebSocket',
        'Socket.io running in single-node mode (no Redis adapter)',
      );
    }
  } catch (err: any) {
    warn(
      'WebSocket',
      `Redis adapter failed — falling back to in-memory: ${err?.message}`,
    );
  }

  // ── 4. BullMQ Queue ───────────────────────────────────────────────────
  if (!redisUrl) {
    warn(
      'BullMQ',
      'Queue disabled — no Redis connection. Ingest jobs will fail.',
    );
  } else {
    ok('BullMQ', 'Queue registered (ingest_queue)');
  }

  // ── 5. JWT secrets ────────────────────────────────────────────────────
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    fail(
      'JWT',
      'JWT_SECRET or JWT_REFRESH_SECRET not set — authentication will fail',
    );
  } else {
    ok('JWT', 'Secrets loaded');
  }

  // ── 6. BetterAuth secret ──────────────────────────────────────────────
  if (!process.env.BETTER_AUTH_SECRET) {
    fail(
      'BetterAuth',
      'BETTER_AUTH_SECRET not set — sessions can be forged! Set a strong secret in .env',
    );
    if (process.env.NODE_ENV === 'production') {
      console.error('\n  ✘ FATAL: BETTER_AUTH_SECRET is required in production. Exiting.\n');
      process.exit(1);
    }
  } else {
    ok('BetterAuth', 'Secret loaded');
  }

  // ── 7. JWT secrets (hard exit in production) ─────────────────────────
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('\n  ✘ FATAL: JWT_SECRET and JWT_REFRESH_SECRET are required in production. Exiting.\n');
      process.exit(1);
    }
  }

  console.log(`${c.gray}  ─────────────────────────────────────────${c.reset}`);

  // ── Security headers ──────────────────────────────────────────────────
  app.use(
    helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
  );

  // ── Gzip compression ──────────────────────────────────────────────────
  app.use(compression());

  // ── Global validation ─────────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ── CORS ──────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [
      // ── Local dev: one origin per app ──────────────────────────────────
      'http://localhost:3000', // apps/web   (dashboard)
      'http://localhost:3001', // apps/auth  (auth)
      'http://localhost:3002', // apps/docs  (docs)
      'http://localhost:3003', // apps/admin (admin)
      // ── Env-override for production/staging ────────────────────────────
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      process.env.AUTH_URL ?? 'http://localhost:3001',
      process.env.DOCS_URL ?? 'http://localhost:3002',
      process.env.ADMIN_URL ?? 'http://localhost:3003',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // /health excluded from prefix so NGINX can probe it without auth
  // /install.ps1 and /install.sh served at root for piping: iwr http://host:4000/install.ps1 | iex
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'install.ps1', 'install.sh'],
  });

  await app.listen(port);

  // ── Final ready banner ────────────────────────────────────────────────
  console.log('');
  console.log(
    `${c.green}${c.bold}  🚀 Backend ready on http://localhost:${port}${c.reset}`,
  );
  console.log(`${c.gray}  Health:   http://localhost:${port}/health${c.reset}`);
  console.log(`${c.gray}  API:      http://localhost:${port}/api/v1${c.reset}`);
  console.log(`${c.gray}  Socket:   ws://localhost:${port}${c.reset}`);
  console.log('');
}

bootstrap().catch((err) => {
  console.error(
    `\n${c.red}${c.bold}  ✘ Fatal startup error:${c.reset}`,
    err?.message ?? err,
  );
  console.error(
    `${c.gray}  Check your .env file — DATABASE_URL, REDIS_URL, JWT_SECRET${c.reset}\n`,
  );
  process.exit(1);
});
