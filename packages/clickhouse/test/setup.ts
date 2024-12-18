import { beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper function to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to ensure clean Docker environment
async function cleanupDocker(projectName?: string) {
  try {
    if (projectName) {
      // Stop and remove containers for specific project
      await execAsync(`docker compose --project-name ${projectName} down --volumes --remove-orphans`, { cwd: process.cwd() });
      await wait(2000); // Wait longer for resources to be released
    }

    // Remove all unused networks
    await execAsync('docker network prune -f', { cwd: process.cwd() });
    await wait(2000);

    // List remaining networks for debugging
    const { stdout: networks } = await execAsync('docker network ls');
    console.log('Current networks:', networks);
  } catch (error) {
    console.log('Cleanup error (non-fatal):', error);
    await wait(3000); // Wait even longer if there was an error
  }
}

// Generate a unique project name
const projectName = `test-${Date.now()}`;

beforeAll(async () => {
  console.log(`Starting test setup with project name: ${projectName}`);

  try {
    // Clean up any existing resources first
    await cleanupDocker(projectName);

    // Create network explicitly first
    const networkName = `${projectName}_default`;
    console.log(`Creating network: ${networkName}`);
    try {
      await execAsync(`docker network create ${networkName}`);
      await wait(2000); // Wait for network creation
    } catch (error) {
      console.log('Network creation error (attempting to continue):', error);
    }

    // Start the container with explicit network
    console.log('Starting ClickHouse container...');
    await execAsync('docker compose up -d --force-recreate --renew-anon-volumes --remove-orphans', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        COMPOSE_PROJECT_NAME: projectName,
        DOCKER_DEFAULT_PLATFORM: 'linux/amd64' // Ensure consistent platform
      }
    });

    // Wait for container to be healthy
    let isHealthy = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!isHealthy && attempts < maxAttempts) {
      try {
        await wait(2000); // Longer wait between health checks

        // Get container ID first
        const { stdout: containerId } = await execAsync(`docker compose --project-name ${projectName} ps -q clickhouse`);
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
          await wait(3000); // Wait longer after container is healthy
        } else {
          console.log(`Waiting for container to be healthy (attempt ${attempts + 1}/${maxAttempts})...`);
          attempts++;
        }
      } catch (error) {
        console.error('Error checking container health:', error);
        attempts++;
        await wait(3000); // Wait longer on error
      }
    }

    if (!isHealthy) {
      throw new Error('ClickHouse container failed to become healthy');
    }
  } catch (error) {
    console.error('Error setting up test environment:', error);
    // Attempt cleanup on error
    await cleanupDocker(projectName);
    throw error;
  }
}, 60000);

afterAll(async () => {
  // Clean up containers and networks
  await cleanupDocker(projectName);
}, 30000);
