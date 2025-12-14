/**
 * Authentication Commands for TaskMaster AI CLI
 * Handles login, logout, and auth status
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { 
  loginWithEmail, 
  loginWithGoogle, 
  logout as logoutUser,
  getCurrentUser,
  isLoggedIn 
} from '../lib/auth.js';

/**
 * Register auth-related commands
 * @param {import('commander').Command} program - Commander program instance
 */
export function registerAuthCommands(program) {
  
  // Login command
  program
    .command('login')
    .description('Login to TaskMaster AI')
    .option('-e, --email <email>', 'Login with email')
    .option('-p, --password <password>', 'Password (will prompt if not provided)')
    .option('-g, --google', 'Login with Google')
    .action(async (options) => {
      try {
        console.log(chalk.bold('\n🔐 TaskMaster AI Login\n'));

        // Check if already logged in
        if (await isLoggedIn()) {
          const currentUser = await getCurrentUser();
          const { confirmRelogin } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmRelogin',
              message: `Already logged in as ${chalk.cyan(currentUser?.email)}. Login again?`,
              default: false
            }
          ]);

          if (!confirmRelogin) {
            console.log(chalk.yellow('\nLogin cancelled.'));
            return;
          }

          // Logout first
          await logoutUser();
        }

        let result;

        // Google login
        if (options.google) {
          console.log(chalk.dim('Initiating Google login...\n'));
          result = await loginWithGoogle();
        } 
        // Email/Password login
        else {
          let email = options.email;
          let password = options.password;

          // Prompt for email if not provided
          if (!email) {
            const emailPrompt = await inquirer.prompt([
              {
                type: 'input',
                name: 'email',
                message: 'Email:',
                validate: (input) => {
                  if (!input || !input.includes('@')) {
                    return 'Please enter a valid email';
                  }
                  return true;
                }
              }
            ]);
            email = emailPrompt.email;
          }

          // Prompt for password if not provided
          if (!password) {
            const passwordPrompt = await inquirer.prompt([
              {
                type: 'password',
                name: 'password',
                message: 'Password:',
                mask: '*',
                validate: (input) => {
                  if (!input) {
                    return 'Password is required';
                  }
                  return true;
                }
              }
            ]);
            password = passwordPrompt.password;
          }

          console.log(chalk.dim('\nAuthenticating...\n'));
          result = await loginWithEmail(email, password);
        }

        if (result.success) {
          console.log(chalk.green('✓ Login successful!\n'));
          console.log(chalk.dim('Email:    ') + chalk.cyan(result.email));
          console.log(chalk.dim('User ID:  ') + chalk.dim(result.userId));
          
          if (result.license?.hasLicense) {
            console.log(chalk.dim('Plan:     ') + chalk.bold(result.license.planName));
            console.log(chalk.dim('Tasks:    ') + chalk.white(`${result.license.tasksPerMonth}/month`));
            console.log(chalk.green('\n✓ License activated automatically!'));
          } else {
          console.log(chalk.yellow('\n⚠ No active license found'));
          console.log(chalk.dim('  Subscribe at: ') + chalk.cyan('https://www.taskmaster.one/pricing'));
          }

          console.log(chalk.dim('\nYou\'re all set! Start using TaskMaster AI.\n'));
        } else {
          console.log(chalk.red('✗ Login failed\n'));
          console.log(chalk.dim('  ' + result.error));
          console.log();
        }

      } catch (error) {
        console.error(chalk.red('\n✗ Error during login:'), error.message);
        console.log();
      }
    });

  // Logout command
  program
    .command('logout')
    .description('Logout from TaskMaster AI')
    .action(async () => {
      try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
          console.log(chalk.yellow('\n⚠ Not logged in\n'));
          return;
        }

        const { confirmLogout } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmLogout',
            message: `Logout from ${chalk.cyan(currentUser.email)}?`,
            default: true
          }
        ]);

        if (!confirmLogout) {
          console.log(chalk.yellow('\nLogout cancelled.'));
          return;
        }

        const result = await logoutUser();

        if (result.success) {
          console.log(chalk.green('\n✓ Logged out successfully'));
          console.log(chalk.dim('  License deactivated on this machine\n'));
        } else {
          console.log(chalk.red('\n✗ Logout failed:'), result.error);
          console.log();
        }

      } catch (error) {
        console.error(chalk.red('\n✗ Error during logout:'), error.message);
        console.log();
      }
    });

  // Status command (who am I?)
  program
    .command('whoami')
    .description('Show current login status')
    .action(async () => {
      try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
          console.log(chalk.yellow('\n⚠ Not logged in'));
          console.log(chalk.dim('  Run ') + chalk.cyan('taskmaster login') + chalk.dim(' to get started\n'));
          return;
        }

        console.log(chalk.bold('\n👤 Current User\n'));
        console.log(chalk.dim('Email:        ') + chalk.cyan(currentUser.email));
        console.log(chalk.dim('User ID:      ') + chalk.dim(currentUser.userId));
        console.log(chalk.dim('Login method: ') + chalk.white(currentUser.loginMethod));
        console.log(chalk.dim('Logged in:    ') + chalk.dim(new Date(currentUser.loginAt).toLocaleString()));
        
        // Try to get license info
        const { getLicenseStatus } = await import('../lib/license.js');
        const licenseStatus = await getLicenseStatus();

        if (licenseStatus.valid && licenseStatus.activated) {
          console.log();
          console.log(chalk.bold('📜 License Info\n'));
          console.log(chalk.dim('Plan:         ') + chalk.bold(licenseStatus.planName));
          console.log(chalk.dim('Status:       ') + chalk.green(licenseStatus.status));
          console.log(chalk.dim('Tasks/month:  ') + chalk.white(licenseStatus.tasksPerMonth));
          console.log(chalk.dim('Expires:      ') + chalk.dim(new Date(licenseStatus.expiresAt).toLocaleDateString()));
        } else {
          console.log();
          console.log(chalk.yellow('⚠ No active license'));
          console.log(chalk.dim('  Subscribe at: ') + chalk.cyan('https://www.taskmaster.one/pricing'));
        }

        console.log();

      } catch (error) {
        console.error(chalk.red('\n✗ Error getting status:'), error.message);
        console.log();
      }
    });
}
