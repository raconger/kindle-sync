import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';
import type { Config, KindleApiCredentials } from '../types/index.js';

// Load environment variables
loadEnv();

/**
 * Default configuration
 */
const defaultConfig: Config = {
  obsidianVaultPath: './output',
  outputFormat: {
    fileNameTemplate: '{{title}} - {{author}}',
    includeMetadata: true,
    groupBy: 'book',
    sortHighlightsBy: 'location'
  },
  sync: {
    updateExisting: true,
    archiveDeleted: true,
    archivePath: '_archive'
  },
  markdown: {
    frontmatter: {
      title: true,
      author: true,
      category: true,
      lastSync: true,
      highlightsCount: true,
      asin: true
    },
    highlightFormat: 'blockquote',
    includeLocation: true,
    includeDate: true,
    includeNotes: true
  }
};

/**
 * Load configuration from config.json or use defaults
 */
export async function loadConfig(): Promise<Config> {
  try {
    const configPath = resolve(process.cwd(), 'config.json');
    const configFile = await readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(configFile);

    // Merge user config with defaults (deep merge)
    return {
      ...defaultConfig,
      ...userConfig,
      outputFormat: {
        ...defaultConfig.outputFormat,
        ...userConfig.outputFormat
      },
      sync: {
        ...defaultConfig.sync,
        ...userConfig.sync
      },
      markdown: {
        ...defaultConfig.markdown,
        ...userConfig.markdown,
        frontmatter: {
          ...defaultConfig.markdown.frontmatter,
          ...userConfig.markdown?.frontmatter
        }
      }
    };
  } catch (error) {
    console.warn('No config.json found, using defaults');
    return defaultConfig;
  }
}

/**
 * Load Kindle API credentials from environment variables
 */
export function loadCredentials(): KindleApiCredentials {
  const email = process.env.AMAZON_EMAIL;
  const password = process.env.AMAZON_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing Amazon credentials. Please set AMAZON_EMAIL and AMAZON_PASSWORD in .env file'
    );
  }

  return {
    email,
    password,
    deviceId: process.env.KINDLE_DEVICE_ID,
    marketplace: process.env.AMAZON_MARKETPLACE || 'US'
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: Config): void {
  if (!config.obsidianVaultPath) {
    throw new Error('obsidianVaultPath is required in config.json');
  }

  const validGroupBy = ['book', 'author', 'date'];
  if (!validGroupBy.includes(config.outputFormat.groupBy)) {
    throw new Error(`Invalid groupBy: ${config.outputFormat.groupBy}. Must be one of: ${validGroupBy.join(', ')}`);
  }

  const validSortBy = ['location', 'date', 'page'];
  if (!validSortBy.includes(config.outputFormat.sortHighlightsBy)) {
    throw new Error(`Invalid sortHighlightsBy: ${config.outputFormat.sortHighlightsBy}. Must be one of: ${validSortBy.join(', ')}`);
  }

  const validFormats = ['blockquote', 'list', 'paragraph'];
  if (!validFormats.includes(config.markdown.highlightFormat)) {
    throw new Error(`Invalid highlightFormat: ${config.markdown.highlightFormat}. Must be one of: ${validFormats.join(', ')}`);
  }
}
