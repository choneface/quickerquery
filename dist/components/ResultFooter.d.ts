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
export declare const ResultFooter: ({ columns, rowCount, executionTime, viewStart, viewEnd, colStart, colEnd, totalColumns }: ResultFooterProps) => import("react/jsx-runtime").JSX.Element;
export {};
