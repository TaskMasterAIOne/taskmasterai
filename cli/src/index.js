/**
 * TaskMaster AI CLI
 * Main entry point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { getLicenseStatus, activateLicense, deactivateLicense, formatLicenseStatus } from './lib/license.js';
import { registerCommands } from './commands/index.js';
import { getVersion } from './lib/config.js';

// Commands that don't require license validation
const LICENSE_EXEMPT_COMMANDS = [
  'activate',
  'deactivate',
  'license',
  'usage',
  'help',
  '--help',
  '-h',
  '--version',
  '-V'
];

/**
 * Display the TaskMaster AI banner
 */
function displayBanner() {
  console.log(
    boxen(
      chalk.cyan.bold('TaskMaster AI') + chalk.gray(' v' + getVersion()) + '\n' +
      chalk.dim('AI-powered task management for developers'),
      {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        borderColor: 'cyan',
        borderStyle: 'round'
      }
    )
  );
  console.log('');
}

/**
 * Check license before running commands
 */
async function checkLicense(commandName) {
  if (LICENSE_EXEMPT_COMMANDS.includes(commandName)) {
    return true;
  }

  try {
    const status = await getLicenseStatus();

    if (!status.valid) {
      console.log('');
      console.log(
        boxen(
          chalk.red.bold('⚠️  License Required') + '\n\n' +
          chalk.white(status.error || 'A valid license is required to use TaskMaster AI.') + '\n\n' +
          chalk.dim('Get your license at: ') + chalk.cyan.underline('https://taskmaster.one/pricing') + '\n' +
          chalk.dim('Activate with: ') + chalk.cyan('taskmaster activate <license-key>'),
          {
            padding: 1,
            borderColor: 'red',
            borderStyle: 'round'
          }
        )
      );
      console.log('');
      return false;
    }

    // Show warning for grace period
    if (status.status === 'grace_period') {
      console.log(
        chalk.yellow('⚠️  Your subscription payment is past due. Update your payment at https://taskmaster.one/billing')
      );
    }

    // Show offline warning
    if (status.offline) {
      console.log(
        chalk.yellow('⚠️  Using cached license (offline mode). Connect to internet to revalidate.')
      );
    }

    return true;
  } catch (error) {
    console.log('');
    console.log(
      boxen(
        chalk.red.bold('License Validation Failed') + '\n\n' +
        chalk.white(error.message) + '\n\n' +
        chalk.dim('Get your license at: ') + chalk.cyan.underline('https://taskmaster.one/pricing'),
        {
          padding: 1,
          borderColor: 'red',
          borderStyle: 'round'
        }
      )
    );
    console.log('');
    return false;
  }
}

/**
 * Create and configure the CLI program
 */
function createProgram() {
  const program = new Command();

  program
    .name('taskmaster')
    .description('TaskMaster AI - AI-powered task management for developers')
    .version(getVersion(), '-v, --version', 'Display version number');

  // Add license check hook
  program.hook('preAction', async (thisCommand, actionCommand) => {
    const commandName = actionCommand.name();
    const isValid = await checkLicense(commandName);
    if (!isValid) {
      process.exit(1);
    }
  });

  // Register all commands
  registerCommands(program);

  // License management commands (exempt from license check)
  program
    .command('activate <license-key>')
    .description('Activate TaskMaster AI with your license key')
    .action(async (licenseKey) => {
      displayBanner();
      
      const ora = (await import('ora')).default;
      const spinner = ora('Validating license key...').start();

      try {
        const result = await activateLicense(licenseKey);
        spinner.stop();

        if (result.success) {
          console.log(
            boxen(
              chalk.green.bold('✓ License Activated!') + '\n\n' +
              chalk.white('Plan: ') + chalk.cyan(result.planName || result.plan) + '\n' +
              chalk.white('Tasks/month: ') + chalk.cyan(result.tasksPerMonth?.toLocaleString() || 'Unlimited') + '\n' +
              chalk.white('Expires: ') + chalk.cyan(new Date(result.expiresAt).toLocaleDateString()) + '\n\n' +
              chalk.dim('You can now use TaskMaster AI!'),
              {
                padding: 1,
                borderColor: 'green',
                borderStyle: 'round'
              }
            )
          );
        } else {
          console.log(
            boxen(
              chalk.red.bold('✗ Activation Failed') + '\n\n' +
              chalk.white(result.error || 'Invalid license key') + '\n\n' +
              chalk.dim('Get a valid license at: ') + chalk.cyan.underline('https://taskmaster.one/pricing'),
              {
                padding: 1,
                borderColor: 'red',
                borderStyle: 'round'
              }
            )
          );
          process.exit(1);
        }
      } catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  program
    .command('deactivate')
    .description('Deactivate the current license')
    .action(async () => {
      displayBanner();
      
      try {
        const result = deactivateLicense();
        if (result.success) {
          console.log(chalk.green('✓ License deactivated successfully.'));
        } else {
          console.log(chalk.yellow(result.error || 'No license to deactivate.'));
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  program
    .command('license')
    .description('Show current license status')
    .action(async () => {
      displayBanner();
      
      const ora = (await import('ora')).default;
      const spinner = ora('Checking license status...').start();

      try {
        const status = await getLicenseStatus(true); // Force refresh
        spinner.stop();

        const formatted = formatLicenseStatus(status);
        
        if (status.valid) {
          console.log(
            boxen(
              chalk.green.bold('✓ License Active') + '\n\n' +
              formatted,
              {
                padding: 1,
                borderColor: 'green',
                borderStyle: 'round'
              }
            )
          );
        } else {
          console.log(
            boxen(
              chalk.red.bold('✗ No Valid License') + '\n\n' +
              formatted + '\n\n' +
              chalk.dim('Get your license at: ') + chalk.cyan.underline('https://taskmaster.one/pricing'),
              {
                padding: 1,
                borderColor: 'red',
                borderStyle: 'round'
              }
            )
          );
        }
      } catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  return program;
}

/**
 * Run the CLI
 */
export async function runCLI() {
  const program = createProgram();

  // Show banner for help commands
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    displayBanner();
  }

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}
