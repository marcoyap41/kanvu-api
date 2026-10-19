import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser'
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
  });
  // Render (and most hosts) sit behind one proxy: trust it so req.ip is the client's IP, used by the email rate limits
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.enableCors({origin: process.env.FRONTEND_URL, credentials: true});
  app.useGlobalPipes(new ValidationPipe({whitelist:true}))
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
