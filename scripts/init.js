#!/usr/bin/env node

/**
 * Initialization Script for SuperRare Auction Bot
 * 
 * This script helps with setting up the project
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

// Helper function to execute shell commands and return output
function execWithOutput(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

// Function to prompt user for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to check if Supabase CLI is installed
async function checkSupabaseCLI() {
  const platform = os.platform();
  
  // Try different commands to find Supabase CLI
  const commands = [
    'supabase --version',
    'scoop list | findstr supabase',  // For Scoop on Windows
    'where supabase',                 // For Windows
    'which supabase',                 // For macOS/Linux
  ];
  
  for (const command of commands) {
    const result = execWithOutput(command);
    if (result) {
      console.log(`✅ Supabase CLI found: ${result}`);
      return true;
    }
  }
  
  return false;
}

// Function to install Supabase CLI based on OS
async function installSupabaseCLI() {
  const platform = os.platform();
  
  console.log(`Detected platform: ${platform}`);
  
  if (platform === 'win32') {
    console.log('Installing Supabase CLI...');
    
    // Check if Scoop is installed
    const scoopInstalled = execWithOutput('where scoop');
    
    if (scoopInstalled) {
      console.log('Scoop is installed. Using Scoop to install Supabase CLI...');
      try {
        exec('scoop install supabase');
        console.log('✅ Supabase CLI installed via Scoop');
        return;
      } catch (error) {
        console.error('Failed to install Supabase CLI using Scoop.');
      }
    }
    
    // If Scoop installation failed or Scoop is not installed, try direct download
    console.log('Trying direct download of Supabase CLI...');
    try {
      // Create directory if it doesn't exist
      exec('mkdir -p %LOCALAPPDATA%\\supabase');
      
      // Download the executable
      exec('powershell -Command "Invoke-WebRequest -Uri https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.exe -OutFile $env:LOCALAPPDATA\\supabase\\supabase.exe"');
      
      // Check if supabase is in PATH
      try {
        execSync('where supabase', { stdio: 'ignore' });
        console.log('✅ Supabase CLI is in PATH');
      } catch (error) {
        console.log('Adding Supabase CLI to PATH...');
        console.log('Please add %LOCALAPPDATA%\\supabase to your PATH environment variable.');
        console.log('You may need to restart your terminal after this.');
        
        const addToPath = await prompt('Do you want to try adding it to PATH automatically? (y/n): ');
        if (addToPath.toLowerCase() === 'y') {
          try {
            // Add to PATH for current session
            exec('setx PATH "%PATH%;%LOCALAPPDATA%\\supabase"');
            console.log('✅ Added Supabase CLI to PATH');
            console.log('Please restart your terminal after this script completes.');
          } catch (error) {
            console.error('Failed to add Supabase CLI to PATH automatically.');
            console.log('Please add %LOCALAPPDATA%\\supabase to your PATH manually.');
          }
        }
      }
    } catch (error) {
      console.error('Failed to install Supabase CLI via direct download.');
      console.log('Please install Supabase CLI manually using one of these methods:');
      console.log('1. Using Scoop: scoop install supabase');
      console.log('2. Direct download: https://github.com/supabase/cli#windows');
      process.exit(1);
    }
  } else if (platform === 'darwin') {
    // For macOS, use Homebrew
    console.log('Installing Supabase CLI using Homebrew...');
    try {
      exec('brew install supabase/tap/supabase');
    } catch (error) {
      console.error('Failed to install Supabase CLI using Homebrew.');
      console.log('Please install Supabase CLI manually: https://github.com/supabase/cli#install-the-cli');
      process.exit(1);
    }
  } else if (platform === 'linux') {
    // For Linux, use curl
    console.log('Installing Supabase CLI using curl...');
    try {
      exec('curl -s https://raw.githubusercontent.com/supabase/cli/main/install.sh | bash');
    } catch (error) {
      console.error('Failed to install Supabase CLI using curl.');
      console.log('Please install Supabase CLI manually: https://github.com/supabase/cli#install-the-cli');
      process.exit(1);
    }
  } else {
    console.error(`Unsupported platform: ${platform}`);
    console.log('Please install Supabase CLI manually: https://github.com/supabase/cli#install-the-cli');
    process.exit(1);
  }
  
  console.log('✅ Supabase CLI installed');
}

// Main function
async function main() {
  console.log('Initialization Script for SuperRare Auction Bot');
  console.log('=============================================');
  console.log('');

  // Check if Supabase CLI is installed
  console.log('Checking for Supabase CLI...');
  const supabaseInstalled = await checkSupabaseCLI();
  
  if (supabaseInstalled) {
    console.log('✅ Supabase CLI is installed');
  } else {
    console.log('❌ Supabase CLI is not installed or not in PATH');
    const installSupabase = await prompt('Do you want to install Supabase CLI? (y/n): ');
    
    if (installSupabase.toLowerCase() === 'y') {
      await installSupabaseCLI();
    } else {
      console.log('⚠️ Supabase CLI is required for this project. Please install it manually:');
      console.log('https://github.com/supabase/cli#install-the-cli');
      process.exit(1);
    }
  }

  // Verify Supabase CLI is working
  try {
    const version = execWithOutput('supabase --version');
    console.log(`Using Supabase CLI version: ${version}`);
  } catch (error) {
    console.error('❌ Supabase CLI is installed but not working correctly.');
    console.log('Please ensure it is properly installed and in your PATH.');
    process.exit(1);
  }

  // Initialize Supabase project
  console.log('\nInitializing Supabase project...');
  
  // Check if supabase project is already initialized
  if (!fs.existsSync(path.join(__dirname, '..', 'supabase', 'config.toml'))) {
    try {
      exec('supabase init');
      console.log('✅ Supabase project initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Supabase project');
      process.exit(1);
    }
  } else {
    console.log('✅ Supabase project already initialized');
  }

  // Install dependencies
  console.log('\nInstalling dependencies...');
  exec('npm install');
  console.log('✅ Dependencies installed');

  // Set up Discord bot
  console.log('\nSetting up Discord bot...');
  const setupDiscord = await prompt('Do you want to set up the Discord bot now? (y/n): ');
  
  if (setupDiscord.toLowerCase() === 'y') {
    exec('node scripts/setup-discord.js');
  } else {
    console.log('You can set up the Discord bot later by running:');
    console.log('node scripts/setup-discord.js');
  }

  // Start Supabase local development
  console.log('\nStarting Supabase local development...');
  const startSupabase = await prompt('Do you want to start Supabase local development? (y/n): ');
  
  if (startSupabase.toLowerCase() === 'y') {
    console.log('Starting Supabase...');
    exec('supabase start');
    console.log('✅ Supabase started');
    
    // Apply migrations
    console.log('\nApplying database migrations...');
    exec('supabase db reset');
    console.log('✅ Database migrations applied');
  } else {
    console.log('You can start Supabase later by running:');
    console.log('supabase start');
    console.log('supabase db reset');
  }

  // Provide instructions for next steps
  console.log('\nNext steps:');
  console.log('1. Set up your Discord bot token in .env file');
  console.log('2. Set up your Supabase secrets:');
  console.log('   node scripts/setup-secrets.js');
  console.log('3. Deploy your Supabase functions:');
  console.log('   node scripts/deploy.js');
  console.log('4. Set up the scheduler:');
  console.log('   node scripts/update-scheduler-sql.js');
  console.log('   Then follow the instructions to set up the scheduler using SQL in the Supabase dashboard.');
  console.log('5. Test your bot by triggering the functions manually:');
  console.log('   supabase functions invoke fetch-events');
  console.log('   supabase functions invoke process-events');
  console.log('   supabase functions invoke send-discord');

  rl.close();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
}); 