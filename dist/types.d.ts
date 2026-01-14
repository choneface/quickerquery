import type { QueryResult } from 'pg';
export interface ColumnInfo {
    name: string;
    dataTypeID: number;
    width: number;
}
export interface QueryResultData {
    columns: ColumnInfo[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTime: number;
}
export interface CellValue {
    value: unknown;
    type: 'string' | 'number' | 'boolean' | 'null' | 'date' | 'json' | 'unknown';
}
export declare function parseQueryResult(result: QueryResult, executionTime: number): QueryResultData;
export declare function formatValue(value: unknown): string;
export declare function getCellType(value: unknown): CellValue['type'];
export declare function truncate(str: string, maxLength: number): string;
export declare function padCell(value: string, width: number, type: CellValue['type']): string;
/**
 * Calculate the total width a table would take given columns.
 * Each column takes: 1 space + content + 1 space + 1 border (│)
 * Plus: 1 selection indicator + 1 initial border
 */
export declare function calculateTableWidth(columns: ColumnInfo[]): number;
/**
 * Fit columns to available terminal width by proportionally shrinking if needed.
 * Returns new column array with adjusted widths.
 */
/**
 * Calculate how many columns can fit starting from a given offset.
 * Returns the end index (exclusive) for slicing.
 */
export declare function getVisibleColumnRange(columns: ColumnInfo[], startIdx: number, terminalWidth: number): {
    endIdx: number;
    needsLeftScroll: boolean;
    needsRightScroll: boolean;
};
export declare function fitColumnsToWidth(columns: ColumnInfo[], terminalWidth: number): ColumnInfo[];
