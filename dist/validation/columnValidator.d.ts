import type { DatabaseSchema } from '../autocomplete/types.js';
export interface ValidationError {
    message: string;
    position: number;
    endPosition: number;
    severity: 'error' | 'warning';
    hint?: string;
}
/**
 * Validate column references against the schema
 */
export declare function validateColumns(query: string, schema: DatabaseSchema): ValidationError[];
