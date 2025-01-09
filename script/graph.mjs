import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const packagesDir = path.resolve(__dirname, '../packages')
const packageNames = fs.readdirSync(packagesDir)

console.log(JSON.stringify(topo(), null, 2))

function topo() {
  const packages = []
  for (const packageName of packageNames) {
    const packageDir = path.resolve(packagesDir, packageName)
    const packageJsonPath = path.join(packageDir, 'package.json')
    if (fs.existsSync(packageJsonPath) && fs.statSync(packageJsonPath).isFile()) {
      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(packageJsonContent)
      packages.push({
        name: packageJson.name,
        dependencies: Object.keys(packageJson.dependencies ?? {}),
      })
    } else {
      console.error(`Invalid package: ${packageName}`)
    }
  }

  const allPackageNames = new Set(packages.map(it => it.name))
  for (const pkg of packages) {
    pkg.dependencies = pkg.dependencies.filter(it => allPackageNames.has(it))
    pkg.deps = pkg.dependencies.slice()
  }

  const orders = []
  for (let i = 0; i < packages.length; ++i) {
    let j = i
    for (; j < packages.length; ++j) {
      const pkg = packages[j]
      if (pkg.deps.length < 1) break
    }

    if (j >= packages.length) {
      console.error('Circular dependencies detected.')
      const all = packages.map(it => it.name).sort()
      const remain = packages.filter(it => it.deps.length > 0).map(it => it)
      return { orders, remain, all }
    }

    const pkg = packages[j]
    packages[j] = packages[i]
    packages[i] = pkg

    orders.push(pkg.name)
    for (let k = 0; k < packages.length; ++k) {
      const pkgB = packages[k]
      const idx = pkgB.deps.indexOf(pkg.name)
      if (idx < 0) continue
      pkgB.deps.splice(idx, 1)
    }
  }
  return { orders }
}
