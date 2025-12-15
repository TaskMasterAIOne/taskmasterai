#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config();

process.env.TASK_MASTER_MCP = 'true';

import '../src/mcp/server.js';
