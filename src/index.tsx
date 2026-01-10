#!/usr/bin/env node
import React, { useState } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-mini-code-editor';

type ConnectionState = 'username' | 'password' | 'done';

interface AppProps {
	databaseUrl: string;
}

const App = ({ databaseUrl }: AppProps) => {
	const { exit } = useApp();
	const [state, setState] = useState<ConnectionState>('username');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			exit();
		}
	});

	const handleUsernameSubmit = () => {
		setState('password');
	};

	const handlePasswordSubmit = () => {
		setState('done');
	};

	if (state === 'done') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="green">Connection Details:</Text>
				<Text>  URL:      {databaseUrl}</Text>
				<Text>  Username: {username}</Text>
				<Text>  Password: {'*'.repeat(password.length)}</Text>
				<Box marginTop={1}>
					<Text dimColor>Press Ctrl+C to exit</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>QuickQuery</Text>
			<Text dimColor>{databaseUrl}</Text>
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

// Parse CLI arguments
const args = process.argv.slice(2);
const databaseUrl = args[0];

if (!databaseUrl) {
	console.error('Usage: qq <database-url>');
	console.error('Example: qq jdbc:postgresql://localhost:5432/postgres');
	process.exit(1);
}

render(<App databaseUrl={databaseUrl} />);
