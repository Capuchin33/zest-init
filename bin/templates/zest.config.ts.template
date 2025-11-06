import { defineZestConfig } from '@zest-pw/test';

/**
 * Zest Playwright Configuration
 *
 * Configure test reporting, screenshots, and Zephyr integration
 */
export default defineZestConfig({
  // ============================================================================
  // Reporter Configuration
  // ============================================================================
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

  // ============================================================================
  // Screenshots Configuration
  // ============================================================================
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

  // ============================================================================
  // Zephyr Scale Integration
  // ============================================================================
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

