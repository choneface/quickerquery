import React from 'react';
import { Box, Text } from 'ink';
import { truncate } from '../types.js';
import type { ColumnInfo } from '../types.js';

interface ResultHeaderProps {
	columns: ColumnInfo[];
	needsLeftScroll?: boolean;
	needsRightScroll?: boolean;
}

export const ResultHeader = ({ columns, needsLeftScroll = false, needsRightScroll = false }: ResultHeaderProps) => {
	const topBorder = buildBorder(columns, '┌', '┬', '┐');
	const bottomBorder = buildBorder(columns, '├', '┼', '┤');
	const scrollIndicator = needsLeftScroll ? '◀' : ' ';

	return (
		<Box flexDirection="column">
			<Text color="gray">{scrollIndicator + topBorder}</Text>
			<Box>
				<Text color="cyan">{needsLeftScroll ? '◀' : ' '}</Text>
				<Text color="gray">│</Text>
				{columns.map((col, idx) => (
					<Box key={col.name}>
						<Text> </Text>
						<Text bold color="white">
							{truncate(col.name, col.width).padEnd(col.width)}
						</Text>
						<Text> </Text>
						<Text color="gray">│</Text>
					</Box>
				))}
				{needsRightScroll && <Text color="cyan">▶</Text>}
			</Box>
			<Text color="gray">{scrollIndicator + bottomBorder}</Text>
		</Box>
	);
};

function buildBorder(columns: ColumnInfo[], left: string, mid: string, right: string): string {
	const segments = columns.map((col) => '─'.repeat(col.width + 2));
	return left + segments.join(mid) + right;
}
