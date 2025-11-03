#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

function ensureFile(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getInstalledVersion(pkgName) {
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

function ensureDevDependencies(packages) {
  const missing = packages.filter((p) => !getInstalledVersion(p));
  if (missing.length > 0) {
    run(`npm i -D ${missing.join(' ')}`);
  }
}

async function askYesNo(question, defaultYes = true) {
  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
  const answer = await new Promise(resolve => rl.question(question + suffix, resolve));
  rl.close();
  const normalized = (answer || '').trim().toLowerCase();
  if (!normalized) return defaultYes;
  return ['y', 'yes'].includes(normalized);
}

(async () => {
  try {
    const args = process.argv.slice(2);
    const has = (flag) => args.includes(flag);
    const nonInteractiveYes = has('--yes') || has('-y');

    const defaultInstallPlaywright = !has('--no-playwright');
    const defaultCreatePwConfig = !has('--no-config');
    const defaultCreateExampleTest = !has('--no-example');

    const createZestConfig = nonInteractiveYes
      ? !has('--no-zest-config')
      : await askYesNo('Create zest.config.ts?', true);

    const isTsInstalled = !!getInstalledVersion('typescript');
    const isTypesNodeInstalled = !!getInstalledVersion('@types/node');
    const isPwInstalled = !!getInstalledVersion('@playwright/test');

    let installPlaywright;
    // If any of these dependencies already exist, do not show the question
    if (isTsInstalled || isTypesNodeInstalled || isPwInstalled) {
      installPlaywright = !isPwInstalled; // install only if missing
    } else {
      installPlaywright = nonInteractiveYes
        ? defaultInstallPlaywright
        : await askYesNo('Install @playwright/test and browsers?', defaultInstallPlaywright);
    }
    const createPwConfig = nonInteractiveYes
      ? defaultCreatePwConfig
      : await askYesNo('Create playwright.config.ts?', defaultCreatePwConfig);
    const createExampleTest = nonInteractiveYes
      ? defaultCreateExampleTest
      : await askYesNo('Add an example test in tests/?', defaultCreateExampleTest);

    // 1) Dev dependencies (install only missing)
    ensureDevDependencies(['@zest-pw/test', 'typescript', '@types/node']);
    let didInstallPlaywright = false;
    if (installPlaywright) {
      const before = !!getInstalledVersion('@playwright/test');
      ensureDevDependencies(['@playwright/test']);
      const after = !!getInstalledVersion('@playwright/test');
      didInstallPlaywright = !before && after;
    }

    // 2) zest.config.ts (optional)
    if (createZestConfig) {
      ensureFile('zest.config.ts', `import { defineZestConfig } from '@zest-pw/test';
export default defineZestConfig({
  reporter: { saveJsonReport: true, outputDir: 'test-results', printToConsole: true },
  screenshots: { enabled: true, includeInReport: true, onlyOnFailure: false, saveToDisk: false },
  zephyr: { enabled: false, updateResults: false }
});
`);
    }

    // 3) playwright.config.ts (optional)
    if (createPwConfig) {
      ensureFile('playwright.config.ts', `import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  reporter: [['list'], ['@zest-pw/test/reporter']],
  use: { trace: 'on-first-retry' }
});
`);
    }

    // 4) Tests (optional)
    if (createExampleTest) {
      ensureDir('tests');
      ensureFile('tests/TC-001.spec.ts', `import { test, expect } from '@zest-pw/test';
test('TC-001: Example', async ({ page }) => {
  await test.step('Open site', async () => { await page.goto('https://playwright.dev'); });
  await test.step('Title check', async () => { await expect(page).toHaveTitle(/Playwright/); });
});
`);
    }

    // 5) Browser installation (optional and only if Playwright is present)
    if (didInstallPlaywright) {
      try { run('npx playwright install'); } catch {}
    }

    console.log('\n✓ Zest initialized.');
    if (installPlaywright) {
      console.log('Run tests: npx playwright test');
    } else {
      console.log('Add Playwright if needed: npm i -D @playwright/test');
    }
  } catch (err) {
    console.error('Error during initialization:', err?.message || err);
    process.exit(1);
  }
})();


