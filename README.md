# Zest Playwright Init

Initializer for quickly setting up Zest Playwright.

## Installation/Run

```bash
npm init zest-pw@latest
```

This invokes the `create-zest-pw` package and starts interactive prompts. You can choose to:
- install or skip `@playwright/test` and browsers
- create or skip `playwright.config.ts`
- add or skip an example test in `tests/`
- create or skip `zest.config.ts`

Dev dependencies are always checked and added if missing: `@zest-pw/test`, `typescript`, `@types/node` (already installed — skipped). Creating `zest.config.ts` can now also be disabled.

### Non-interactive mode (flags)

```bash
# Accept defaults (yes to everything)
npm init zest-pw@latest -- --yes

# Disable installing Playwright and browsers
npm init zest-pw@latest -- --no-playwright

# Do not create playwright.config.ts
npm init zest-pw@latest -- --no-config

# Do not add an example test
npm init zest-pw@latest -- --no-example

# Do not create zest.config.ts
npm init zest-pw@latest -- --no-zest-config

# Combine flags
npm init zest-pw@latest -- --yes --no-example
```


After installation, run tests:
```bash
npx playwright test
```

## Troubleshooting

- Ensure Node.js >= 16 is installed
- If browsers did not install: `npx playwright install --force`
- On Windows, run the terminal as Administrator if you get permission errors

