#!/usr/bin/env node
import React, { useState, useEffect, useMemo } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput, { type Decoration } from 'ink-mini-code-editor';
import pg from 'pg';
import { QueryResults } from './components/index.js';
import { parseQueryResult, type QueryResultData } from './types.js';
import { TEST_QUERY_RESULT } from './testdata.js';
import { loadSchema, createEmptySchema, getSuggestion, type DatabaseSchema } from './autocomplete/index.js';
import { runHeadless } from './headless.js';

type AppState = 'username' | 'password' | 'connecting' | 'connected' | 'executing' | 'results' | 'error';

interface ConnectionConfig {
	host: string;
	port: number;
	database: string;
}

interface QueryError {
	message: string;
	position?: number; // 1-indexed character position from PostgreSQL
	hint?: string;
	severity?: 'ERROR' | 'WARNING' | 'NOTICE';
	source: 'client' | 'server';
}

interface AppProps {
	config: ConnectionConfig;
}

function parseJdbcUrl(url: string): ConnectionConfig {
	// Parse jdbc:postgresql://host:port/database
	const match = url.match(/^jdbc:postgresql:\/\/([^:]+):(\d+)\/(.+)$/);
	if (!match) {
		throw new Error(`Invalid JDBC URL format. Expected: jdbc:postgresql://host:port/database`);
	}
	return {
		host: match[1],
		port: parseInt(match[2], 10),
		database: match[3],
	};
}

