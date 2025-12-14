/**
 * TaskMaster AI CLI
 * Main entry point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import terminalImage from 'terminal-image';
import { getLicenseStatus, activateLicense, deactivateLicense, formatLicenseStatus, syncUserConfig, readCachedConfig, syncHostedApiKeys, canUseHostedApiKeys } from './lib/license.js';
import { registerCommands } from './commands/index.js';
import { getVersion } from './lib/config.js';

// TaskMaster AI Logo URL (same as web app)
const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/taskmaster_ai_new_logo-removebg.png?alt=media&token=29e7f6a0-f33d-4ec9-84bd-abf3ddbb78b8';

// Commands that don't require license validation
const LICENSE_EXEMPT_COMMANDS = [
  'activate',
  'deactivate',
  'license',
  'usage',
  'sync',
  'sync-keys',
  'help',
  '--help',
  '-h',
  '--version',
  '-V'
];

/**
 * Display the TaskMaster AI banner with logo
 */
async function displayBanner() {
  try {
    // Fetch and display the logo
    const response = await fetch(LOGO_URL);
    const buffer = await response.arrayBuffer();
    const logo = await terminalImage.buffer(Buffer.from(buffer), { width: 12, height: 6 });
    
    console.log(logo);
    console.log(
      boxen(
        chalk.hex('#7C3AED').bold('TaskMaster') + chalk.white.bold(' AI') + chalk.gray('  v' + getVersion()) + '\n' +
        chalk.dim('AI-powered task management for developers'),
        {
          padding: { top: 0, bottom: 0, left: 2, right: 2 },
          borderColor: '#7C3AED',
          borderStyle: 'round'
        }
      )
    );
  } catch {
    // Fallback if image fails to load
    console.log(
      boxen(
        chalk.hex('#7C3AED').bold('TaskMaster') + chalk.white.bold(' AI') + chalk.gray('  v' + getVersion()) + '\n' +
        chalk.dim('AI-powered task management for developers'),
        {
          padding: { top: 0, bottom: 0, left: 2, right: 2 },
          borderColor: '#7C3AED',
          borderStyle: 'round'
        }
      )
    );
  }
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
      await displayBanner();
      
      const ora = (await import('ora')).default;
      const spinner = ora('Validating license key...').start();

      try {
        const result = await activateLicense(licenseKey);
        spinner.stop();

        if (result.success) {
          let configStatus = '';
          if (result.configSynced) {
            configStatus = chalk.green('✓ ') + chalk.dim(result.configMessage || 'Config synced from dashboard');
          } else if (result.configMessage) {
            configStatus = chalk.yellow('⚠ ') + chalk.dim(result.configMessage);
          }
          
          // Show hosted API keys info for PRO users
          let hostedKeysStatus = '';
          if (result.hostedKeysAvailable && result.hostedKeysMessage) {
            hostedKeysStatus = chalk.green('✓ ') + chalk.dim(result.hostedKeysMessage);
          } else if (result.hostedKeysAvailable) {
            hostedKeysStatus = chalk.green('✓ ') + chalk.dim('Hosted API keys available (no API keys needed!)');
          }
          
          console.log(
            boxen(
              chalk.green.bold('✓ License Activated!') + '\n\n' +
              chalk.white('Plan: ') + chalk.cyan(result.planName || result.plan) + '\n' +
              chalk.white('Tasks/month: ') + chalk.cyan(result.tasksPerMonth?.toLocaleString() || 'Unlimited') + '\n' +
              chalk.white('Expires: ') + chalk.cyan(new Date(result.expiresAt).toLocaleDateString()) + '\n' +
              (configStatus ? '\n' + configStatus : '') +
              (hostedKeysStatus ? '\n' + hostedKeysStatus : '') + '\n\n' +
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
      await displayBanner();
      
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
      await displayBanner();
      
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

  program
    .command('sync-keys')
    .description('Sync API keys from dashboard and hosted keys (PRO plan)')
    .option('--force', 'Force refresh even if cache is valid')
    .action(async (options) => {
      await displayBanner();
      
      const ora = (await import('ora')).default;
      const spinner = ora('Syncing API keys...').start();

      try {
        // Sync user's own API keys from dashboard
        const configSync = await syncUserConfig(options.force || false);
        
        // For PRO users, also sync hosted keys
        let hostedKeysSync = null;
        if (canUseHostedApiKeys()) {
          hostedKeysSync = await syncHostedApiKeys(options.force || false);
        }
        
        spinner.stop();

        const status = await getLicenseStatus(false);
        
        let output = chalk.bold('API Keys Sync Status\n\n');
        
        // User's own keys from dashboard
        if (configSync.success) {
          const userKeys = configSync.apiKeys ? Object.keys(configSync.apiKeys) : [];
          if (userKeys.length > 0) {
            output += chalk.green('✓ ') + chalk.white('Your API keys: ') + chalk.cyan(userKeys.join(', ')) + '\n';
          } else {
            output += chalk.yellow('⚠ ') + chalk.dim('No personal API keys configured in dashboard\n');
          }
          if (configSync.cached) {
            output += chalk.dim('  (from cache)\n');
          }
        } else {
          output += chalk.red('✗ ') + chalk.white('Failed to sync dashboard config: ') + chalk.dim(configSync.error) + '\n';
        }
        
        // Hosted keys (PRO only)
        if (status.plan === 'pro') {
          if (hostedKeysSync?.success) {
            const hostedProviders = hostedKeysSync.providers || [];
            output += chalk.green('✓ ') + chalk.white('Hosted API keys: ') + chalk.cyan(hostedProviders.join(', ')) + '\n';
            output += chalk.dim('  (available as fallback - no API keys needed!)\n');
            if (hostedKeysSync.cached) {
              output += chalk.dim('  (from cache)\n');
            }
          } else if (hostedKeysSync) {
            output += chalk.yellow('⚠ ') + chalk.white('Hosted keys: ') + chalk.dim(hostedKeysSync.error) + '\n';
          }
        } else {
          output += '\n' + chalk.dim('💡 Upgrade to Pro to use hosted API keys (no API keys needed!)');
          output += '\n' + chalk.dim('   https://taskmaster.one/pricing');
        }

        console.log(
          boxen(output, {
            padding: 1,
            borderColor: configSync.success ? 'green' : 'yellow',
            borderStyle: 'round'
          })
        );
        
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
    await displayBanner();
  }

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}
