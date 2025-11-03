import fs from 'node:fs';

export function readPlaywrightConfig() {
  const configPath = 'playwright.config.ts';
  if (!fs.existsSync(configPath)) {
    return { exists: false };
  }
  const content = fs.readFileSync(configPath, 'utf8');
  const testDirMatch = content.match(/testDir:\s*['"]([^'"]+)['"]/);
  const testDir = testDirMatch ? testDirMatch[1] : 'tests';
  const hasZestReporter = content.includes("@zest-pw/test/reporter");
  return { exists: true, testDir, hasZestReporter };
}

export function integrateZestReporter(configPath) {
  if (!fs.existsSync(configPath)) return;
  
  let configContent = fs.readFileSync(configPath, 'utf8');
  if (configContent.includes('@zest-pw/test/reporter')) return;
  
  if (configContent.includes('reporter:')) {
    const stringReporterMatch = configContent.match(/reporter:\s*['"]([^'"]+)['"]/);
    if (stringReporterMatch) {
      const existingReporter = stringReporterMatch[1];
      configContent = configContent.replace(
        /reporter:\s*['"]([^'"]+)['"]/,
        `reporter: [['${existingReporter}'], ['@zest-pw/test/reporter']]`
      );
    } else {
      configContent = configContent.replace(
        /reporter:\s*(\[[\s\S]*?\])/,
        (match, reporters) => {
          if (!reporters.includes('@zest-pw/test/reporter')) {
            const trimmed = reporters.trim();
            const withoutBracket = trimmed.slice(0, -1).trimEnd();
            return `reporter: ${withoutBracket}, ['@zest-pw/test/reporter']]`;
          }
          return match;
        }
      );
    }
  } else {
    configContent = configContent.replace(
      /export default defineConfig\(\{/,
      `export default defineConfig({
  reporter: [['list'], ['@zest-pw/test/reporter']],`
    );
  }
  fs.writeFileSync(configPath, configContent, 'utf8');
}
