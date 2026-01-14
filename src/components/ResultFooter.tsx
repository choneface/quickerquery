import React from 'react';
import { Box, Text } from 'ink';
import type { ColumnInfo } from '../types.js';

interface ResultFooterProps {
	columns: ColumnInfo[];
	rowCount: number;
	executionTime: number;
	viewStart: number;
	viewEnd: number;
	colStart: number;
	colEnd: number;
	totalColumns: number;
}

export const ResultFooter = ({ columns, rowCount, executionTime, viewStart, viewEnd, colStart, colEnd, totalColumns }: ResultFooterProps) => {
	const bottomBorder = buildBorder(columns, '└', '┴', '┘');
	const hasHorizontalScroll = totalColumns > (colEnd - colStart);

	return (
		<Box flexDirection="column">
			<Text color="gray">{' ' + bottomBorder}</Text>
			<Box marginTop={1} gap={2}>
				<Text dimColor>
					Rows {viewStart + 1}-{Math.min(viewEnd, rowCount)} of {rowCount}
				</Text>
				{hasHorizontalScroll && (
					<Text dimColor>
						Cols {colStart + 1}-{colEnd} of {totalColumns}
					</Text>
				)}
				<Text dimColor>({executionTime.toFixed(0)}ms)</Text>
			</Box>
			<Box marginTop={1}>
				<Text dimColor>↑↓ rows • ←→ columns • PgUp/PgDn page • q back</Text>
			</Box>
		</Box>
	);
};

function buildBorder(columns: ColumnInfo[], left: string, mid: string, right: string): string {
	const segments = columns.map((col) => '─'.repeat(col.width + 2));
	return left + segments.join(mid) + right;
}
