import { beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

beforeAll(async () => {
  // Ensure container is running and healthy
  try {
    await execAsync('docker compose up -d', { cwd: process.cwd() });

    // Wait for container to be healthy
    let isHealthy = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!isHealthy && attempts < maxAttempts) {
      try {
        const { stdout } = await execAsync('docker compose ps --format json');
        const containers = JSON.parse(`[${stdout.trim().split('\n').join(',')}]`);
        const clickhouse = containers.find((c: any) => c.Service === 'clickhouse');

        if (clickhouse && clickhouse.Health === 'healthy') {
          isHealthy = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }

    if (!isHealthy) {
      throw new Error('ClickHouse container failed to become healthy');
    }
  } catch (error) {
    console.error('Error setting up test environment:', error);
    throw error;
  }
}, 60000);

afterAll(async () => {
  // Clean up containers after tests
  try {
    await execAsync('docker compose down -v', { cwd: process.cwd() });
  } catch (error) {
    console.error('Error cleaning up test environment:', error);
    throw error;
  }
}, 30000);
