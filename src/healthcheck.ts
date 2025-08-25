#!/usr/bin/env node

/**
 * Health check script for Docker and orchestration
 * This script checks if the MCP server is running and healthy
 */

import http from 'http';
import process from 'process';

const PORT = process.env.PORT || 3000;
const TIMEOUT = 5000; // 5 seconds

const options = {
  hostname: 'localhost',
  port: PORT,
  path: '/health',
  method: 'GET',
  timeout: TIMEOUT,
};

const request = http.request(options, (res) => {
  // Response received, check status code
  if (res.statusCode === 200) {
    process.exit(0); // Success
  } else {
    console.error(`Health check failed with status: ${res.statusCode}`);
    process.exit(1); // Failure
  }
});

request.on('error', (err) => {
  console.error('Health check error:', err.message);
  process.exit(1); // Failure
});

request.on('timeout', () => {
  console.error('Health check timed out');
  request.destroy();
  process.exit(1); // Failure
});

request.end();
