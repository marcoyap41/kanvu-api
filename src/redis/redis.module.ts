import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

// Injection token: @Inject(REDIS) private redis: Redis
export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // e.g. redis://localhost:6379, or rediss://default:<password>@<host>:6379 for Upstash / Render Key Value
        const client = new Redis(config.getOrThrow<string>('REDIS_URL'), { maxRetriesPerRequest: 3 });
        const log = new Logger('Redis');
        client.on('error', (e) => log.error(e.message));
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    await this.redis.quit();
  }
}

