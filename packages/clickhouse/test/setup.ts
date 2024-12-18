import { beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

beforeAll(async () => {
  // Ensure container is running and healthy
  try {
    console.log('Starting ClickHouse container...');
    await execAsync('docker compose up -d', { cwd: process.cwd() });

    // Wait for container to be healthy
    let isHealthy = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!isHealthy && attempts < maxAttempts) {
      try {
        // Get container ID first
        const { stdout: containerId } = await execAsync('docker compose ps -q clickhouse');
        if (!containerId.trim()) {
          console.log('Container not found, waiting...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
          continue;
        }

        // Check container health status
        const { stdout: status } = await execAsync(`docker inspect --format='{{.State.Health.Status}}' ${containerId.trim()}`);
        console.log(`Container health status: ${status.trim()}`);

        if (status.trim() === 'healthy') {
          isHealthy = true;
        } else {
          // Get container logs for debugging
          const { stdout: logs } = await execAsync(`docker logs ${containerId.trim()}`);
          console.log('Container logs:', logs);
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      } catch (error) {
        console.error('Error checking container health:', error);
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
