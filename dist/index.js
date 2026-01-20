#!/usr/bin/env node
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-mini-code-editor';
import pg from 'pg';
import { QueryResults } from './components/index.js';
import { parseQueryResult } from './types.js';
import { TEST_QUERY_RESULT } from './testdata.js';
import { loadSchema, createEmptySchema, getSuggestion } from './autocomplete/index.js';
import { runHeadless } from './headless.js';
import { validateColumns } from './validation/index.js';
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
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [queryErrors, setQueryErrors] = useState([]);
    const [schema, setSchema] = useState(null);
    // Query history state
    const [history, setHistory] = useState([]);
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
                }
                else if (historyIndex > 0) {
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
                    }
                    else {
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
    // Client-side column validation errors
    const clientValidationErrors = useMemo(() => {
        if (!query.trim() || !schema)
            return [];
        const errors = validateColumns(query, schema);
        return errors.map((err) => ({
            message: err.message,
            position: err.position + 1, // Convert to 1-indexed
            hint: err.hint,
            severity: 'ERROR',
            source: 'client',
        }));
    }, [query, schema]);
    // Merge client and server errors (server takes precedence after submit)
    const allErrors = useMemo(() => {
        const serverErrors = queryErrors.filter((e) => e.source === 'server');
        if (serverErrors.length > 0)
            return serverErrors;
        return clientValidationErrors;
    }, [queryErrors, clientValidationErrors]);
    // Constants for error display - only show text for errors, not warnings (to prevent layout shift while typing)
    const MAX_VISIBLE_ERRORS = 3;
    const displayableErrors = allErrors.filter((e) => e.severity !== 'WARNING');
    const visibleErrors = displayableErrors.slice(0, MAX_VISIBLE_ERRORS);
    const hiddenErrorCount = displayableErrors.length - MAX_VISIBLE_ERRORS;
    const handleQuerySubmit = async () => {
        if (!client || !query.trim())
            return;
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
        }
        catch (err) {
            const pgError = err;
            setQueryErrors([
                {
                    message: pgError.message,
                    position: pgError.position ? parseInt(pgError.position, 10) : undefined,
                    hint: pgError.hint,
                    severity: pgError.severity || 'ERROR',
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
    const errorDecorations = useMemo(() => {
        if (allErrors.length === 0)
            return undefined;
        const decorations = [];
        for (const error of allErrors) {
            if (error.position === undefined)
                continue;
            const pos = error.position - 1; // Convert to 0-indexed
            if (pos < 0 || pos >= query.length)
                continue;
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
    const handleQueryChange = (newValue) => {
        setQuery(newValue);
        if (queryErrors.some((e) => e.source === 'server')) {
            setQueryErrors([]);
        }
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
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "green", children: "Connected" }), _jsxs(Text, { dimColor: true, children: [" ", username, "@", config.host, ":", config.port, "/", config.database] })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: "Enter SQL query (press Enter to execute):" }), _jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: "> " }), _jsx(TextInput, { value: query, onChange: handleQueryChange, onSubmit: handleQuerySubmit, language: "sql", placeholder: "SELECT * FROM ...", decorations: errorDecorations, getSuggestion: schema ? (value) => getSuggestion(value, schema) : undefined })] })] }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: visibleErrors.length > 0 ? (_jsxs(_Fragment, { children: [visibleErrors.map((error, idx) => (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { color: error.severity === 'WARNING' ? 'yellow' : 'red', children: [error.severity === 'WARNING' ? 'Warning' : 'Error', ": ", error.message] }), error.hint && _jsxs(Text, { color: "cyan", children: ["  Hint: ", error.hint] })] }, idx))), hiddenErrorCount > 0 && (_jsxs(Text, { dimColor: true, children: ["(", hiddenErrorCount, ") more error", hiddenErrorCount > 1 ? 's' : '', "..."] }))] })) : (_jsx(Text, { children: " " })) }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { dimColor: true, children: "\u2191\u2193 history \u2022 Enter execute \u2022 Ctrl+C exit" }), historyIndex !== -1 && (_jsxs(Text, { dimColor: true, color: "yellow", children: [" (", historyIndex + 1, "/", history.length, ")"] }))] })] }));
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
function parseArgs(args) {
    const result = {
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
        }
        else if (arg === '--headless') {
            result.headless = true;
        }
        else if (arg === '-c' || arg === '--command') {
            result.command = args[++i] || null;
        }
        else if (arg === '-u' || arg === '--user') {
            result.user = args[++i] || null;
        }
        else if (arg === '-p' || arg === '--password') {
            result.password = args[++i] || null;
        }
        else if (!arg.startsWith('-') && !result.databaseUrl) {
            result.databaseUrl = arg;
        }
    }
    return result;
}
const parsed = parseArgs(args);
// Check for --test-table flag
if (parsed.testTable) {
    render(_jsx(TestApp, {}));
}
else if (parsed.headless) {
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
    let config;
    try {
        config = parseJdbcUrl(parsed.databaseUrl);
    }
    catch (err) {
        console.error(err.message);
        process.exit(1);
    }
    runHeadless({
        host: config.host,
        port: config.port,
        database: config.database,
        user,
        password,
        query: parsed.command,
    });
}
else {
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
