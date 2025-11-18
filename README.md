# Kindle Sync

Export your Kindle highlights to Obsidian-compatible markdown files with automatic syncing and smart updates.

## Features

- **Automated Sync**: Fetch all your Kindle highlights automatically
- **Smart Updates**: Only update files when highlights change
- **Obsidian Compatible**: Generates markdown with YAML frontmatter
- **Flexible Configuration**: Customize output format, sorting, and metadata
- **Archive Support**: Automatically archive books with deleted highlights
- **Multiple Marketplaces**: Support for US, UK, DE, FR, ES, IT, JP, CA Amazon stores
- **Fallback Methods**: Primary API with web scraping fallback for reliability

## Architecture

This project implements **Architecture 3** from the design proposal: Node.js + Kindle API with web scraping fallback.

### Current Implementation
- **Primary Method**: Kindle unofficial API (placeholder for future npm packages)
- **Fallback Method**: Web scraping from `kindle.amazon.com/kp/notebook`
- **Future Enhancement**: Enhanced web scraping with Playwright for better reliability

## Installation

### Prerequisites
- Node.js 18.0.0 or higher
- npm or yarn
- Amazon account with Kindle highlights

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd kindle-sync
```

2. Install dependencies:
```bash
npm install
```

3. Initialize configuration:
```bash
npm run init
```

4. Configure your settings:

**Edit `config.json`:**
```json
{
  "obsidianVaultPath": "/path/to/your/obsidian/vault/Kindle",
  "outputFormat": {
    "fileNameTemplate": "{{title}} - {{author}}",
    "includeMetadata": true,
    "groupBy": "book",
    "sortHighlightsBy": "location"
  }
}
```

**Edit `.env`:**
```env
AMAZON_EMAIL=your-email@example.com
AMAZON_PASSWORD=your-password-here
AMAZON_MARKETPLACE=US
```

5. Build the project:
```bash
npm run build
```

## Usage

### Sync Highlights

Sync all your Kindle highlights to your Obsidian vault:

```bash
npm run sync
```

Or use the built version:

```bash
npm start
```

### List Books

Preview all books with highlights without syncing:

```bash
npm run dev -- list
```

### Validate Configuration

Check if your configuration is valid:

```bash
npm run dev -- validate
```

### Dry Run

See what would be synced without making changes:

```bash
npm run dev -- sync --dry-run
```

## Configuration

### Output Format Options

**File Naming**
- Template variables: `{{title}}`, `{{author}}`
- Example: `"{{title}} - {{author}}"` → `"Atomic Habits - James Clear.md"`

**Grouping**
- `book`: One file per book (default)
- `author`: Group all books by author
- `date`: Group by date range

**Sorting Highlights**
- `location`: Sort by Kindle location (default)
- `date`: Sort by date added
- `page`: Sort by page number

### Markdown Format Options

**Highlight Styles**
- `blockquote`: Format as `> quote` (default)
- `list`: Format as `- item`
- `paragraph`: Plain paragraph

**Metadata**
- `includeLocation`: Show location numbers
- `includeDate`: Show date added
- `includeNotes`: Include your notes on highlights

### Sync Options

- `updateExisting`: Update existing files when highlights change
- `archiveDeleted`: Move books without highlights to archive folder
- `archivePath`: Subfolder for archived files (default: `_archive`)

## Output Example

```markdown
---
title: "Atomic Habits"
author: "James Clear"
category: Books
last_sync: 2025-11-18T10:30:00.000Z
highlights_count: 15
asin: B01N5AX61W
---

# Atomic Habits

**By:** James Clear

## Highlights

> The most effective way to change your habits is to focus not on what you want to achieve, but on who you wish to become.

**Location:** 432 • **Date:** November 15, 2025

---

> You do not rise to the level of your goals. You fall to the level of your systems.

**Location:** 854 • **Date:** November 16, 2025

---
```

## Development

### Project Structure

```
kindle-sync/
├── src/
│   ├── api/
│   │   └── kindle-client.ts       # Kindle API wrapper
│   ├── exporters/
│   │   └── markdown.ts            # Markdown generator
│   ├── sync/
│   │   └── sync-manager.ts        # Sync orchestration
│   ├── utils/
│   │   └── config.ts              # Configuration loader
│   ├── types/
│   │   └── index.ts               # TypeScript definitions
│   └── index.ts                   # CLI entry point
├── config.example.json            # Configuration template
├── .env.example                   # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

### Development Scripts

```bash
# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run built version
npm start

# Lint code
npm run lint

# Format code
npm run format
```

## Troubleshooting

### Authentication Issues

If you encounter authentication errors:

1. **Check credentials**: Verify your email and password in `.env`
2. **Two-factor authentication**: If you have 2FA enabled, you may need an app-specific password
3. **CAPTCHA**: Web scraping may fail if Amazon presents a CAPTCHA. Try again later.
4. **Marketplace**: Ensure `AMAZON_MARKETPLACE` matches your account region

### No Highlights Found

- Make sure you've highlighted text in your Kindle books
- Check that you're logged into the correct Amazon account
- Visit `https://kindle.amazon.com/kp/notebook` to verify highlights exist

### File Sync Issues

- Verify `obsidianVaultPath` in `config.json` exists
- Check file permissions for the output directory
- Enable `updateExisting` in config if files aren't updating

## Future Enhancements

See [FUTURE.md](./FUTURE.md) for planned enhancements including:
- Enhanced web scraping with Playwright
- Support for My Clippings.txt parsing
- Browser extension for easier authentication
- Real-time sync with file watching

## Security Note

Your Amazon credentials are stored locally in `.env` and never transmitted except to Amazon's servers for authentication. The `.env` file is gitignored by default to prevent accidental commits.

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Support

For issues and questions, please open a GitHub issue.
