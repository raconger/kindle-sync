#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, loadCredentials, validateConfig } from './utils/config.js';
import { KindleClient } from './api/kindle-client.js';
import { SyncManager } from './sync/sync-manager.js';

/**
 * Kindle Sync CLI
 *
 * Export Kindle highlights to Obsidian-compatible markdown files
 */

const program = new Command();

program
  .name('kindle-sync')
  .description('Export Kindle highlights to Obsidian-compatible markdown files')
  .version('1.0.0');

/**
 * Sync command - Main command to sync highlights
 */
program
  .command('sync')
  .description('Sync Kindle highlights to your Obsidian vault')
  .option('-c, --config <path>', 'Path to config file', 'config.json')
  .option('--dry-run', 'Run without making any changes')
  .action(async (options) => {
    try {
      console.log('Kindle Sync v1.0.0\n');

      // Load configuration
      console.log('Loading configuration...');
      const config = await loadConfig();
      validateConfig(config);
      console.log(`✓ Output directory: ${config.obsidianVaultPath}\n`);

      // Load credentials
      console.log('Loading credentials...');
      const credentials = loadCredentials();
      console.log(`✓ Amazon account: ${credentials.email}\n`);

      if (options.dryRun) {
        console.log('DRY RUN MODE - No files will be modified\n');
        return;
      }

      // Create clients
      const kindleClient = new KindleClient(credentials);
      const syncManager = new SyncManager(config, kindleClient);

      // Run sync
      const result = await syncManager.sync();

      // Exit with appropriate code
      process.exit(result.success ? 0 : 1);

    } catch (error) {
      console.error('\n✗ Error:', error instanceof Error ? error.message : 'Unknown error');
      console.error('\nPlease check your configuration and credentials.');
      console.error('Run "kindle-sync init" to set up the project.');
      process.exit(1);
    }
  });

/**
 * Init command - Initialize configuration files
 */
program
  .command('init')
  .description('Initialize configuration files')
  .action(async () => {
    try {
      const { existsSync } = await import('fs');
      const { copyFile } = await import('fs/promises');

      console.log('Initializing kindle-sync...\n');

      // Check if config.json exists
      if (existsSync('config.json')) {
        console.log('✓ config.json already exists');
      } else {
        await copyFile('config.example.json', 'config.json');
        console.log('✓ Created config.json from template');
      }

      // Check if .env exists
      if (existsSync('.env')) {
        console.log('✓ .env already exists');
      } else {
        await copyFile('.env.example', '.env');
        console.log('✓ Created .env from template');
      }

      console.log('\nNext steps:');
      console.log('1. Edit config.json to set your Obsidian vault path');
      console.log('2. Edit .env to add your Amazon credentials');
      console.log('3. Run "npm run sync" to sync your highlights');

    } catch (error) {
      console.error('✗ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

/**
 * List command - List all books with highlights
 */
program
  .command('list')
  .description('List all books with highlights (without syncing)')
  .action(async () => {
    try {
      console.log('Fetching Kindle books...\n');

      const credentials = loadCredentials();
      const kindleClient = new KindleClient(credentials);
      const books = await kindleClient.fetchHighlights();

      console.log(`\nFound ${books.length} books:\n`);

      books.forEach((book, index) => {
        console.log(`${index + 1}. ${book.title}`);
        console.log(`   By: ${book.author}`);
        console.log(`   Highlights: ${book.highlights.length}\n`);
      });

    } catch (error) {
      console.error('✗ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

/**
 * Validate command - Validate configuration
 */
program
  .command('validate')
  .description('Validate configuration and credentials')
  .action(async () => {
    try {
      console.log('Validating configuration...\n');

      // Validate config
      const config = await loadConfig();
      validateConfig(config);
      console.log('✓ Configuration is valid');
      console.log(`  Output path: ${config.obsidianVaultPath}`);
      console.log(`  Group by: ${config.outputFormat.groupBy}`);
      console.log(`  Sort by: ${config.outputFormat.sortHighlightsBy}\n`);

      // Validate credentials
      const credentials = loadCredentials();
      console.log('✓ Credentials loaded');
      console.log(`  Email: ${credentials.email}`);
      console.log(`  Marketplace: ${credentials.marketplace}\n`);

      console.log('✓ All validations passed!');

    } catch (error) {
      console.error('✗ Validation failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Parse arguments
program.parse();