const App = ({ config }: AppProps) => {
	const { exit } = useApp();
	const [state, setState] = useState<AppState>('username');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string>('');
	const [client, setClient] = useState<pg.Client | null>(null);
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<QueryResultData | null>(null);
	const [queryErrors, setQueryErrors] = useState<QueryError[]>([]);
	const [schema, setSchema] = useState<DatabaseSchema | null>(null);

	// Query history state
	const [history, setHistory] = useState<string[]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1); // -1 means "new query" mode
	const [draft, setDraft] = useState(''); // Stores current input when navigating history

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			if (client) {
				client.end();
			}
			exit();
		}

		// History navigation only when in connected state (query editor active)
		if (state === 'connected' && history.length > 0) {
			if (key.upArrow) {
				if (historyIndex === -1) {
					// Starting to navigate history - save current query as draft
					setDraft(query);
					// Go to most recent history item
					setHistoryIndex(history.length - 1);
					setQuery(history[history.length - 1]);
				} else if (historyIndex > 0) {
					// Go to older history item
					setHistoryIndex(historyIndex - 1);
					setQuery(history[historyIndex - 1]);
				}
			}

			if (key.downArrow) {
				if (historyIndex !== -1) {
					if (historyIndex < history.length - 1) {
						// Go to newer history item
						setHistoryIndex(historyIndex + 1);
						setQuery(history[historyIndex + 1]);
					} else {
						// Back to draft (new query mode)
						setHistoryIndex(-1);
						setQuery(draft);
					}
				}
			}
		}
	});

	const handleUsernameSubmit = () => {
		setState('password');
	};

	const handlePasswordSubmit = () => {
		setState('connecting');
	};

	useEffect(() => {
		if (state !== 'connecting') return;

		let isCancelled = false;

		const newClient = new pg.Client({
			host: config.host,
			port: config.port,
			database: config.database,
			user: username,
			password: password,
		});

		newClient
			.connect()
			.then(() => {
				if (!isCancelled) {
					setClient(newClient);
					setState('connected');
				} else {
					// Connection completed but we've moved on, close it
					newClient.end().catch(() => {});
				}
			})
			.catch((err) => {
				if (!isCancelled) {
					setError(err.message);
					setState('error');
				}
			});

		return () => {
			isCancelled = true;
			// Don't close newClient here - if connection succeeds,
			// it will be stored in state and closed on app exit
		};
	}, [state, config, username, password]);

	// Load schema after connection for autocomplete
	useEffect(() => {
		if (state === 'connected' && client && !schema) {
			loadSchema(client)
				.then(setSchema)
				.catch(() => {
					// Graceful degradation: use empty schema with keywords/functions
					setSchema(createEmptySchema());
				});
		}
	}, [state, client, schema]);

	// Server-side validation errors only
	const allErrors = queryErrors;

	// Constants for error display - only show text for errors, not warnings (to prevent layout shift while typing)
	const MAX_VISIBLE_ERRORS = 3;
	const displayableErrors = allErrors.filter((e) => e.severity !== 'WARNING');
	const visibleErrors = displayableErrors.slice(0, MAX_VISIBLE_ERRORS);
	const hiddenErrorCount = displayableErrors.length - MAX_VISIBLE_ERRORS;

	const handleQuerySubmit = async () => {
		if (!client || !query.trim()) return;

		const executedQuery = query.trim();
		setQueryErrors([]);
		setState('executing');

		const startTime = performance.now();
		try {
			const result = await client.query(executedQuery);
			const executionTime = performance.now() - startTime;
			const parsed = parseQueryResult(result, executionTime);
			setResults(parsed);
			setState('results');

			// Add to history if it's not a duplicate of the last entry
			setHistory((prev) => {
				if (prev.length === 0 || prev[prev.length - 1] !== executedQuery) {
					return [...prev, executedQuery];
				}
				return prev;
			});

			// Reset history navigation state
			setHistoryIndex(-1);
			setDraft('');
		} catch (err) {
			const pgError = err as {
				message: string;
				position?: string;
				hint?: string;
				severity?: string;
			};

			setQueryErrors([
				{
					message: pgError.message,
					position: pgError.position ? parseInt(pgError.position, 10) : undefined,
					hint: pgError.hint,
					severity: (pgError.severity as QueryError['severity']) || 'ERROR',
					source: 'server',
				},
			]);
			setState('connected');
		}
	};

	const handleBackToQuery = () => {
		setResults(null);
		setState('connected');
	};

	// Generate decorations from all errors
	const errorDecorations = useMemo((): Decoration[] | undefined => {
		if (allErrors.length === 0) return undefined;

		const decorations: Decoration[] = [];
		for (const error of allErrors) {
			if (error.position === undefined) continue;
			const pos = error.position - 1; // Convert to 0-indexed
			if (pos < 0 || pos >= query.length) continue;

			// Find word boundaries at error position
			const afterError = query.slice(pos);
			const wordMatch = afterError.match(/^\w+/);
			const length = wordMatch ? wordMatch[0].length : 1;

			const style = error.severity === 'WARNING' ? 'warning' : 'error';

			decorations.push({
				start: pos,
				end: Math.min(pos + length, query.length),
				style,
			});
		}

		return decorations.length > 0 ? decorations : undefined;
	}, [allErrors, query]);

	// Clear server errors when user edits (client errors auto-recompute)
	const handleQueryChange = (newValue: string) => {
		setQuery(newValue);
		if (queryErrors.some((e) => e.source === 'server')) {
			setQueryErrors([]);
		}
	};

	// Error state
	if (state === 'error') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="red">Connection Failed</Text>
				<Text color="red">{error}</Text>
				<Box marginTop={1}>
					<Text dimColor>Press Ctrl+C to exit</Text>
				</Box>
			</Box>
		);
	}

	// Connecting state
	if (state === 'connecting') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>QuickQuery</Text>
				<Text dimColor>{config.host}:{config.port}/{config.database}</Text>
				<Box marginTop={1}>
					<Text color="yellow">Connecting...</Text>
				</Box>
			</Box>
		);
	}

	// Executing query state
	if (state === 'executing') {
		return (
			<Box flexDirection="column" padding={1}>
				<Box>
					<Text bold color="green">Connected</Text>
					<Text dimColor> {username}@{config.host}:{config.port}/{config.database}</Text>
				</Box>
				<Box marginTop={1}>
					<Text color="yellow">Executing query...</Text>
				</Box>
			</Box>
		);
	}

	// Results state
	if (state === 'results' && results) {
		return (
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1}>
					<Text bold color="green">Connected</Text>
					<Text dimColor> {username}@{config.host}:{config.port}/{config.database}</Text>
				</Box>
				<QueryResults data={results} onBack={handleBackToQuery} />
			</Box>
		);
	}

	// Connected - show query editor
	if (state === 'connected') {
		return (
			<Box flexDirection="column" padding={1}>
				<Box>
					<Text bold color="green">Connected</Text>
					<Text dimColor> {username}@{config.host}:{config.port}/{config.database}</Text>
				</Box>
				{/* Editor */}
				<Box marginTop={1} flexDirection="column">
					<Text dimColor>Enter SQL query (press Enter to execute):</Text>
					<Box>
						<Text color="cyan">{"> "}</Text>
						<TextInput
							value={query}
							onChange={handleQueryChange}
							onSubmit={handleQuerySubmit}
							language="sql"
							placeholder="SELECT * FROM ..."
							decorations={errorDecorations}
							getSuggestion={schema ? (value: string) => getSuggestion(value, schema) : undefined}
						/>
					</Box>
				</Box>
				{/* Errors - below editor, max 3 descriptions - always reserve space to prevent layout shift */}
				<Box marginTop={1} flexDirection="column">
					{visibleErrors.length > 0 ? (
						<>
							{visibleErrors.map((error, idx) => (
								<Box key={idx} flexDirection="column">
									<Text color={error.severity === 'WARNING' ? 'yellow' : 'red'}>
										{error.severity === 'WARNING' ? 'Warning' : 'Error'}: {error.message}
									</Text>
									{error.hint && <Text color="cyan">  Hint: {error.hint}</Text>}
								</Box>
							))}
							{hiddenErrorCount > 0 && (
								<Text dimColor>({hiddenErrorCount}) more error{hiddenErrorCount > 1 ? 's' : ''}...</Text>
							)}
						</>
					) : (
						<Text> </Text>
					)}
				</Box>
				{/* Hints footer */}
				<Box marginTop={1}>
					<Text dimColor>↑↓ history • Enter execute • Ctrl+C exit</Text>
					{historyIndex !== -1 && (
						<Text dimColor color="yellow"> ({historyIndex + 1}/{history.length})</Text>
					)}
				</Box>
			</Box>
		);
	}

	// Login prompts
	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>QuickQuery</Text>
			<Text dimColor>{config.host}:{config.port}/{config.database}</Text>
			<Box marginTop={1} flexDirection="column">
				<Box>
					<Text>Username: </Text>
					{state === 'username' ? (
						<TextInput
							value={username}
							onChange={setUsername}
							onSubmit={handleUsernameSubmit}
							placeholder="Enter username"
						/>
					) : (
						<Text>{username}</Text>
					)}
				</Box>
				{state === 'password' && (
					<Box>
						<Text>Password: </Text>
						<TextInput
							value={password}
							onChange={setPassword}
							onSubmit={handlePasswordSubmit}
							placeholder="Enter password"
							mask="*"
						/>
					</Box>
				)}
			</Box>
		</Box>
	);
};

