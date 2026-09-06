import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { config } from '../config/env';

export function createNewRedisClient(): any {
  try {
    const client = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop reconnecting
        return 1000;
      },
    });

    // Handle error events so Node doesn't crash on ECONNREFUSED
    client.on('error', (err) => {
      console.warn('[Redis] Connection warning:', err.message);
    });

    return client;
  } catch {
    console.warn('[Redis] Using in-memory Redis fallback.');
    return new RedisMock();
  }
}
