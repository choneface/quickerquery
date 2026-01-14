import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { truncate } from '../types.js';
export const ResultHeader = ({ columns, needsLeftScroll = false, needsRightScroll = false }) => {
    const topBorder = buildBorder(columns, '┌', '┬', '┐');
    const bottomBorder = buildBorder(columns, '├', '┼', '┤');
    const scrollIndicator = needsLeftScroll ? '◀' : ' ';
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "gray", children: scrollIndicator + topBorder }), _jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: needsLeftScroll ? '◀' : ' ' }), _jsx(Text, { color: "gray", children: "\u2502" }), columns.map((col, idx) => (_jsxs(Box, { children: [_jsx(Text, { children: " " }), _jsx(Text, { bold: true, color: "white", children: truncate(col.name, col.width).padEnd(col.width) }), _jsx(Text, { children: " " }), _jsx(Text, { color: "gray", children: "\u2502" })] }, col.name))), needsRightScroll && _jsx(Text, { color: "cyan", children: "\u25B6" })] }), _jsx(Text, { color: "gray", children: scrollIndicator + bottomBorder })] }));
};
function buildBorder(columns, left, mid, right) {
    const segments = columns.map((col) => '─'.repeat(col.width + 2));
    return left + segments.join(mid) + right;
}
