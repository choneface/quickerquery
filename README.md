# QuickQuery

A terminal-based database query tool inspired by JetBrains DataGrip. Query databases directly from the terminal with syntax highlighting, result tables, and connection management—without leaving your workflow.

## Features

- **PostgreSQL support** - Connect to PostgreSQL databases via JDBC URL
- **Syntax highlighting** - SQL editor with code highlighting in the terminal
- **Secure authentication** - Masked password input for secure credential entry
- **Keyboard-driven** - Fast, distraction-free interface built for developers
- **Lightweight** - Minimal dependencies, quick startup time

## Installation

```bash
# Install globally via npm
npm install -g quickerquery

# Or with pnpm
pnpm add -g quickerquery
```

## Usage

```bash
qq <database-url>
```

### Example

```bash
qq jdbc:postgresql://localhost:5432/mydb
```

The tool will prompt you for:
1. **Username** - Your database username
2. **Password** - Your database password (input is masked)

Once connected, you'll have a SQL editor where you can write and execute queries.

### Controls

- **Enter** - Execute query
- **Ctrl+C** - Exit the application

## Development

### Prerequisites

- Node.js 22+
- pnpm

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/quickquery.git
cd quickquery

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Run the built version
pnpm start
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run in development mode with hot reload |
| `pnpm build` | Compile TypeScript to JavaScript |
| `pnpm start` | Run the compiled application |

## Tech Stack

- **React** + **Ink** - Terminal UI framework
- **TypeScript** - Type-safe development
- **pg** - PostgreSQL client
- **ink-mini-code-editor** - Syntax-highlighted code editor for terminal

## Roadmap

- [ ] Query execution and result display
- [ ] Query history
- [ ] Multi-line query support
- [ ] Result pagination
- [ ] MySQL support
- [ ] SQLite support
- [ ] Connection profiles/saved connections

## License

MIT
