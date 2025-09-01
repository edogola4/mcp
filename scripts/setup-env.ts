#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import chalk from 'chalk';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

const CONFIG_EXAMPLE_PATH = path.join(__dirname, '../config.example.ts');
const ENV_PATH = path.join(__dirname, '../.env');

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

async function setupEnvironment() {
  console.log(chalk.blue('🚀 Setting up environment configuration...\n'));

  try {
    // Check if .env already exists
    if (await fileExists(ENV_PATH)) {
      console.log(chalk.yellow('⚠️  .env file already exists. Skipping creation.'));
      return;
    }

    // Read the example config
    const exampleConfig = await readFile(CONFIG_EXAMPLE_PATH, 'utf-8');
    
    // Extract the config object from the example file
    const configMatch = exampleConfig.match(/export const config = (\{[\s\S]*?\});/);
    if (!configMatch) {
      throw new Error('Could not find config object in example file');
    }

    // Convert the config object to .env format
    const envContent = Object.entries(JSON.parse(configMatch[1]))
      .map(([key, value]) => {
        // Skip comments and empty lines
        if (key.startsWith('//') || key.trim() === '') return '';
        
        // Handle different value types
        let envValue: string;
        if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'string') {
          // Don't quote numbers or booleans
          if (value === 'true' || value === 'false' || !isNaN(Number(value))) {
            envValue = value;
          } else {
            envValue = `"${value.replace(/"/g, '\\"')}"`;
          }
        } else if (typeof value === 'object') {
          envValue = JSON.stringify(value);
        } else {
          envValue = String(value);
        }
        
        return `${key}=${envValue}`;
      })
      .filter(Boolean)
      .join('\n');

    // Write the .env file
    await writeFile(ENV_PATH, envContent);
    console.log(chalk.green('✅ Successfully created .env file'));
    console.log(chalk.blue('\n📝 Please update the .env file with your configuration values.'));
    console.log(chalk.blue('   The application will not work correctly until you do so.\n'));

  } catch (error) {
    console.error(chalk.red('❌ Error setting up environment configuration:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// Run the setup
setupEnvironment();
