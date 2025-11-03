#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

function ensureFile(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function copyFileIfNotExists(sourcePath, targetPath) {
  if (!fs.existsSync(targetPath) && fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    return true;
  }
  return false;
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
    // Check if reporter is a string (e.g., reporter: 'html')
    const stringReporterMatch = configContent.match(/reporter:\s*['"]([^'"]+)['"]/);
    if (stringReporterMatch) {
      // Convert string reporter to array format
      const existingReporter = stringReporterMatch[1];
      configContent = configContent.replace(
        /reporter:\s*['"]([^'"]+)['"]/,
        `reporter: [['${existingReporter}'], ['@zest-pw/test/reporter']]`
      );
    } else {
      // If reporter exists as array, add to it (handles both single-line and multi-line arrays)
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
    }
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
    const defaultCreateExampleTest = !has('--no-example');
    const defaultCreateTsConfig = !has('--no-tsconfig');

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
        : await askYesNo('Install @playwright/test?', defaultInstallPlaywright);
    }

    // 1) Initialize Playwright (if chosen and config doesn't exist)
    // npm init playwright@latest will install @playwright/test, TypeScript, and browsers automatically
    const pwConfigExistsBeforeInit = fs.existsSync('playwright.config.ts');
    let ranPlaywrightInit = false;
    
    if (installPlaywright && !pwConfigExistsBeforeInit) {
      try {
        // Run Playwright init: interactive if not in --yes mode, auto-accept otherwise
        // This will install @playwright/test, TypeScript, @types/node, and browsers
        if (nonInteractiveYes) {
          run('npm init playwright@latest -- --yes');
        } else {
          run('npm init playwright@latest');
        }
        ranPlaywrightInit = true;

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
        ranPlaywrightInit = true;
      }
    }

    // 3) Ask about installing Zest library (after Playwright is set up)
    const defaultInstallZest = !has('--no-zest');
    let installZest = false;
    const isZestInstalled = !!getInstalledVersion('@zest-pw/test');
    
    if (!isZestInstalled) {
      installZest = nonInteractiveYes
        ? defaultInstallZest
        : await askYesNo('Install @zest-pw/test?', defaultInstallZest);
    }
    
    // 4) Handle tsconfig.json
    const tsConfigExists = fs.existsSync('tsconfig.json');
    let createTsConfig = false;
    
    if (tsConfigExists) {
      // If tsconfig exists, automatically fix it if needed (no prompt)
      const wasFixed = fixTsConfig('tsconfig.json');
      if (wasFixed) {
        console.log('✓ Fixed tsconfig.json (removed invalid "src" include path)');
      }
    } else {
      // Ask only if tsconfig doesn't exist
      createTsConfig = nonInteractiveYes
        ? defaultCreateTsConfig
        : await askYesNo('Create tsconfig.json?', defaultCreateTsConfig);
      
      if (createTsConfig) {
        const templatePath = path.join(__dirname, 'templates', 'tsconfig.json.template');
        copyFileIfNotExists(templatePath, 'tsconfig.json');
      }
    }
    
    // 5) Ask about example test right after tsconfig question (before installing dependencies)
    const pwInfo = readPlaywrightConfig();
    const effectiveTestDir = pwInfo.exists ? pwInfo.testDir : 'tests';
    let createExampleTest = false;

    if (nonInteractiveYes) {
      createExampleTest = defaultCreateExampleTest;
    } else {
      createExampleTest = await askYesNo(`Add an example test in ${effectiveTestDir}/?`, defaultCreateExampleTest);
    }

    // 6) Install all dependencies after all questions are asked
    const packagesToInstall = [];
    
    if (installZest || isZestInstalled) {
      packagesToInstall.push('@zest-pw/test');
    }
    
    // Install TS toolchain if tsconfig will be created or exists but TypeScript is not installed
    if (createTsConfig || (tsConfigExists && !getInstalledVersion('typescript'))) {
      packagesToInstall.push('typescript', '@types/node');
    }
    
    if (packagesToInstall.length > 0) {
      ensureDevDependencies(packagesToInstall);
    }

    // 7) Create example test after dependencies are installed
    if (createExampleTest) {
      ensureDir(effectiveTestDir);
      const exampleTestPath = path.join(__dirname, 'templates', 'TC-001.spec.ts.template');
      if (copyFileIfNotExists(exampleTestPath, `${effectiveTestDir}/TC-001.spec.ts`)) {
        console.log(`✓ Created ${effectiveTestDir}/TC-001.spec.ts`);
      }
    }

    // 8) zest.config.ts (create automatically after @zest-pw/test is installed)
    if (installZest || isZestInstalled) {
      // Create zest.config.ts automatically, skip if it already exists
      const zestTemplatePath = path.join(__dirname, 'templates', 'zest.config.ts.template');
      if (copyFileIfNotExists(zestTemplatePath, 'zest.config.ts')) {
        console.log('✓ Created zest.config.ts');
      }
    }

    // 9) Integrate reporter to playwright.config.ts (if Zest is installed and config exists)
    if ((installZest || isZestInstalled) && (installPlaywright || isPwInstalled) && fs.existsSync('playwright.config.ts')) {
      // Integrate reporter to existing or newly created config
      integrateZestReporter('playwright.config.ts');
    }

    // Browser installation is handled by npm init playwright@latest

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


