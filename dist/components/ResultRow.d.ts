import type { ColumnInfo } from '../types.js';
interface ResultRowProps {
    row: Record<string, unknown>;
    columns: ColumnInfo[];
    isSelected?: boolean;
    needsRightScroll?: boolean;
}
export declare const ResultRow: ({ row, columns, isSelected, needsRightScroll }: ResultRowProps) => import("react/jsx-runtime").JSX.Element;
export {};
