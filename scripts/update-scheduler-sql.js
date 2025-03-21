#!/usr/bin/env node

/**
 * Script to update the scheduler SQL files with the correct project reference and service role key
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const dotenv = require('dotenv');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Helper function to execute shell commands and return output
function execWithOutput(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

// Main function
async function main() {
  console.log('Updating scheduler SQL files with project reference and service role key');
  console.log('=================================================================');
  console.log('');

  // Load environment variables
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  // Try to get project reference from supabase config
  let projectRef = null;
  try {
    const configPath = path.join(__dirname, '..', 'supabase', 'config.toml');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const match = configContent.match(/project_id\s*=\s*"([^"]+)"/);
      if (match && match[1]) {
        projectRef = match[1];
        console.log(`Found project reference in config: ${projectRef}`);
      }
    }
  } catch (error) {
    console.log('Could not read project reference from config file.');
  }

  // If project reference not found, ask user
  if (!projectRef) {
    projectRef = await prompt('Enter your Supabase project reference (found in your Supabase dashboard URL): ');
  } else {
    const confirm = await prompt(`Use project reference "${projectRef}"? (y/n): `);
    if (confirm.toLowerCase() !== 'y') {
      projectRef = await prompt('Enter your Supabase project reference: ');
    }
  }
  
  const projectUrl = `https://${projectRef}.supabase.co`;
  console.log(`Using project URL: ${projectUrl}`);

  // Get service role key from .env or ask user
  let serviceRoleKey = process.env.SUPABASE_KEY;
  if (!serviceRoleKey) {
    console.log('\nNo SUPABASE_KEY found in .env file.');
    serviceRoleKey = await prompt('Enter your Supabase service role key: ');
  } else {
    console.log('\nFound SUPABASE_KEY in .env file.');
    const confirm = await prompt('Use this service role key? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      serviceRoleKey = await prompt('Enter your Supabase service role key: ');
    }
  }

  // Update SQL files from templates
  const templatePaths = [
    {
      template: path.join(__dirname, 'setup-scheduler.sql.template'),
      output: path.join(__dirname, 'setup-scheduler.sql')
    },
    {
      template: path.join(__dirname, 'test-send-discord-direct.sql.template'),
      output: path.join(__dirname, 'test-send-discord-direct.sql')
    }
  ];

  for (const { template, output } of templatePaths) {
    if (fs.existsSync(template)) {
      let sqlContent = fs.readFileSync(template, 'utf8');
      
      // Replace template placeholders with actual values
      sqlContent = sqlContent.replace(/\{\{PROJECT_ID\}\}/g, projectRef);
      sqlContent = sqlContent.replace(/\{\{SERVICE_ROLE_KEY\}\}/g, serviceRoleKey);
      
      fs.writeFileSync(output, sqlContent);
      console.log(`✅ Created ${path.basename(output)} from template with your project reference and service role key`);
    } else {
      console.error(`❌ Template file not found: ${path.basename(template)}`);
      console.log(`Please ensure the template file exists at: ${template}`);
    }
  }

  console.log('\nWarning: The generated SQL files contain sensitive information.');
  console.log('Make sure not to commit them to a public repository.');
  console.log('They have been added to .gitignore, but please verify this.');

  console.log('\nNext steps:');
  console.log('1. Go to your Supabase dashboard: https://app.supabase.com/project/_/sql');
  console.log('2. Create a new SQL query');
  console.log('3. Copy and paste the contents of scripts/setup-scheduler.sql');
  console.log('4. Run the query to set up the scheduler');
  console.log('\nTo test the function directly:');
  console.log('1. Go to your Supabase dashboard: https://app.supabase.com/project/_/sql');
  console.log('2. Create a new SQL query');
  console.log('3. Copy and paste the contents of scripts/test-send-discord-direct.sql');
  console.log('4. Run the query to test the send-discord function');

  rl.close();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
}); 