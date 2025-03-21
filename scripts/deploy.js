#!/usr/bin/env node

/**
 * Deployment script for SuperRare Auction Bot
 * 
 * This script helps with deploying the edge functions to Supabase
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const FUNCTIONS_DIR = path.join(__dirname, '..', 'supabase', 'functions');
const FUNCTIONS = ['fetch-events', 'process-events', 'send-discord'];

// Helper function to execute shell commands
function exec(command) {
  console.log(`> ${command}`);
  try {
    const output = execSync(command, { stdio: 'inherit' });
    return output;
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error);
    process.exit(1);
  }
}

// Check if Supabase CLI is installed
try {
  execSync('supabase --version', { stdio: 'ignore' });
} catch (error) {
  console.error('Supabase CLI is not installed. Please install it first:');
  console.error('Please follow the installation instructions in the README.md file.');
  process.exit(1);
}

// Deploy functions
console.log('Deploying edge functions...');
for (const func of FUNCTIONS) {
  console.log(`\nDeploying ${func}...`);
  exec(`supabase functions deploy ${func}`);
}

// Set up secrets
console.log('\nSetting up secrets...');
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const envVars = envContent.split('\n')
    .filter(line => {
      // Filter out comments and empty lines
      if (!line.trim() || line.startsWith('#')) return false;
      
      // Filter out SUPABASE_ prefixed variables as they're reserved
      const key = line.split('=')[0].trim();
      return !key.startsWith('SUPABASE_');
    })
    .map(line => {
      const [key, value] = line.split('=');
      return { key: key.trim(), value: value.trim() };
    });

  console.log('The following secrets will be set:');
  envVars.forEach(({ key }) => console.log(`- ${key}`));
  console.log('Note: SUPABASE_ prefixed variables are reserved and will be skipped.');

  for (const { key, value } of envVars) {
    if (value) {
      console.log(`Setting secret: ${key}`);
      try {
        exec(`supabase secrets set ${key}="${value}"`);
      } catch (error) {
        console.error(`Failed to set secret ${key}. This may be a reserved name or an invalid value.`);
        console.error('You can set this secret manually if needed.');
      }
    }
  }
} else {
  console.warn('No .env file found. Skipping secrets setup.');
  console.log('You can set up secrets manually using the setup-secrets.js script:');
  console.log('node scripts/setup-secrets.js');
}

console.log('\nDeployment completed successfully!');
console.log('\nNext steps:');
console.log('1. Make sure your secrets are set up correctly:');
console.log('   node scripts/setup-secrets.js');
console.log('2. Set up the scheduler:');
console.log('   node scripts/update-scheduler-sql.js');
console.log('   Then follow the instructions to set up the scheduler using SQL in the Supabase dashboard.');
console.log('3. Test the bot by triggering the functions manually:');
console.log('   supabase functions invoke fetch-events');
console.log('   supabase functions invoke process-events');
console.log('   supabase functions invoke send-discord'); 