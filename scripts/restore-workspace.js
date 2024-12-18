import fs from 'fs'
import path from 'path'

async function restoreWorkspaceDependencies() {
  const packagesDir = path.join(process.cwd(), 'packages')
  const packages = await fs.promises.readdir(packagesDir)

  for (const pkg of packages) {
    const pkgPath = path.join(packagesDir, pkg, 'package.json')
    try {
      const content = await fs.promises.readFile(pkgPath, 'utf8')
      const pkgJson = JSON.parse(content)
      let modified = false

      // Restore workspace dependencies
      for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
        if (!pkgJson[depType]) continue

        for (const [name] of Object.entries(pkgJson[depType])) {
          if (name.startsWith('@mdxdb/')) {
            pkgJson[depType][name] = 'workspace:*'
            modified = true
          }
        }
      }

      if (modified) {
        await fs.promises.writeFile(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n')
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Error processing ${pkgPath}:`, error)
      }
    }
  }
}

restoreWorkspaceDependencies()
