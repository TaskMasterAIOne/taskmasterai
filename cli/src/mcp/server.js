/**
 * TaskMaster AI MCP Server
 * Machine-to-Machine Communication Protocol server for AI agent integration
 * 
 * Follows the patterns from official claude-task-master @tm/mcp implementation
 * 
 * Environment Variables:
 * - TASK_MASTER_TOOLS: Tool tier configuration ('core', 'standard', 'all', or comma-separated list)
 * - TASK_MASTER_PROJECT_ROOT: Default project root directory
 */

import { FastMCP } from 'fastmcp';
import { 
  registerToolsForTier, 
  getToolCountForTier, 
  getToolsConfiguration,
  TOOL_TIERS,
} from './tools/index.js';
import { getLicenseStatus } from '../lib/license.js';
import { getVersion } from '../lib/config.js';

/**
 * Initialize and start the MCP server
 */
async function startServer() {
  // Read tool tier from environment using official pattern
  const toolMode = getToolsConfiguration();
  const version = getVersion();

  // Create MCP server
  const server = new FastMCP({
    name: 'TaskMaster AI MCP Server',
    version: version,
    description: 'TaskMaster AI - AI-powered task management and TDD workflow automation',
  });

  // Check license status (warn but don't block - allow limited usage)
  let licenseValid = false;
  let licensePlan = 'none';
  try {
    const licenseStatus = await getLicenseStatus();
    licenseValid = licenseStatus.valid;
    licensePlan = licenseStatus.plan || 'none';
    
    if (!licenseValid) {
      console.error('⚠️  LICENSE REQUIRED: TaskMaster AI requires a valid license.');
      console.error('   Get your license at: https://taskmaster.one/pricing');
      console.error('   Activate with: taskmaster activate <license-key>');
      console.error('');
      console.error('   MCP server starting in limited mode...');
    } else {
      console.error(`✓ License valid: ${licenseStatus.planName || licensePlan} plan`);
      
      if (licenseStatus.status === 'grace_period') {
        console.error('⚠️  License payment is overdue. Please update your payment method.');
      }
      
      if (licenseStatus.offline) {
        console.error('⚠️  Using cached license validation (offline mode)');
      }
    }
  } catch (error) {
    console.error('⚠️  License validation error:', error.message);
    console.error('   Continuing in limited mode...');
  }

  // Register tools based on tier
  const { registeredCount, failedTools } = registerToolsForTier(server, toolMode);

  // Log startup info
  console.error('');
  console.error('TaskMaster AI MCP Server v' + version);
  console.error('━'.repeat(40));
  console.error(`Tool tier: ${toolMode}`);
  console.error(`Registered tools: ${registeredCount}`);
  
  if (failedTools && failedTools.length > 0) {
    console.error(`Failed to register: ${failedTools.join(', ')}`);
  }
  
  console.error('━'.repeat(40));
  console.error('');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('Shutting down MCP server...');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('Shutting down MCP server...');
    process.exit(0);
  });

  // Start the server with stdio transport (standard for MCP)
  await server.start({
    transportType: 'stdio',
    timeout: 120000 // 2 minutes timeout
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start MCP server:', error.message);
  process.exit(1);
});
