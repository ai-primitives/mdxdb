import { beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper function to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to ensure clean Docker environment
async function cleanupDocker() {
  try {
    await execAsync('docker compose down --volumes --remove-orphans', { cwd: process.cwd() });
    await wait(1000); // Wait for resources to be released
    await execAsync('docker network prune -f', { cwd: process.cwd() });
    await wait(1000); // Wait for network cleanup
  } catch (error) {
    console.log('Cleanup error (non-fatal):', error);
    await wait(2000); // Wait longer if there was an error
  }
}

beforeAll(async () => {
  // Ensure container is running and healthy
  try {
    console.log('Starting ClickHouse container...');

    // Clean up any existing resources first
    await cleanupDocker();

    // Generate a unique project name
    const projectName = `test-${Date.now()}`;
    console.log(`Using project name: ${projectName}`);

    // Start the container with fresh network
    const startCommand = 'docker compose up -d --force-recreate --renew-anon-volumes --remove-orphans';
    console.log(`Running command: ${startCommand}`);

    await execAsync(startCommand, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        COMPOSE_PROJECT_NAME: projectName
      }
    });

    // Wait for container to be healthy
    let isHealthy = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!isHealthy && attempts < maxAttempts) {
      try {
        await wait(1000); // Wait between health checks

        // Get container ID first
        const { stdout: containerId } = await execAsync(`docker compose ps -q clickhouse`);
        if (!containerId.trim()) {
          console.log('Container not found, waiting...');
          attempts++;
          continue;
        }

        // Check container health status
        const { stdout: status } = await execAsync(`docker inspect --format='{{.State.Health.Status}}' ${containerId.trim()}`);
        console.log(`Container health status: ${status.trim()}`);

        if (status.trim() === 'healthy') {
          isHealthy = true;
          console.log('Container is healthy!');
          await wait(2000); // Wait a bit after container is healthy
        } else {
          console.log(`Waiting for container to be healthy (attempt ${attempts + 1}/${maxAttempts})...`);
          attempts++;
        }
      } catch (error) {
        console.error('Error checking container health:', error);
        attempts++;
        await wait(2000); // Wait longer on error
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
  // Clean up containers and networks after tests
  await cleanupDocker();
}, 30000);
