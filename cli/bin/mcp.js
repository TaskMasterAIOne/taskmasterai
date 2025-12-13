#!/usr/bin/env node
/**
 * TaskMaster AI MCP Server Entry Point
 * 
 * Follows the official claude-task-master MCP server patterns
 * Supports TASK_MASTER_TOOLS environment variable for tool tier configuration
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set MCP mode flag to enable MCP-specific behavior
process.env.TASK_MASTER_MCP = 'true';

// Import and start the server
import '../src/mcp/server.js';
