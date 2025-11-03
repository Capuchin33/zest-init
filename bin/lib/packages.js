import { execSync } from 'node:child_process';
import fs from 'node:fs';

export function run(command) {
  execSync(command, { stdio: 'inherit' });
}

export function getInstalledVersion(pkgName) {
  try {
    const pkgPath = 'package.json';
    if (!fs.existsSync(pkgPath)) return null;
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) };
    return deps[pkgName] || null;
  } catch {
    return null;
  }
}

export function ensureDevDependencies(packages) {
  const missing = packages.filter((p) => !getInstalledVersion(p));
  if (missing.length > 0) {
    run(`npm i -D ${missing.join(' ')}`);
  }
}

