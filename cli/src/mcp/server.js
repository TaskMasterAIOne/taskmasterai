
import { FastMCP } from 'fastmcp';
import { 
  registerToolsForTier, 
  getToolCountForTier, 
  getToolsConfiguration,
  TOOL_TIERS,
} from './tools/index.js';
import { getLicenseStatus } from '../lib/license.js';
import { getVersion } from '../lib/config.js';

async function startServer() {
  const toolMode = getToolsConfiguration();
  const version = getVersion();

  const server = new FastMCP({
    name: 'TaskMaster AI MCP Server',
    version: version,
    description: 'TaskMaster AI - AI-powered task management and TDD workflow automation',
  });
  let licenseValid = false;
  let licensePlan = 'none';
  try {
    const licenseStatus = await getLicenseStatus();
    licenseValid = licenseStatus.valid;
    licensePlan = licenseStatus.plan || 'none';
    
    if (!licenseValid) {
      console.error('⚠️  LICENSE REQUIRED: TaskMaster AI requires a valid license.');
      console.error('   Get your license at: https://www.taskmaster.one/pricing');
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
  await server.start({
    transportType: 'stdio',
    timeout: 120000 // 2 minutes timeout
  });
}
startServer().catch(error => {
  console.error('Failed to start MCP server:', error.message);
  process.exit(1);
});
