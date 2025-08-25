#!/usr/bin/env node

/**
 * MCP Client Example
 * 
 * This script demonstrates how to interact with the MCP server
 * using JSON-RPC over HTTP.
 */

const http = require('http');

const HOST = 'localhost';
const PORT = 3000;

/**
 * Make a JSON-RPC request to the MCP server
 * @param {string} method - The RPC method to call
 * @param {Object} params - The parameters to pass to the method
 * @returns {Promise<Object>} - The response from the server
 */
async function callRpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    });

    const options = {
      hostname: HOST,
      port: PORT,
      path: '/rpc',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(`RPC Error: ${response.error.message}`));
          } else {
            resolve(response.result);
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Example usage of the MCP server
 */
async function main() {
  try {
    console.log('MCP Client Example\n');

    // Example 1: Get current weather
    console.log('1. Getting current weather for London...');
    const weather = await callRpc('weather.getCurrent', {
      city: 'London',
      units: 'metric',
    });
    console.log('Current Weather in London:');
    console.log(`- Temperature: ${weather.weather.temperature.current}°C`);
    console.log(`- Condition: ${weather.weather.description}`);
    console.log(`- Humidity: ${weather.weather.humidity}%`);
    console.log(`- Wind: ${weather.weather.wind.speed} m/s\n`);

    // Example 2: Write to a file
    console.log('2. Writing to a file...');
    const writeResult = await callRpc('file.write', {
      path: 'example.txt',
      content: 'Hello, MCP Server!',
    });
    console.log(`File written successfully. Size: ${writeResult.size} bytes\n`);

    // Example 3: Read from a file
    console.log('3. Reading from the file...');
    const readResult = await callRpc('file.read', {
      path: 'example.txt',
    });
    console.log(`File content: "${readResult.content}"\n`);

    // Example 4: Database operations
    console.log('4. Executing database query...');
    try {
      // Create a table if it doesn't exist
      await callRpc('database.query', {
        sql: 'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)',
      });

      // Insert some data
      await callRpc('database.query', {
        sql: 'INSERT INTO test (name, value) VALUES (?, ?)',
        params: ['test1', 42],
      });

      // Query the data
      const dbResult = await callRpc('database.query', {
        sql: 'SELECT * FROM test',
        readOnly: true,
      });

      console.log('Database query result:');
      console.log(JSON.stringify(dbResult.rows, null, 2));
    } catch (dbError) {
      console.error('Database error:', dbError.message);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the example
main();