// Test mode component
const TestApp = () => {
	const { exit } = useApp();

	const handleBack = () => {
		exit();
	};

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			exit();
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color="yellow">Test Mode</Text>
				<Text dimColor> - Displaying sample data</Text>
			</Box>
			<QueryResults data={TEST_QUERY_RESULT} onBack={handleBack} />
		</Box>
	);
};

// Parse CLI arguments
const args = process.argv.slice(2);

interface ParsedArgs {
	databaseUrl: string | null;
	testTable: boolean;
	headless: boolean;
	command: string | null;
	user: string | null;
	password: string | null;
}

function parseArgs(args: string[]): ParsedArgs {
	const result: ParsedArgs = {
		databaseUrl: null,
		testTable: false,
		headless: false,
		command: null,
		user: null,
		password: null,
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === '--test-table') {
			result.testTable = true;
		} else if (arg === '--headless') {
			result.headless = true;
		} else if (arg === '-c' || arg === '--command') {
			result.command = args[++i] || null;
		} else if (arg === '-u' || arg === '--user') {
			result.user = args[++i] || null;
		} else if (arg === '-p' || arg === '--password') {
			result.password = args[++i] || null;
		} else if (!arg.startsWith('-') && !result.databaseUrl) {
			result.databaseUrl = arg;
		}
	}

	return result;
}

const parsed = parseArgs(args);

// Check for --test-table flag
if (parsed.testTable) {
	render(<TestApp />);
} else if (parsed.headless) {
	// Headless mode: connect, execute, print results, exit
	if (!parsed.databaseUrl) {
		console.error('Error: Database URL is required for headless mode');
		console.error('');
		console.error('Usage: qq --headless <database-url> -c "<sql-query>"');
		console.error('');
		console.error('Options:');
		console.error('  -c, --command <query>   SQL query to execute');
		console.error('  -u, --user <username>   Database username (or set PGUSER)');
		console.error('  -p, --password <pass>   Database password (or set PGPASSWORD)');
		process.exit(1);
	}

	if (!parsed.command) {
		console.error('Error: Query is required for headless mode');
		console.error('');
		console.error('Usage: qq --headless <database-url> -c "<sql-query>"');
		process.exit(1);
	}

	const user = parsed.user || process.env.PGUSER;
	const password = parsed.password || process.env.PGPASSWORD;

	if (!user || !password) {
		console.error('Error: Username and password are required');
		console.error('');
		console.error('Provide via flags (-u, -p) or environment variables (PGUSER, PGPASSWORD)');
		process.exit(1);
	}

	let config: ConnectionConfig;
	try {
		config = parseJdbcUrl(parsed.databaseUrl!);
	} catch (err) {
		console.error((err as Error).message);
		process.exit(1);
	}

	runHeadless({
		host: config!.host,
		port: config!.port,
		database: config!.database,
		user,
		password,
		query: parsed.command!,
	});
} else {
	const databaseUrl = parsed.databaseUrl;

	if (!databaseUrl) {
		console.error('Usage: qq <database-url>');
		console.error('       qq --headless <database-url> -c "<sql-query>"');
		console.error('       qq --test-table');
		console.error('');
		console.error('Examples:');
		console.error('  qq jdbc:postgresql://localhost:5432/postgres');
		console.error('  qq --headless jdbc:postgresql://localhost:5432/postgres -c "SELECT * FROM users"');
		console.error('  qq --test-table    # Test table display with sample data');
		process.exit(1);
	}

	let config: ConnectionConfig;
	try {
		config = parseJdbcUrl(databaseUrl);
	} catch (err) {
		console.error((err as Error).message);
		process.exit(1);
	}

	render(<App config={config} />);
}
