#!/usr/bin/env node

/**
 * Discord Bot Setup Script for SuperRare Auction Bot
 * 
 * This script helps with setting up the Discord bot and webhook
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');

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

// Function to prompt user for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to create a Discord webhook
async function createDiscordWebhook(channelId, botToken, webhookName) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      name: webhookName,
    });

    const options = {
      hostname: 'discord.com',
      port: 443,
      path: `/api/v10/channels/${channelId}/webhooks`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${botToken}`,
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        } else {
          reject(new Error(`Request failed with status code ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Main function
async function main() {
  console.log('Discord Bot Setup for SuperRare Auction Bot');
  console.log('==========================================');
  console.log('');

  // Check if .env file exists
  const envPath = path.join(__dirname, '..', '.env');
  let envVars = {};

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          envVars[key.trim()] = value.trim();
        }
      }
    });
  }

  // Get Discord bot token
  let botToken = envVars.DISCORD_BOT_TOKEN;
  if (!botToken || botToken === 'your_discord_bot_token') {
    botToken = await prompt('Enter your Discord bot token: ');
    envVars.DISCORD_BOT_TOKEN = botToken;
  }

  // Get Discord channel ID
  let channelId = envVars.DISCORD_CHANNEL_ID;
  if (!channelId) {
    channelId = await prompt('Enter your Discord channel ID: ');
    envVars.DISCORD_CHANNEL_ID = channelId;
  }

  // Ask if user wants to create a webhook
  const createWebhook = await prompt('Do you want to create a Discord webhook? (y/n): ');
  
  if (createWebhook.toLowerCase() === 'y') {
    try {
      console.log('Creating Discord webhook...');
      const webhookName = await prompt('Enter a name for the webhook (default: SuperRare Auction Bot): ') || 'SuperRare Auction Bot';
      
      const webhook = await createDiscordWebhook(channelId, botToken, webhookName);
      console.log('Webhook created successfully!');
      console.log(`Webhook URL: https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`);
      
      // Save webhook URL to .env
      envVars.DISCORD_WEBHOOK_URL = `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`;
    } catch (error) {
      console.error('Error creating webhook:', error.message);
      console.log('You can create a webhook manually in Discord and add it to your .env file.');
    }
  }

  // Update .env file
  let envContent = '';
  for (const [key, value] of Object.entries(envVars)) {
    envContent += `${key}=${value}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log('.env file updated with Discord configuration.');

  // Provide instructions for next steps
  console.log('\nNext steps:');
  console.log('1. Make sure your Discord bot has the following permissions:');
  console.log('   - Send Messages');
  console.log('   - Embed Links');
  console.log('   - Attach Files');
  console.log('   - Read Message History');
  console.log('2. Invite your bot to your server using the following URL:');
  console.log(`   https://discord.com/api/oauth2/authorize?client_id=${envVars.DISCORD_APPLICATION_ID}&permissions=2147483648&scope=bot`);
  console.log('3. Deploy your Supabase functions using the deploy script:');
  console.log('   node scripts/deploy.js');

  rl.close();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
}); 