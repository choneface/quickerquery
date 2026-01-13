#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-mini-code-editor';
import pg from 'pg';
import { QueryResults } from './components/index.js';
import { parseQueryResult, type QueryResultData } from './types.js';
import { TEST_QUERY_RESULT } from './testdata.js';

type AppState = 'username' | 'password' | 'connecting' | 'connected' | 'executing' | 'results' | 'error';

interface ConnectionConfig {
	host: string;
	port: number;
	database: string;
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
	const [query, setQuery] = useState('SELECT 1');
	const [results, setResults] = useState<QueryResultData | null>(null);
	const [queryError, setQueryError] = useState<string>('');

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			if (client) {
				client.end();
			}
			exit();
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

	const handleQuerySubmit = async () => {
		if (!client || !query.trim()) return;

		setQueryError('');
		setState('executing');

		const startTime = performance.now();
		try {
			const result = await client.query(query);
			const executionTime = performance.now() - startTime;
			const parsed = parseQueryResult(result, executionTime);
			setResults(parsed);
			setState('results');
		} catch (err) {
			setQueryError((err as Error).message);
			setState('connected');
		}
	};

	const handleBackToQuery = () => {
		setResults(null);
		setState('connected');
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
				{queryError && (
					<Box marginTop={1} flexDirection="column">
						<Text bold color="red">Query Error</Text>
						<Text color="red">{queryError}</Text>
					</Box>
				)}
				<Box marginTop={1} flexDirection="column">
					<Text dimColor>Enter SQL query (press Enter to execute):</Text>
					<Box>
						<Text color="cyan">{"> "}</Text>
						<TextInput
							value={query}
							onChange={setQuery}
							onSubmit={handleQuerySubmit}
							language="sql"
							placeholder="SELECT * FROM ..."
						/>
					</Box>
				</Box>
				<Box marginTop={1}>
					<Text dimColor>Ctrl+C to exit</Text>
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

// Check for --test-table flag
if (args.includes('--test-table')) {
	render(<TestApp />);
} else {
	const databaseUrl = args[0];

	if (!databaseUrl) {
		console.error('Usage: qq <database-url>');
		console.error('       qq --test-table');
		console.error('');
		console.error('Examples:');
		console.error('  qq jdbc:postgresql://localhost:5432/postgres');
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
