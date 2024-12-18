import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Helper function to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to ensure clean Docker environment
async function cleanupDocker(projectName?: string) {
  try {
    if (projectName) {
      // Stop and remove containers for specific project
      await execAsync(`docker compose --project-name ${projectName} down --volumes --remove-orphans`, { cwd: process.cwd() });
      await wait(2000);
    }

    await execAsync('docker network prune -f', { cwd: process.cwd() });
    await wait(2000);

    const { stdout: networks } = await execAsync('docker network ls');
    console.log('Current networks:', networks);
  } catch (error) {
    console.log('Cleanup error (non-fatal):', error);
    await wait(3000);
  }
}

// Helper function to initialize database schema
async function initializeDatabase(projectName: string) {
  try {
    const { stdout: containerId } = await execAsync(`docker compose --project-name ${projectName} ps -q clickhouse`);
    if (!containerId.trim()) {
      throw new Error('Container not found');
    }

    // Create database
    console.log('Creating database...');
    await execAsync(`docker exec ${containerId.trim()} clickhouse-client --query "CREATE DATABASE IF NOT EXISTS test_db"`);

    // Read and execute schema files
    const schemaDir = path.join(process.cwd(), 'schema');
    const schemaFiles = fs.readdirSync(schemaDir).sort();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clickhouse-schema-'));

    try {
      for (const file of schemaFiles) {
        if (file.endsWith('.sql')) {
          console.log(`Executing schema file: ${file}`);
          const schema = fs.readFileSync(path.join(schemaDir, file), 'utf8');
          const tempFile = path.join(tempDir, file);
          fs.writeFileSync(tempFile, schema);

          // Copy schema file to container and execute
          await execAsync(`docker cp ${tempFile} ${containerId.trim()}:/tmp/${file}`);
          await execAsync(`docker exec ${containerId.trim()} clickhouse-client --database test_db --queries-file /tmp/${file}`);
        }
      }
    } finally {
      // Cleanup temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log('Database initialization completed');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Store project name in a file for cleanup
const PROJECT_NAME_FILE = '/tmp/clickhouse-test-project-name';

export async function setup() {
  const projectName = `test-${Date.now()}`;
  console.log(`Starting global test setup with project name: ${projectName}`);

  // Save project name for cleanup
  fs.writeFileSync(PROJECT_NAME_FILE, projectName);

  try {
    await cleanupDocker(projectName);

    // Start container with environment variables
    console.log('Starting ClickHouse container...');
    await execAsync('docker compose up -d --force-recreate --renew-anon-volumes --remove-orphans', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        COMPOSE_PROJECT_NAME: projectName,
        DOCKER_DEFAULT_PLATFORM: 'linux/amd64'
      }
    });

    // Wait for container health
    let isHealthy = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!isHealthy && attempts < maxAttempts) {
      try {
        await wait(2000);

        const { stdout: containerId } = await execAsync(`docker compose --project-name ${projectName} ps -q clickhouse`);
        if (!containerId.trim()) {
          console.log('Container not found, waiting...');
          attempts++;
          continue;
        }

        const { stdout: status } = await execAsync(`docker inspect --format='{{.State.Health.Status}}' ${containerId.trim()}`);
        console.log(`Container health status: ${status.trim()}`);

        if (status.trim() === 'healthy') {
          isHealthy = true;
          console.log('Container is healthy!');
          // Initialize database after container is healthy
          await initializeDatabase(projectName);
          await wait(3000);
        } else {
          console.log(`Waiting for container to be healthy (attempt ${attempts + 1}/${maxAttempts})...`);
          attempts++;
        }
      } catch (error) {
        console.error('Error checking container health:', error);
        attempts++;
        await wait(3000);
      }
    }

    if (!isHealthy) {
      throw new Error('ClickHouse container failed to become healthy');
    }
  } catch (error) {
    console.error('Error in global setup:', error);
    await cleanupDocker(projectName);
    throw error;
  }
}

export async function teardown() {
  try {
    // Get project name from file
    const projectName = fs.readFileSync(PROJECT_NAME_FILE, 'utf8').trim();
    console.log(`Global teardown: cleaning up project ${projectName}`);
    await cleanupDocker(projectName);
    fs.unlinkSync(PROJECT_NAME_FILE);
  } catch (error) {
    console.error('Error in global teardown:', error);
  }
}
