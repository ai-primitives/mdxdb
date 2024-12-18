import fs from 'fs'
import path from 'path'

async function convertWorkspaceDependencies() {
  const packagesDir = path.join(process.cwd(), 'packages')
  const packages = await fs.promises.readdir(packagesDir)

  for (const pkg of packages) {
    const pkgPath = path.join(packagesDir, pkg, 'package.json')
    try {
      const content = await fs.promises.readFile(pkgPath, 'utf8')
      const pkgJson = JSON.parse(content)
      let modified = false

      // Convert workspace dependencies to actual versions
      for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
        if (!pkgJson[depType]) continue

        for (const [name, version] of Object.entries(pkgJson[depType])) {
          if (version.startsWith('workspace:')) {
            const depPkgPath = path.join(packagesDir, name.replace('@mdxdb/', ''), 'package.json')
            const depContent = await fs.promises.readFile(depPkgPath, 'utf8')
            const depPkg = JSON.parse(depContent)
            pkgJson[depType][name] = `^${depPkg.version}`
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

convertWorkspaceDependencies()
