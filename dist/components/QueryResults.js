import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { ResultHeader } from './ResultHeader.js';
import { ResultRow } from './ResultRow.js';
import { ResultFooter } from './ResultFooter.js';
import { ScrollIndicator } from './ScrollIndicator.js';
import { fitColumnsToWidth, calculateTableWidth } from '../types.js';
const DEFAULT_VISIBLE_ROWS = 15;
const PAGE_SIZE = 10;
export const QueryResults = ({ data, onBack }) => {
    const { stdout } = useStdout();
    const [view, setView] = useState({ selectedRow: 0, scrollOffset: 0 });
    // Get terminal dimensions
    const terminalHeight = stdout?.rows ?? 24;
    const terminalWidth = stdout?.columns ?? 80;
    // Calculate visible rows based on terminal height (reserve space for header/footer)
    const visibleRows = Math.max(5, Math.min(DEFAULT_VISIBLE_ROWS, terminalHeight - 12));
    // Fit columns to terminal width (memoized to avoid recalculating on every render)
    const fittedColumns = useMemo(() => fitColumnsToWidth(data.columns, terminalWidth - 2), // -2 for scroll indicator
    [data.columns, terminalWidth]);
    // Check if terminal is too narrow to display anything useful
    const minRequiredWidth = calculateTableWidth(data.columns.map((c) => ({ ...c, width: 3 })) // Minimum 3 chars per column
    );
    const isTooNarrow = terminalWidth < minRequiredWidth + 2;
    const maxScroll = Math.max(0, data.rows.length - visibleRows);
    const lastRow = data.rows.length - 1;
    // Helper to update view state while keeping selection in viewport
    const navigate = (newSelected) => {
        setView((prev) => {
            const selected = Math.max(0, Math.min(lastRow, newSelected));
            let offset = prev.scrollOffset;
            // Scroll up if selection moves above viewport
            if (selected < offset) {
                offset = selected;
            }
            // Scroll down if selection moves below viewport
            else if (selected >= offset + visibleRows) {
                offset = Math.min(maxScroll, selected - visibleRows + 1);
            }
            return { selectedRow: selected, scrollOffset: offset };
        });
    };
    useInput((input, key) => {
        if (input === 'q' || key.escape) {
            onBack();
            return;
        }
        if (key.upArrow) {
            navigate(view.selectedRow - 1);
        }
        if (key.downArrow) {
            navigate(view.selectedRow + 1);
        }
        if (key.pageUp) {
            navigate(view.selectedRow - PAGE_SIZE);
        }
        if (key.pageDown) {
            navigate(view.selectedRow + PAGE_SIZE);
        }
        // Home - go to first row
        if (key.ctrl && input === 'a') {
            navigate(0);
        }
        // End - go to last row
        if (key.ctrl && input === 'e') {
            navigate(lastRow);
        }
    });
    const { selectedRow, scrollOffset } = view;
    const visibleData = data.rows.slice(scrollOffset, scrollOffset + visibleRows);
    // Terminal too narrow to display table
    if (isTooNarrow) {
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { color: "yellow", children: "Terminal too narrow to display results." }), _jsxs(Text, { dimColor: true, children: ["Need at least ", minRequiredWidth + 2, " columns, have ", terminalWidth, "."] }), _jsx(Text, { dimColor: true, children: "Resize terminal or reduce number of columns in query." }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press q to go back" }) })] }));
    }
    if (data.rows.length === 0) {
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { color: "yellow", children: "Query executed successfully." }), _jsx(Text, { dimColor: true, children: "No rows returned." }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press q to go back" }) })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(ResultHeader, { columns: fittedColumns }), _jsxs(Box, { children: [_jsx(Box, { flexDirection: "column", children: visibleData.map((row, idx) => (_jsx(ResultRow, { row: row, columns: fittedColumns, isSelected: scrollOffset + idx === selectedRow }, scrollOffset + idx))) }), _jsx(ScrollIndicator, { currentRow: scrollOffset, visibleRows: visibleRows, totalRows: data.rows.length })] }), _jsx(ResultFooter, { columns: fittedColumns, rowCount: data.rowCount, executionTime: data.executionTime, viewStart: scrollOffset, viewEnd: scrollOffset + visibleRows })] }));
};
