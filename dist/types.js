export function parseQueryResult(result, executionTime) {
    const columns = result.fields.map((field) => ({
        name: field.name,
        dataTypeID: field.dataTypeID,
        width: field.name.length,
    }));
    // Calculate column widths based on data
    for (const row of result.rows) {
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const value = row[col.name];
            const strValue = formatValue(value);
            col.width = Math.max(col.width, strValue.length);
        }
    }
    // Cap column widths at a reasonable maximum
    const MAX_COL_WIDTH = 40;
    for (const col of columns) {
        col.width = Math.min(col.width, MAX_COL_WIDTH);
    }
    return {
        columns,
        rows: result.rows,
        rowCount: result.rowCount ?? result.rows.length,
        executionTime,
    };
}
export function formatValue(value) {
    if (value === null) {
        return 'NULL';
    }
    if (value === undefined) {
        return '';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}
export function getCellType(value) {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'null';
    if (typeof value === 'boolean')
        return 'boolean';
    if (typeof value === 'number')
        return 'number';
    if (value instanceof Date)
        return 'date';
    if (typeof value === 'object')
        return 'json';
    if (typeof value === 'string')
        return 'string';
    return 'unknown';
}
export function truncate(str, maxLength) {
    if (str.length <= maxLength) {
        return str;
    }
    return str.slice(0, maxLength - 1) + '…';
}
export function padCell(value, width, type) {
    const truncated = truncate(value, width);
    // Right-align numbers, left-align everything else
    if (type === 'number') {
        return truncated.padStart(width);
    }
    return truncated.padEnd(width);
}
/**
 * Calculate the total width a table would take given columns.
 * Each column takes: 1 space + content + 1 space + 1 border (│)
 * Plus: 1 selection indicator + 1 initial border
 */
export function calculateTableWidth(columns) {
    // Selection indicator (1) + initial border (1) + each column (width + 3 for " content │")
    return 2 + columns.reduce((sum, col) => sum + col.width + 3, 0);
}
/**
 * Fit columns to available terminal width by proportionally shrinking if needed.
 * Returns new column array with adjusted widths.
 */
/**
 * Calculate how many columns can fit starting from a given offset.
 * Returns the end index (exclusive) for slicing.
 */
export function getVisibleColumnRange(columns, startIdx, terminalWidth) {
    const FIXED_OVERHEAD = 2; // Selection indicator + initial border
    const PER_COL_OVERHEAD = 3; // " " + content + " │"
    let usedWidth = FIXED_OVERHEAD;
    let endIdx = startIdx;
    for (let i = startIdx; i < columns.length; i++) {
        const colWidth = columns[i].width + PER_COL_OVERHEAD;
        if (usedWidth + colWidth > terminalWidth) {
            break;
        }
        usedWidth += colWidth;
        endIdx = i + 1;
    }
    // Ensure at least one column is visible
    if (endIdx === startIdx && startIdx < columns.length) {
        endIdx = startIdx + 1;
    }
    return {
        endIdx,
        needsLeftScroll: startIdx > 0,
        needsRightScroll: endIdx < columns.length,
    };
}
export function fitColumnsToWidth(columns, terminalWidth) {
    const MIN_COL_WIDTH = 3; // Minimum readable width
    const FIXED_OVERHEAD = 2; // Selection indicator + initial border
    const PER_COL_OVERHEAD = 3; // " " + content + " │"
    // Available width for actual content
    const totalOverhead = FIXED_OVERHEAD + columns.length * PER_COL_OVERHEAD;
    const availableContentWidth = terminalWidth - totalOverhead;
    // Current total content width
    const currentContentWidth = columns.reduce((sum, col) => sum + col.width, 0);
    // If it fits, return as-is
    if (currentContentWidth <= availableContentWidth) {
        return columns;
    }
    // Need to shrink - calculate proportionally
    const scaleFactor = availableContentWidth / currentContentWidth;
    // First pass: scale proportionally, enforce minimum
    let adjusted = columns.map((col) => ({
        ...col,
        width: Math.max(MIN_COL_WIDTH, Math.floor(col.width * scaleFactor)),
    }));
    // Second pass: if we're still over, trim largest columns first
    let adjustedTotal = adjusted.reduce((sum, col) => sum + col.width, 0);
    while (adjustedTotal > availableContentWidth && adjustedTotal > columns.length * MIN_COL_WIDTH) {
        // Find the widest column that's above minimum
        let maxIdx = -1;
        let maxWidth = MIN_COL_WIDTH;
        for (let i = 0; i < adjusted.length; i++) {
            if (adjusted[i].width > maxWidth) {
                maxWidth = adjusted[i].width;
                maxIdx = i;
            }
        }
        if (maxIdx === -1)
            break; // All at minimum
        adjusted[maxIdx] = { ...adjusted[maxIdx], width: adjusted[maxIdx].width - 1 };
        adjustedTotal--;
    }
    return adjusted;
}
