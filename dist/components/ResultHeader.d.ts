import type { ColumnInfo } from '../types.js';
interface ResultHeaderProps {
    columns: ColumnInfo[];
    needsLeftScroll?: boolean;
    needsRightScroll?: boolean;
}
export declare const ResultHeader: ({ columns, needsLeftScroll, needsRightScroll }: ResultHeaderProps) => import("react/jsx-runtime").JSX.Element;
export {};
