# SuperRare Auction Bot

A Discord bot that monitors SuperRare auction events and sends notifications to a Discord channel.

## Features

- Monitors SuperRare GraphQL API for auction events
- Sends formatted notifications to Discord for:
  - New auctions
  - New bids
  - Auction completions
- Stores event data in Supabase PostgreSQL database
- Uses Supabase Edge Functions for serverless execution
- Scheduled execution via Supabase CRON jobs

## Security Notice

This repository includes template files for configuration that need to be filled with your own credentials.
**Never commit files containing real credentials or API keys to public repositories.**

The following files are set up as templates and are included in .gitignore to prevent accidental commits:
- `scripts/setup-scheduler.sql.template` -> `scripts/setup-scheduler.sql` (generated)
- `scripts/test-send-discord-direct.sql.template` -> `scripts/test-send-discord-direct.sql` (generated)
- `supabase/config.toml.template` -> `supabase/config.toml` (manually copied)

The templates will be populated with your credentials when you run the setup scripts.

## Setup

### Prerequisites

- [Supabase Account](https://supabase.com/)
- Discord integration (one of the following):
  - [Discord Bot Token](https://discord.com/developers/applications) (recommended)
  - [Discord Webhook](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks) (alternative)
- [Node.js](https://nodejs.org/) (for local development)
- [Supabase CLI](https://github.com/supabase/cli#install-the-cli)

### Installing Supabase CLI

The Supabase CLI can be installed using the appropriate method for your operating system:

#### Windows

**Option 1: Using Scoop (Recommended)**
```powershell
# Install Scoop if you don't have it
iwr -useb get.scoop.sh | iex

# Install Supabase CLI
scoop install supabase
```

**Option 2: Direct Download**
```powershell
# Using PowerShell
iwr https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.exe -OutFile $env:LOCALAPPDATA\supabase\supabase.exe

# Add to PATH
$env:Path += ";$env:LOCALAPPDATA\supabase"
```

#### macOS
```bash
# Using Homebrew
brew install supabase/tap/supabase
```

#### Linux
```bash
# Using curl
curl -s https://raw.githubusercontent.com/supabase/cli/main/install.sh | bash
```

### Quick Setup

The easiest way to set up the project is to use the initialization script:

```
node scripts/init.js
```

This script will:
1. Check if Supabase CLI is installed
2. Initialize the Supabase project
3. Install dependencies
4. Help you set up the Discord bot
5. Start Supabase local development
6. Apply database migrations

### Manual Installation

If you prefer to set up the project manually:

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/auction-bot.git
   cd auction-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up Supabase configuration:
   - Copy `supabase/config.toml.template` to `supabase/config.toml`
   - Update the `project_id` and other fields with your own values

4. Set up Supabase:
   - Create a new Supabase project
   - Run the database migrations:
     ```
     supabase db push
     ```

5. Configure environment variables:
   - Create a `.env` file based on `.env.example`
   - Add your Supabase URL and key
   - For Discord integration, add either:
     - Bot method: Discord bot token and channel ID (recommended)
     - Webhook method: Discord webhook URL (alternative)

6. Set up Supabase secrets:

```bash
# For Linux/macOS
node scripts/setup-secrets.js

# For Windows PowerShell
.\scripts\setup-secrets.ps1
```

> **Note for Windows users**: If you get an execution policy error, you may need to run PowerShell as Administrator and set the execution policy to allow local scripts:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```
> Or run the script directly with:
> ```powershell
> powershell -ExecutionPolicy Bypass -File .\scripts\setup-secrets.ps1
> ```

7. Deploy Edge Functions:
   ```
   node scripts/deploy.js
   ```

8. Set up the scheduler:
   ```
   node scripts/update-scheduler-sql.js
   ```
   This script will:
   - Create SQL files from templates using your project reference
   - Add your service role key for authentication
   - Generate custom SQL files based on your configuration
   - Provide instructions for running the SQL in the Supabase dashboard

   After running the script, follow the instructions to set up the CRON jobs in the Supabase SQL Editor.

## Project Structure

```
auction-bot/
├── supabase/
│   ├── migrations/       # Database migrations
│   ├── functions/        # Edge Functions
│   │   ├── fetch-events/
│   │   ├── process-events/
│   │   └── send-discord/
│   └── config.toml.template  # Template for Supabase configuration
├── scripts/              # Utility scripts
│   ├── deploy.js         # Deployment script
│   ├── setup-discord.js  # Discord bot setup script
│   ├── setup-secrets.js  # Secrets setup script
│   ├── setup-scheduler.sql.template # Template for setting up the scheduler
│   ├── test-send-discord-direct.sql.template # Template for testing functions
│   └── update-scheduler-sql.js # Script to create SQL files from templates
├── .env.example          # Example environment variables
├── package.json          # Project dependencies
└── README.md             # This file
```

## Edge Functions

The bot is powered by three Supabase Edge Functions:

1. **fetch-events**: Fetches events from the SuperRare API and stores them in the database
2. **process-events**: Processes events in the database and prepares them for Discord
3. **send-discord**: Sends notifications to Discord using either webhook or bot token methods

Each Edge Function has access to these automatically provided environment variables:
- `SUPABASE_URL`: The API gateway for your Supabase project
- `SUPABASE_ANON_KEY`: The anon key for your API (for public access)
- `SUPABASE_SERVICE_ROLE_KEY`: The admin key for your API (for privileged operations)
- `SUPABASE_DB_URL`: The connection string for direct database access

You need to set additional secrets for the functions to work:
- `DISCORD_BOT_TOKEN`: Your Discord bot token
- `DISCORD_CHANNEL_ID`: The channel ID to send messages to
- `DISCORD_WEBHOOK_URL`: (Optional) The webhook URL for sending messages to Discord - can be used instead of bot token
- `SUPERRARE_API_URL`: The URL for the SuperRare GraphQL API
- `BOTTO_CONTRACT_ADDRESS`: The contract address to monitor

## CRON Jobs

The edge functions are triggered by CRON jobs in Supabase that run every minute. The CRON jobs are set up using the SQL script in `scripts/setup-scheduler.sql` which is generated from the template.

The scheduler uses HTTP requests with service role authentication to invoke the edge functions securely, with comprehensive error logging to help with debugging.

## Usage

Once deployed, the bot will automatically:

1. Poll the SuperRare API every minute
2. Store new events in the database
3. Process events and send notifications to Discord

You can monitor the system by checking the CRON job logs:

```sql
SELECT * FROM cron_function_logs ORDER BY log_time DESC LIMIT 20;
```

## Development

For local development:

1. Start the Supabase local development server:
   ```
   supabase start
   ```

2. Run the functions locally:
   ```
   supabase functions serve
   ```

3. Trigger functions manually:
   ```
   supabase functions invoke fetch-events
   supabase functions invoke process-events
   supabase functions invoke send-discord
   ```

## Troubleshooting

### Discord Integration Issues

- **Bot Integration**:
  - Make sure your bot has the correct permissions (Send Messages, View Channel)
  - Check that the bot token is correct in your environment variables
  - Verify that the bot has been invited to your server
  - Ensure the DISCORD_CHANNEL_ID is correct and the bot has access to that channel

- **Webhook Integration**:
  - If using a webhook instead of a bot token, ensure the DISCORD_WEBHOOK_URL is valid
  - Webhooks can be created in the Discord channel settings → Integrations → Webhooks
  - Webhooks only need access to the specific channel they were created for

### Edge Function Issues

- Make sure all three edge functions are deployed:
  ```
  supabase functions list
  ```
- Check for errors in the function logs:
  ```
  supabase functions logs
  ```
- Ensure the authentication is consistent across all functions

### CRON Job Issues

- Check the CRON job logs for errors:
  ```sql
  SELECT * FROM cron_function_logs ORDER BY log_time DESC LIMIT 20;
  ```
- Verify the CRON jobs are scheduled:
  ```sql
  SELECT * FROM cron.job;
  ```
- Ensure proper authentication in the CRON jobs:
  - Make sure to run the `update-scheduler-sql.js` script to correctly generate SQL files with your service role key
  - If you encounter errors with the pg_cron extension, ensure it's enabled:
    ```sql
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    ```
  - If you encounter errors with the http extension, ensure it's enabled:
    ```sql
    CREATE EXTENSION IF NOT EXISTS http;
    ```
  - Then run the updated SQL in the Supabase SQL Editor

### Supabase Secrets Issues

- Supabase doesn't allow setting secrets that start with `SUPABASE_` as these are reserved
- Use one of the setup scripts to set up secrets from your `.env` file:

```bash
# For Linux/macOS
node scripts/setup-secrets.js

# For Windows PowerShell
.\scripts\setup-secrets.ps1
```

> **Note for Windows users**: If you get an execution policy error, you may need to run PowerShell as Administrator and set the execution policy to allow local scripts:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```
> Or run the script directly with:
> ```powershell
> powershell -ExecutionPolicy Bypass -File .\scripts\setup-secrets.ps1
> ```

- You can also set secrets manually using the Supabase CLI:

```bash
supabase secrets set KEY="VALUE"
```

- To list all secrets:

```bash
supabase secrets list
```

## License

MIT

## Setting Up Discord Bot Secrets

Example of setting up Discord-related secrets (replace with your actual values):

```bash
# Discord Configuration
# Use either bot token method:
supabase secrets set DISCORD_BOT_TOKEN="your_discord_bot_token"
supabase secrets set DISCORD_CHANNEL_ID="your_discord_channel_id"

# OR webhook method:
supabase secrets set DISCORD_WEBHOOK_URL="your_discord_webhook_url"

# SuperRare Configuration
supabase secrets set SUPERRARE_API_URL="https://api.superrare.com/graphql"
supabase secrets set BOTTO_CONTRACT_ADDRESS="0x66cd3ede22a25eef3cc8799381b99b1d4f0983f8"

# Application Configuration
supabase secrets set POLLING_INTERVAL_MS="60000" 