#!/usr/bin/env node
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-mini-code-editor';
import pg from 'pg';
import { QueryResults } from './components/index.js';
import { parseQueryResult } from './types.js';
import { TEST_QUERY_RESULT } from './testdata.js';
function parseJdbcUrl(url) {
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
const App = ({ config }) => {
    const { exit } = useApp();
    const [state, setState] = useState('username');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [client, setClient] = useState(null);
    const [query, setQuery] = useState('SELECT 1');
    const [results, setResults] = useState(null);
    const [queryError, setQueryError] = useState('');
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
        if (state !== 'connecting')
            return;
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
            }
            else {
                // Connection completed but we've moved on, close it
                newClient.end().catch(() => { });
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
        if (!client || !query.trim())
            return;
        setQueryError('');
        setState('executing');
        const startTime = performance.now();
        try {
            const result = await client.query(query);
            const executionTime = performance.now() - startTime;
            const parsed = parseQueryResult(result, executionTime);
            setResults(parsed);
            setState('results');
        }
        catch (err) {
            setQueryError(err.message);
            setState('connected');
        }
    };
    const handleBackToQuery = () => {
        setResults(null);
        setState('connected');
    };
    // Error state
    if (state === 'error') {
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, color: "red", children: "Connection Failed" }), _jsx(Text, { color: "red", children: error }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press Ctrl+C to exit" }) })] }));
    }
    // Connecting state
    if (state === 'connecting') {
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, children: "QuickQuery" }), _jsxs(Text, { dimColor: true, children: [config.host, ":", config.port, "/", config.database] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "yellow", children: "Connecting..." }) })] }));
    }
    // Executing query state
    if (state === 'executing') {
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "green", children: "Connected" }), _jsxs(Text, { dimColor: true, children: [" ", username, "@", config.host, ":", config.port, "/", config.database] })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "yellow", children: "Executing query..." }) })] }));
    }
    // Results state
    if (state === 'results' && results) {
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "green", children: "Connected" }), _jsxs(Text, { dimColor: true, children: [" ", username, "@", config.host, ":", config.port, "/", config.database] })] }), _jsx(QueryResults, { data: results, onBack: handleBackToQuery })] }));
    }
    // Connected - show query editor
    if (state === 'connected') {
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "green", children: "Connected" }), _jsxs(Text, { dimColor: true, children: [" ", username, "@", config.host, ":", config.port, "/", config.database] })] }), queryError && (_jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { bold: true, color: "red", children: "Query Error" }), _jsx(Text, { color: "red", children: queryError })] })), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: "Enter SQL query (press Enter to execute):" }), _jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: "> " }), _jsx(TextInput, { value: query, onChange: setQuery, onSubmit: handleQuerySubmit, language: "sql", placeholder: "SELECT * FROM ..." })] })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Ctrl+C to exit" }) })] }));
    }
    // Login prompts
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, children: "QuickQuery" }), _jsxs(Text, { dimColor: true, children: [config.host, ":", config.port, "/", config.database] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { children: "Username: " }), state === 'username' ? (_jsx(TextInput, { value: username, onChange: setUsername, onSubmit: handleUsernameSubmit, placeholder: "Enter username" })) : (_jsx(Text, { children: username }))] }), state === 'password' && (_jsxs(Box, { children: [_jsx(Text, { children: "Password: " }), _jsx(TextInput, { value: password, onChange: setPassword, onSubmit: handlePasswordSubmit, placeholder: "Enter password", mask: "*" })] }))] })] }));
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
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "yellow", children: "Test Mode" }), _jsx(Text, { dimColor: true, children: " - Displaying sample data" })] }), _jsx(QueryResults, { data: TEST_QUERY_RESULT, onBack: handleBack })] }));
};
// Parse CLI arguments
const args = process.argv.slice(2);
// Check for --test-table flag
if (args.includes('--test-table')) {
    render(_jsx(TestApp, {}));
}
else {
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
    let config;
    try {
        config = parseJdbcUrl(databaseUrl);
    }
    catch (err) {
        console.error(err.message);
        process.exit(1);
    }
    render(_jsx(App, { config: config }));
}
