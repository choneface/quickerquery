#!/usr/bin/env node
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-mini-code-editor';
const App = ({ databaseUrl }) => {
    const { exit } = useApp();
    const [state, setState] = useState('username');
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
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, color: "green", children: "Connection Details:" }), _jsxs(Text, { children: ["  URL:      ", databaseUrl] }), _jsxs(Text, { children: ["  Username: ", username] }), _jsxs(Text, { children: ["  Password: ", '*'.repeat(password.length)] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press Ctrl+C to exit" }) })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, children: "QuickQuery" }), _jsx(Text, { dimColor: true, children: databaseUrl }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { children: "Username: " }), state === 'username' ? (_jsx(TextInput, { value: username, onChange: setUsername, onSubmit: handleUsernameSubmit, placeholder: "Enter username" })) : (_jsx(Text, { children: username }))] }), state === 'password' && (_jsxs(Box, { children: [_jsx(Text, { children: "Password: " }), _jsx(TextInput, { value: password, onChange: setPassword, onSubmit: handlePasswordSubmit, placeholder: "Enter password", mask: "*" })] }))] })] }));
};
// Parse CLI arguments
const args = process.argv.slice(2);
const databaseUrl = args[0];
if (!databaseUrl) {
    console.error('Usage: qq <database-url>');
    console.error('Example: qq jdbc:postgresql://localhost:5432/postgres');
    process.exit(1);
}
render(_jsx(App, { databaseUrl: databaseUrl }));
