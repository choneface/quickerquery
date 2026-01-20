import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { ResultCell } from './ResultCell.js';
export const ResultRow = ({ row, columns, isSelected = false, needsRightScroll = false }) => {
    return (_jsxs(Box, { children: [_jsx(Text, { children: isSelected ? '>' : ' ' }), _jsx(Text, { color: "gray", children: "\u2502" }), columns.map((col, idx) => (_jsxs(Box, { children: [_jsx(Text, { children: " " }), _jsx(ResultCell, { value: row[col.name], width: col.width }), _jsx(Text, { children: " " }), _jsx(Text, { color: "gray", children: "\u2502" })] }, idx))), needsRightScroll && _jsx(Text, { color: "cyan", children: '>' })] }));
};
