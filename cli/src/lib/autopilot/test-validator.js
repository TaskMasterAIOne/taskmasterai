
export class TestResultValidator {
    validate(tddPhase, results) {
    if (!results || typeof results !== 'object') {
      throw new Error('Invalid test results format');
    }

    const { total = 0, passed = 0, failed = 0 } = results;

    if (tddPhase === 'RED') {
      // RED phase: Must have at least one failing test
      if (failed === 0) {
        throw new Error(
          'RED phase requires at least one failing test. ' +
          `Current results: ${passed} passed, ${failed} failed. ` +
          'Write a test that validates behavior that doesn\'t exist yet.'
        );
      }
    } else if (tddPhase === 'GREEN') {
      // GREEN phase: All tests must pass
      if (failed > 0) {
        throw new Error(
          `GREEN phase requires all tests to pass. ` +
          `${failed} test(s) still failing. ` +
          'Fix the implementation to make all tests pass.'
        );
      }
      if (total === 0) {
        throw new Error(
          'GREEN phase requires at least one test. ' +
          'No tests were found in the results.'
        );
      }
    }
    // COMMIT phase doesn't validate test results

    return true;
  }

    parseTestOutput(output) {
    // Vitest format: "Tests  2 failed | 8 passed | 10 total"
    const vitestMatch = output.match(/Tests\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\|\s+(\d+)\s+total/);
    if (vitestMatch) {
      return {
        total: parseInt(vitestMatch[3]),
        passed: parseInt(vitestMatch[2]),
        failed: parseInt(vitestMatch[1]),
        skipped: 0,
      };
    }

    // Jest format: "Tests:  2 failed, 8 passed, 10 total"
    const jestMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (jestMatch) {
      return {
        total: parseInt(jestMatch[3]),
        passed: parseInt(jestMatch[2]),
        failed: parseInt(jestMatch[1]),
        skipped: 0,
      };
    }

    // Mocha format: "X passing (Ys)" and "Y failing"
    const mochaPassMatch = output.match(/(\d+)\s+passing/);
    const mochaFailMatch = output.match(/(\d+)\s+failing/);
    if (mochaPassMatch) {
      const passed = parseInt(mochaPassMatch[1]);
      const failed = mochaFailMatch ? parseInt(mochaFailMatch[1]) : 0;
      return {
        total: passed + failed,
        passed,
        failed,
        skipped: 0,
      };
    }

    throw new Error('Could not parse test output. Please provide results as JSON.');
  }
}
