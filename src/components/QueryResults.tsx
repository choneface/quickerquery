import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { ResultHeader } from './ResultHeader.js';
import { ResultRow } from './ResultRow.js';
import { ResultFooter } from './ResultFooter.js';
import { ScrollIndicator } from './ScrollIndicator.js';
import { fitColumnsToWidth, calculateTableWidth, type QueryResultData } from '../types.js';

interface QueryResultsProps {
	data: QueryResultData;
	onBack: () => void;
}

interface ViewState {
	selectedRow: number;
	scrollOffset: number;
}

const DEFAULT_VISIBLE_ROWS = 15;
const PAGE_SIZE = 10;

export const QueryResults = ({ data, onBack }: QueryResultsProps) => {
	const { stdout } = useStdout();
	const [view, setView] = useState<ViewState>({ selectedRow: 0, scrollOffset: 0 });

	// Get terminal dimensions
	const terminalHeight = stdout?.rows ?? 24;
	const terminalWidth = stdout?.columns ?? 80;

	// Calculate visible rows based on terminal height (reserve space for header/footer)
	const visibleRows = Math.max(5, Math.min(DEFAULT_VISIBLE_ROWS, terminalHeight - 12));

	// Fit columns to terminal width (memoized to avoid recalculating on every render)
	const fittedColumns = useMemo(
		() => fitColumnsToWidth(data.columns, terminalWidth - 2), // -2 for scroll indicator
		[data.columns, terminalWidth]
	);

	// Check if terminal is too narrow to display anything useful
	const minRequiredWidth = calculateTableWidth(
		data.columns.map((c) => ({ ...c, width: 3 })) // Minimum 3 chars per column
	);
	const isTooNarrow = terminalWidth < minRequiredWidth + 2;

	const maxScroll = Math.max(0, data.rows.length - visibleRows);
	const lastRow = data.rows.length - 1;

	// Helper to update view state while keeping selection in viewport
	const navigate = (newSelected: number) => {
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
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="yellow">Terminal too narrow to display results.</Text>
				<Text dimColor>
					Need at least {minRequiredWidth + 2} columns, have {terminalWidth}.
				</Text>
				<Text dimColor>Resize terminal or reduce number of columns in query.</Text>
				<Box marginTop={1}>
					<Text dimColor>Press q to go back</Text>
				</Box>
			</Box>
		);
	}

	if (data.rows.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="yellow">Query executed successfully.</Text>
				<Text dimColor>No rows returned.</Text>
				<Box marginTop={1}>
					<Text dimColor>Press q to go back</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<ResultHeader columns={fittedColumns} />
			<Box>
				<Box flexDirection="column">
					{visibleData.map((row, idx) => (
						<ResultRow
							key={scrollOffset + idx}
							row={row}
							columns={fittedColumns}
							isSelected={scrollOffset + idx === selectedRow}
						/>
					))}
				</Box>
				<ScrollIndicator
					currentRow={scrollOffset}
					visibleRows={visibleRows}
					totalRows={data.rows.length}
				/>
			</Box>
			<ResultFooter
				columns={fittedColumns}
				rowCount={data.rowCount}
				executionTime={data.executionTime}
				viewStart={scrollOffset}
				viewEnd={scrollOffset + visibleRows}
			/>
		</Box>
	);
};
