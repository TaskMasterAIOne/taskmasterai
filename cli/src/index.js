/**
 * TaskMaster AI CLI
 * Main entry point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { getLicenseStatus, syncUserConfig, syncHostedApiKeys, canUseHostedApiKeys } from './lib/license.js';
import { registerCommands } from './commands/index.js';
import { getVersion, readProjectConfig, findProjectRoot } from './lib/config.js';

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
  '-V',
  'init',
  // Auth commands - user needs to login before having a license
  'login',
  'logout',
  'whoami'
];

/**
 * Display the TaskMaster AI banner with logo
 */
export async function displayBanner(options = {}) {
  const { showVersion = true } = options;
  
  const version = getVersion();
  const projectRoot = findProjectRoot();
  const projectName = projectRoot ? (readProjectConfig(projectRoot)?.projectName || 'TaskMaster AI') : 'TaskMaster AI';
  
  // ASCII art logo representation  
  const logo = `
  ${chalk.hex('#7C3AED')('╔════════════════════════════════════════════════════════════════════════════╗')}
  ${chalk.hex('#7C3AED')('║')}                                                                            ${chalk.hex('#7C3AED')('║')}
  ${chalk.hex('#7C3AED')('║')}  ${chalk.hex('#7C3AED').bold('████████╗ █████╗ ███████╗██╗  ██╗███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗')}  ${chalk.hex('#7C3AED')('║')}
  ${chalk.hex('#7C3AED')('║')}  ${chalk.hex('#7C3AED').bold('╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗')} ${chalk.hex('#7C3AED')('║')}
  ${chalk.hex('#7C3AED')('║')}  ${chalk.hex('#7C3AED').bold('   ██║   ███████║███████╗█████╔╝ ██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝')} ${chalk.hex('#7C3AED')('║')}
  ${chalk.hex('#7C3AED')('║')}  ${chalk.hex('#7C3AED').bold('   ██║   ██╔══██║╚════██║██╔═██╗ ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗')} ${chalk.hex('#7C3AED')('║')}
  ${chalk.hex('#7C3AED')('║')}  ${chalk.hex('#7C3AED').bold('   ██║   ██║  ██║███████║██║  ██╗██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║')} ${chalk.hex('#7C3AED')('║')}
  ${chalk.hex('#7C3AED')('║')}  ${chalk.hex('#7C3AED').bold('   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝')} ${chalk.hex('#7C3AED')('║')}
  ${chalk.hex('#7C3AED')('║')}                                                                            ${chalk.hex('#7C3AED')('║')}
  ${chalk.hex('#7C3AED')('║')}                    ${chalk.white.bold('TaskMaster')} ${chalk.hex('#7C3AED').bold('AI')} ${chalk.dim('— AI-Powered Task Management')}                    ${chalk.hex('#7C3AED')('║')}
  ${chalk.hex('#7C3AED')('║')}                                                                            ${chalk.hex('#7C3AED')('║')}
  ${chalk.hex('#7C3AED')('╚════════════════════════════════════════════════════════════════════════════╝')}`;

  console.log(logo);
  console.log('');
  console.log(chalk.dim('     ') + chalk.cyan.underline('https://www.taskmaster.one'));
  console.log('');
  
  if (showVersion) {
    console.log(
      boxen(
        chalk.hex('#7C3AED').bold('v' + version) + chalk.dim('  │  ') + chalk.white('Project: ') + chalk.cyan(projectName),
        {
          padding: { top: 0, bottom: 0, left: 2, right: 2 },
          borderColor: '#7C3AED',
          borderStyle: 'round'
        }
      )
    );
    console.log('');
  }
}

/**
 * Display current tag context
 */
export function displayTagContext(tagName) {
  console.log(chalk.yellow('🏷 tag: ') + chalk.white.bold(tagName));
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
          chalk.dim('Get your license at: ') + chalk.cyan.underline('https://www.taskmaster.one/pricing') + '\n' +
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
        chalk.yellow('⚠️  Your subscription payment is past due. Update your payment at https://www.taskmaster.one/billing')
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
        chalk.dim('Get your license at: ') + chalk.cyan.underline('https://www.taskmaster.one/pricing'),
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

  // Register all commands (includes activate, deactivate, license, etc.)
  registerCommands(program);

  // Additional license management commands not in commands/index.js
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
          output += '\n' + chalk.dim('   https://www.taskmaster.one/pricing');
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
