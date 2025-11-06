#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileIfNotExists, ensureDir, removePathIfExists } from './lib/files.js';
import { run, getInstalledVersion, ensureDevDependencies } from './lib/packages.js';
import { readPlaywrightConfig, integrateZestReporter } from './lib/playwright.js';
import { askYesNo } from './lib/prompts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  try {
    // ============================================================================
    // Setup: Parse command line arguments and set defaults
    // ============================================================================
    const args = process.argv.slice(2);
    const has = (flag) => args.includes(flag);
    const nonInteractiveYes = has('--yes') || has('-y');

    const defaultInstallPlaywright = !has('--no-playwright');
    const defaultCreateExampleTest = !has('--no-example');
    const defaultCreateTsConfig = !has('--no-tsconfig');
    const defaultInstallDotenv = !has('--no-dotenv');

    // ============================================================================
    // Playwright: Check installation and initialize
    // ============================================================================
    const isPwInstalled = !!getInstalledVersion('@playwright/test');

    let installPlaywright;
    if (isPwInstalled) {
      installPlaywright = false;
    } else {
      installPlaywright = nonInteractiveYes
        ? defaultInstallPlaywright
        : await askYesNo('Install @playwright/test?', defaultInstallPlaywright);
    }

    const pwConfigExistsBeforeInit = fs.existsSync('playwright.config.ts');
    
    if (installPlaywright && !pwConfigExistsBeforeInit) {
      if (nonInteractiveYes) {
        run('npm init playwright@latest -- --yes');
      } else {
        run('npm init playwright@latest');
      }
      removePathIfExists('tests-examples');
      removePathIfExists('tests/example.spec.ts');
      removePathIfExists('tests/example.spec.tsx');
    }

    // ============================================================================
    // Zest: Check installation and ask user
    // ============================================================================
    const defaultInstallZest = !has('--no-zest');
    let installZest = false;
    const isZestInstalled = !!getInstalledVersion('@zest-pw/test');
    
    if (!isZestInstalled) {
      installZest = nonInteractiveYes
        ? defaultInstallZest
        : await askYesNo('Install @zest-pw/test?', defaultInstallZest);
    }
    
    // ============================================================================
    // TypeScript Config: Check and create tsconfig.json
    // ============================================================================
    const tsConfigExists = fs.existsSync('tsconfig.json');
    let createTsConfig = false;
    
    if (!tsConfigExists) {
      createTsConfig = nonInteractiveYes
        ? defaultCreateTsConfig
        : await askYesNo('Create tsconfig.json?', defaultCreateTsConfig);
      
      if (createTsConfig) {
        const templatePath = path.join(__dirname, 'templates', 'tsconfig.json.template');
        copyFileIfNotExists(templatePath, 'tsconfig.json');
      }
    }
    
    // ============================================================================
    // Example Test: Ask user about creating example test
    // ============================================================================
    const pwInfo = readPlaywrightConfig();
    const effectiveTestDir = pwInfo.exists ? pwInfo.testDir : 'tests';
    let createExampleTest = false;

    if (nonInteractiveYes) {
      createExampleTest = defaultCreateExampleTest;
    } else {
      createExampleTest = await askYesNo(`Add an example test in ${effectiveTestDir}/?`, defaultCreateExampleTest);
    }

    // ============================================================================
    // Dependencies: Install required packages
    // ============================================================================
    const packagesToInstall = [];
    
    if (installZest || isZestInstalled) {
      packagesToInstall.push('@zest-pw/test');
    }
    
    if (createTsConfig || (tsConfigExists && !getInstalledVersion('typescript'))) {
      packagesToInstall.push('typescript', '@types/node');
    }
    
    if (packagesToInstall.length > 0) {
      ensureDevDependencies(packagesToInstall);
    }

    // ============================================================================
    // Files: Create configuration and test files
    // ============================================================================
    if (createExampleTest) {
      ensureDir(effectiveTestDir);
      const exampleTestPath = path.join(__dirname, 'templates', 'TC-001.spec.ts.template');
      copyFileIfNotExists(exampleTestPath, `${effectiveTestDir}/TC-001.spec.ts`);
    }

    if (installZest || isZestInstalled) {
      const zestTemplatePath = path.join(__dirname, 'templates', 'zest.config.ts.template');
      copyFileIfNotExists(zestTemplatePath, 'zest.config.ts');
    }

    // ============================================================================
    // Integration: Add Zest reporter to Playwright config
    // ============================================================================
    if ((installZest || isZestInstalled) && (installPlaywright || isPwInstalled) && fs.existsSync('playwright.config.ts')) {
      integrateZestReporter('playwright.config.ts');
    }

    // ============================================================================
    // Dotenv: Check installation and ask user
    // ============================================================================
    const isDotenvInstalled = !!getInstalledVersion('dotenv');
    let installDotenv = false;
    
    if (!isDotenvInstalled) {
      installDotenv = nonInteractiveYes
        ? defaultInstallDotenv
        : await askYesNo('Install dotenv?', defaultInstallDotenv);
    }

    // ============================================================================
    // Dependencies: Install dotenv if needed
    // ============================================================================
    if (installDotenv) {
      ensureDevDependencies(['dotenv']);
    }

    // ============================================================================
    // Files: Create .env file from template
    // ============================================================================
    if (installDotenv || isDotenvInstalled) {
      const envExists = fs.existsSync('.env');
      if (!envExists) {
        const envTemplatePath = path.join(__dirname, 'templates', 'env.template');
        copyFileIfNotExists(envTemplatePath, '.env');
      }
    }
  } catch (err) {
    console.error('Error during initialization:', err?.message || err);
    process.exit(1);
  }
})();

