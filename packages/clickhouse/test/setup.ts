import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export async function setup() {
  // Initialize database and tables before running tests
  try {
    const initScript = join(__dirname, '../docker/init-db.sh')
    execSync(`chmod +x ${initScript}`)
    execSync(`bash ${initScript}`)
  } catch (error) {
    console.error('Failed to initialize database:', error)
    process.exit(1)
  }
}
