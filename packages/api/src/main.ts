import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import pinoHttp from 'pino-http';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/router.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    pinoHttp({
      transport: { target: 'pino-pretty' },
    }),
  );

  app.getHttpAdapter().get('/health', (_req: unknown, res: { json: (body: object) => void }) => {
    res.json({ status: 'ok' });
  });

  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: () => ({}),
    }),
  );

  await app.listen(3001);
}

bootstrap();
