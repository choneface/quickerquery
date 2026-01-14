import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export const ResultFooter = ({ columns, rowCount, executionTime, viewStart, viewEnd, colStart, colEnd, totalColumns }) => {
    const bottomBorder = buildBorder(columns, '└', '┴', '┘');
    const hasHorizontalScroll = totalColumns > (colEnd - colStart);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "gray", children: ' ' + bottomBorder }), _jsxs(Box, { marginTop: 1, gap: 2, children: [_jsxs(Text, { dimColor: true, children: ["Rows ", viewStart + 1, "-", Math.min(viewEnd, rowCount), " of ", rowCount] }), hasHorizontalScroll && (_jsxs(Text, { dimColor: true, children: ["Cols ", colStart + 1, "-", colEnd, " of ", totalColumns] })), _jsxs(Text, { dimColor: true, children: ["(", executionTime.toFixed(0), "ms)"] })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "\u2191\u2193 rows \u2022 \u2190\u2192 columns \u2022 PgUp/PgDn page \u2022 q back" }) })] }));
};
function buildBorder(columns, left, mid, right) {
    const segments = columns.map((col) => '─'.repeat(col.width + 2));
    return left + segments.join(mid) + right;
}
