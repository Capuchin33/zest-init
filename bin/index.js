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

function removePathIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.rmSync(targetPath, { force: true });
    }
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

function readPlaywrightConfig() {
  const configPath = 'playwright.config.ts';
  if (!fs.existsSync(configPath)) {
    return { exists: false };
  }
  const content = fs.readFileSync(configPath, 'utf8');
  // naive testDir detection
  const testDirMatch = content.match(/testDir:\s*['"]([^'"]+)['"]/);
  const testDir = testDirMatch ? testDirMatch[1] : 'tests';
  const hasZestReporter = content.includes("@zest-pw/test/reporter");
  return { exists: true, testDir, hasZestReporter };
}

function integrateZestReporter(configPath) {
  if (!fs.existsSync(configPath)) return;
  
  let configContent = fs.readFileSync(configPath, 'utf8');
  // Skip if reporter is already integrated
  if (configContent.includes('@zest-pw/test/reporter')) return;
  
  // Try to find and update reporter configuration
  if (configContent.includes('reporter:')) {
    // If reporter exists, add to it (handles both single-line and multi-line arrays)
    // Match reporter: followed by array that might span multiple lines
    configContent = configContent.replace(
      /reporter:\s*(\[[\s\S]*?\])/,
      (match, reporters) => {
        // Add Zest reporter if not present
        if (!reporters.includes('@zest-pw/test/reporter')) {
          // Remove closing bracket and add our reporter before it
          const trimmed = reporters.trim();
          const withoutBracket = trimmed.slice(0, -1).trimEnd();
          return `reporter: ${withoutBracket}, ['@zest-pw/test/reporter']]`;
        }
        return match;
      }
    );
  } else {
    // Add reporter section if it doesn't exist
    configContent = configContent.replace(
      /export default defineConfig\(\{/,
      `export default defineConfig({
  reporter: [['list'], ['@zest-pw/test/reporter']],`
    );
  }
  fs.writeFileSync(configPath, configContent, 'utf8');
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
    // The example test prompt will be asked later (after reading Playwright config)
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
    // Check if playwright.config.ts already exists
    const pwConfigExists = fs.existsSync('playwright.config.ts');
    // Ask about Playwright config only if Playwright will be available and config doesn't exist
    let createPwConfig = false;
    if ((installPlaywright || isPwInstalled) && !pwConfigExists) {
      createPwConfig = nonInteractiveYes
        ? defaultCreatePwConfig
        : await askYesNo('Create playwright.config.ts?', defaultCreatePwConfig);
    }
    // Defer example test decision until after Playwright config is known
    let createExampleTest = false;

    // 1) First stage: ensure Playwright is installed (if chosen)
    let didInstallPlaywright = false;
    if (installPlaywright) {
      const before = !!getInstalledVersion('@playwright/test');
      ensureDevDependencies(['@playwright/test']);
      const after = !!getInstalledVersion('@playwright/test');
      didInstallPlaywright = !before && after;
      // Install browsers right after Playwright is installed
      if (didInstallPlaywright) {
        try { run('npx playwright install'); } catch {}
      }
    }

    // 2) Then: ensure remaining dev dependencies
    const tsConfigExists = fs.existsSync('tsconfig.json');
    ensureDevDependencies([
      '@zest-pw/test',
      // Skip installing TS toolchain if tsconfig.json already exists
      ...(!tsConfigExists ? ['typescript', '@types/node'] : [])
    ]);

    // Create tsconfig.json only if missing
    ensureFile('tsconfig.json', `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "@playwright/test"]
  },
  "include": ["**/*.ts"]
}
`);

    // 3) zest.config.ts (optional)
    if (createZestConfig) {
      ensureFile('zest.config.ts', `import { defineZestConfig } from '@zest-pw/test';

/**
 * Zest Playwright Configuration
 *
 * Configure test reporting, screenshots, and Zephyr integration
 */
export default defineZestConfig({
  reporter: {
    // Save test results to JSON file
    saveJsonReport: true,
    // Output directory for reports
    outputDir: 'test-results',
    // Print test results to console
    printToConsole: true,
    // Verbose output (includes all step details)
    verbose: false,
  },
  screenshots: {
    // Enable screenshot capture
    enabled: true,
    // Include screenshots in JSON report
    includeInReport: true,
    // Capture screenshots only on failure
    onlyOnFailure: false,
    // Save screenshots to disk as files
    saveToDisk: false,
  },
  zephyr: {
    // Enable Zephyr Scale integration
    enabled: false,
    // Update test results in Zephyr after test run
    updateResults: false,
    // API credentials (uses environment variables by default)
    // apiUrl: process.env.ZEPHYR_API_URL,
    // apiKey: process.env.ZEPHYR_API_KEY,
    // testCycleKey: process.env.ZEPHYR_TEST_CYCLE_KEY,
  },
});
`);
    }

    // 4) playwright.config.ts integration
    if (installPlaywright || isPwInstalled) {
      // If config already exists, integrate reporter without asking
      if (pwConfigExists) {
        integrateZestReporter('playwright.config.ts');
      } else if (createPwConfig) {
        // Use Playwright's init command to create standard config
        try {
          // Run Playwright init: interactive if not in --yes mode, auto-accept otherwise
          if (nonInteractiveYes) {
            // Run in non-interactive mode
            run('npm init playwright@latest -- --yes');
          } else {
            // Let the user configure Playwright interactively
            run('npm init playwright@latest');
          }
          // Integrate Zest reporter to the newly created config
          integrateZestReporter('playwright.config.ts');

          // Remove Playwright example tests (keep only our own later)
          removePathIfExists('tests-examples');
          // Common fallback example paths created by some versions
          removePathIfExists('tests/example.spec.ts');
          removePathIfExists('tests/example.spec.tsx');
        } catch (err) {
          // Fallback: create minimal config if init fails
          ensureFile('playwright.config.ts', `import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  reporter: [['list'], ['@zest-pw/test/reporter']],
  use: { trace: 'on-first-retry' }
});
`);
        }
      }
    }

    // 5) Determine Playwright config and ask about example test now
    const pwInfo = readPlaywrightConfig();
    const effectiveTestDir = pwInfo.exists ? pwInfo.testDir : 'tests';

    if (nonInteractiveYes) {
      createExampleTest = defaultCreateExampleTest;
    } else {
      createExampleTest = await askYesNo(`Add an example test in ${effectiveTestDir}/?`, defaultCreateExampleTest);
    }

    if (createExampleTest) {
      ensureDir(effectiveTestDir);
      ensureFile(`${effectiveTestDir}/TC-001.spec.ts`, `import { test, expect } from '@zest-pw/test';
test('TC-001: Example', async ({ page }) => {

  await test.step('Open site', async () => { 
    await page.goto('https://playwright.dev'); 
  });

  await test.step('Title check', async () => { 
    await expect(page).toHaveTitle(/Playwright/); 
  });
    
});
`);
    }

    // Browser installation already handled immediately after Playwright install

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


