# Zest Playwright Init

Initializer for quickly setting up Zest Playwright.

## Installation/Run

```
npm init zest-pw@latest
```

This invokes the `zest-pw` package and starts interactive prompts. You can choose to:
- install or skip `@playwright/test` (uses `npm init playwright@latest` which also installs TypeScript and browsers)
- install or skip `@zest-pw/test`
- create or skip `tsconfig.json`
- add or skip an example test in `tests/` directory

The script automatically:
- Creates `zest.config.ts` when Zest is installed
- Integrates Zest reporter into `playwright.config.ts`
- Removes Playwright example tests (does not remove existing tests in your project)

### Non-interactive mode (flags)

```
# Accept defaults (yes to everything)
npm init zest-pw@latest -- --yes

# Disable installing Playwright
npm init zest-pw@latest -- --no-playwright

# Do not install Zest
npm init zest-pw@latest -- --no-zest

# Do not create tsconfig.json
npm init zest-pw@latest -- --no-tsconfig

# Do not add an example test
npm init zest-pw@latest -- --no-example

# Combine flags
npm init zest-pw@latest -- --yes --no-example
```

## What gets created

- `playwright.config.ts` - Created by `npm init playwright@latest` (if Playwright is installed)
- `tsconfig.json` - TypeScript configuration (if requested)
- `zest.config.ts` - Zest configuration (automatically created when Zest is installed)
- `tests/TC-001.spec.ts` - Example test file (if requested)

## After installation

Run tests:
```
npx playwright test
```

## Troubleshooting

- Ensure Node.js >= 24 is installed
- If browsers did not install: `npx playwright install --force`
- On Windows, run the terminal as Administrator if you get permission errors
