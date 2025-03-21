# Security Policy

## Reporting Security Issues

If you believe you have found a security vulnerability in this project, please report it to us through coordinated disclosure.

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, please send an email to [REPLACE_WITH_YOUR_EMAIL].

Please include as much of the information listed below as you can to help us better understand and resolve the issue:

- The type of issue (e.g., exposed credentials, SQL injection, etc.)
- Full paths of source file(s) related to the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

## Sensitive Information

This repository contains template files that require users to add their own credentials. Never commit files containing real credentials to this repository.

The following files are provided as templates and should never contain real credentials:

- `scripts/setup-scheduler.sql.template`
- `scripts/test-send-discord-direct.sql.template`
- `supabase/config.toml.template`
- `.env.example`

When these templates are populated with real credentials during setup, the resulting files are:

- `scripts/setup-scheduler.sql`
- `scripts/test-send-discord-direct.sql`
- `supabase/config.toml`
- `.env`

These files are listed in `.gitignore` to prevent them from being committed. If you need to make changes to the structure of these files, please edit the template versions only.

## Best Practices

1. Never commit `.env` files or any files containing API keys, passwords, or other secrets.
2. Use environment variables for sensitive information.
3. Use Supabase's secrets management for storing credentials for Edge Functions.
4. Regularly rotate your API keys and tokens.
5. Use the template files provided and follow the instructions in the README for setting up your local environment.

## Security Features

This project follows these security practices:

1. Template files for configuration with placeholders instead of real credentials
2. Scripts to safely generate configuration files from templates
3. Comprehensive .gitignore to prevent committing sensitive information
4. Authorization checks in Edge Functions to prevent unauthorized access
5. Input validation to prevent injection attacks 