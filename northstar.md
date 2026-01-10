# QuickQuery North Star

A terminal-based database query tool inspired by JetBrains DataGrip. Fast, keyboard-driven, and distraction-free.

## Vision

Query any database directly from the terminal with syntax highlighting, result tables, and connection management—without leaving your workflow.

## MVP Scope

### Phase 1: Core Query Loop

- [ ] Connect to a single PostgreSQL database via connection string
- [ ] SQL editor with syntax highlighting (using ink-mini-code-editor)
- [ ] Execute query on submit (Enter or Ctrl+Enter)
- [ ] Display results in a formatted table
- [ ] Show error messages clearly
- [ ] Exit with Ctrl+C or `:q`

### Phase 2: Usability

- [ ] Query history (up/down arrows to navigate previous queries)
- [ ] Multi-line query support
- [ ] Loading indicator during query execution
- [ ] Row count and execution time display
- [ ] Paginated results for large result sets

### Phase 3: Connection Management

- [ ] Support multiple database types (PostgreSQL, MySQL, SQLite)
- [ ] Save/load connection profiles from config file
- [ ] Switch between saved connections
- [ ] Connection status indicator

## Non-Goals (for MVP)

- Schema browser/tree view
- Table data editing
- Auto-completion
- Query formatting
- Export to CSV/JSON
- Multiple concurrent connections/tabs

## Tech Stack

- **Runtime**: Node.js
- **UI Framework**: Ink (React for CLI)
- **SQL Editor**: ink-mini-code-editor
- **Database Clients**: pg (PostgreSQL), mysql2, better-sqlite3
- **Table Rendering**: cli-table3 or ink-table

## Success Criteria

MVP is complete when a user can:
1. Run `quickquery postgres://user:pass@localhost/mydb`
2. Type a SQL query with syntax highlighting
3. Press Enter to execute
4. See results in a readable table
5. Run another query or exit
