import type { DatabaseSchema } from '../autocomplete/types.js';
import { SQL_KEYWORDS, SQL_FUNCTIONS } from '../autocomplete/keywords.js';

export interface ValidationError {
	message: string;
	position: number;
	endPosition: number;
	severity: 'error' | 'warning';
	hint?: string;
}

interface TableAlias {
	tableName: string;
	alias: string | null;
}

const KEYWORDS_SET = new Set(SQL_KEYWORDS.map((k) => k.toUpperCase()));
const FUNCTIONS_SET = new Set(SQL_FUNCTIONS.map((f) => f.toUpperCase()));

/**
 * Check if a position is inside a string literal
 */
function isInStringLiteral(query: string, position: number): boolean {
	let inString = false;
	for (let i = 0; i < position && i < query.length; i++) {
		if (query[i] === "'") {
			if (i + 1 < query.length && query[i + 1] === "'") {
				i++;
			} else {
				inString = !inString;
			}
		}
	}
	return inString;
}

/**
 * Extract tables and their aliases from the query.
 * Returns both the table name and its alias (if any).
 */
function extractTablesWithAliases(query: string): TableAlias[] {
	const tables: TableAlias[] = [];

	// Match FROM table [AS] alias
	const fromRegex = /\bFROM\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;
	let match;
	while ((match = fromRegex.exec(query)) !== null) {
		const tableName = match[1].toLowerCase();
		const alias = match[2] ? match[2].toLowerCase() : null;
		// Check alias is not a keyword (e.g., FROM users WHERE...)
		if (alias && !KEYWORDS_SET.has(alias.toUpperCase())) {
			tables.push({ tableName, alias });
		} else {
			tables.push({ tableName, alias: null });
		}
	}

	// Match JOIN table [AS] alias
	const joinRegex = /\b(?:LEFT|RIGHT|INNER|OUTER|FULL|CROSS)?\s*JOIN\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;
	while ((match = joinRegex.exec(query)) !== null) {
		const tableName = match[1].toLowerCase();
		const alias = match[2] ? match[2].toLowerCase() : null;
		if (alias && !KEYWORDS_SET.has(alias.toUpperCase())) {
			tables.push({ tableName, alias });
		} else {
			tables.push({ tableName, alias: null });
		}
	}

	return tables;
}

/**
 * Build a map from alias/table name to actual table name
 */
function buildAliasMap(tables: TableAlias[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const { tableName, alias } of tables) {
		map.set(tableName, tableName);
		if (alias) {
			map.set(alias, tableName);
		}
	}
	return map;
}

/**
 * Get all valid column names for a table from the schema
 */
function getTableColumns(tableName: string, schema: DatabaseSchema): Set<string> {
	const columns = new Set<string>();
	const table = schema.tables.find(
		(t) => t.name.toLowerCase() === tableName.toLowerCase()
	);
	if (table) {
		for (const col of table.columns) {
			columns.add(col.name.toLowerCase());
		}
	}
	return columns;
}

/**
 * Get all valid columns across all tables in scope
 */
function getAllColumnsInScope(tables: TableAlias[], schema: DatabaseSchema): Set<string> {
	const allColumns = new Set<string>();
	for (const { tableName } of tables) {
		const cols = getTableColumns(tableName, schema);
		for (const col of cols) {
			allColumns.add(col);
		}
	}
	return allColumns;
}

/**
 * Check if a table exists in the schema
 */
function tableExistsInSchema(tableName: string, schema: DatabaseSchema): boolean {
	return schema.tables.some(
		(t) => t.name.toLowerCase() === tableName.toLowerCase()
	);
}

interface ColumnReference {
	name: string;
	table: string | null; // null for unqualified columns
	position: number;
	endPosition: number;
}

/**
 * Extract all column references from the query.
 * This is the key function that identifies where columns are used.
 */
function extractColumnReferences(query: string, tables: TableAlias[]): ColumnReference[] {
	const refs: ColumnReference[] = [];
	const tableNames = new Set(tables.map((t) => t.tableName));
	const aliasNames = new Set(tables.filter((t) => t.alias).map((t) => t.alias!));
	const tableAndAliasNames = new Set([...tableNames, ...aliasNames]);

	// Find all identifiers in the query
	const identifierRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
	let match;

	// Track positions that are part of table references (to skip them)
	const skipPositions = new Set<number>();

	// Mark table names after FROM and JOIN as skip positions
	const fromJoinRegex = /\b(?:FROM|JOIN)\s+(\w+)/gi;
	while ((match = fromJoinRegex.exec(query)) !== null) {
		const tableStart = match.index + match[0].indexOf(match[1]);
		skipPositions.add(tableStart);
	}

	// Mark alias definitions (word after table name) as skip positions
	const aliasRegex = /\b(?:FROM|JOIN)\s+\w+\s+(?:AS\s+)?(\w+)/gi;
	while ((match = aliasRegex.exec(query)) !== null) {
		if (match[1] && !KEYWORDS_SET.has(match[1].toUpperCase())) {
			const aliasStart = match.index + match[0].lastIndexOf(match[1]);
			skipPositions.add(aliasStart);
		}
	}

	// Mark column alias definitions (after AS) as skip positions
	const columnAliasRegex = /\bAS\s+(\w+)/gi;
	while ((match = columnAliasRegex.exec(query)) !== null) {
		const aliasStart = match.index + match[0].indexOf(match[1]);
		skipPositions.add(aliasStart);
	}

	// Now find all potential column references
	identifierRegex.lastIndex = 0;
	while ((match = identifierRegex.exec(query)) !== null) {
		const word = match[1];
		const position = match.index;
		const upperWord = word.toUpperCase();

		// Skip if inside string literal
		if (isInStringLiteral(query, position)) continue;

		// Skip if this position should be skipped (table/alias definition)
		if (skipPositions.has(position)) continue;

		// Skip SQL keywords
		if (KEYWORDS_SET.has(upperWord)) continue;

		// Skip SQL functions (typically followed by parenthesis)
		if (FUNCTIONS_SET.has(upperWord)) continue;

		// Skip numeric-looking values (though regex already filters these)
		if (/^\d+$/.test(word)) continue;

		// Check if this is a qualified column (table.column)
		const beforePos = position - 1;
		if (beforePos >= 0 && query[beforePos] === '.') {
			// This is the column part of table.column
			// Find the table/alias before the dot
			const beforeDot = query.slice(0, beforePos);
			const tableMatch = beforeDot.match(/(\w+)\s*$/);
			if (tableMatch) {
				refs.push({
					name: word.toLowerCase(),
					table: tableMatch[1].toLowerCase(),
					position,
					endPosition: position + word.length,
				});
			}
			continue;
		}

		// Check if this is a table qualifier (followed by a dot)
		const afterPos = position + word.length;
		if (afterPos < query.length && query[afterPos] === '.') {
			// This is the table part of table.column - skip it
			continue;
		}

		// Check if this is a table name or alias being used alone (not a column)
		if (tableAndAliasNames.has(word.toLowerCase())) {
			continue;
		}

		// This is an unqualified column reference
		refs.push({
			name: word.toLowerCase(),
			table: null,
			position,
			endPosition: position + word.length,
		});
	}

	return refs;
}

/**
 * Validate column references against the schema
 */
export function validateColumns(query: string, schema: DatabaseSchema): ValidationError[] {
	if (!query.trim()) {
		return [];
	}

	const errors: ValidationError[] = [];
	const tables = extractTablesWithAliases(query);

	// If no tables in query, skip validation (e.g., "SELECT 1")
	if (tables.length === 0) {
		return [];
	}

	const aliasMap = buildAliasMap(tables);
	const allColumnsInScope = getAllColumnsInScope(tables, schema);
	const columnRefs = extractColumnReferences(query, tables);

	for (const ref of columnRefs) {
		if (ref.table) {
			// Qualified column: table.column
			const actualTableName = aliasMap.get(ref.table);

			if (!actualTableName) {
				// Unknown table/alias - skip, server will catch this
				continue;
			}

			// Check if the table exists in schema
			if (!tableExistsInSchema(actualTableName, schema)) {
				// Table not in schema - skip validation
				continue;
			}

			const tableColumns = getTableColumns(actualTableName, schema);
			if (!tableColumns.has(ref.name)) {
				const displayTable = ref.table; // Use original case from query
				errors.push({
					message: `Unknown column "${ref.name}"`,
					position: ref.position,
					endPosition: ref.endPosition,
					severity: 'error',
					hint: `"${ref.name}" not found in table "${displayTable}"`,
				});
			}
		} else {
			// Unqualified column: just column name
			// Valid if it exists in ANY table in scope
			if (!allColumnsInScope.has(ref.name)) {
				// Check if at least one table is known in the schema
				const knownTables = tables.filter((t) =>
					tableExistsInSchema(t.tableName, schema)
				);

				if (knownTables.length === 0) {
					// No tables known in schema - skip validation
					continue;
				}

				const tableList = knownTables
					.map((t) => t.alias || t.tableName)
					.join(', ');

				errors.push({
					message: `Unknown column "${ref.name}"`,
					position: ref.position,
					endPosition: ref.endPosition,
					severity: 'error',
					hint: `"${ref.name}" not found in ${knownTables.length === 1 ? 'table' : 'tables'}: ${tableList}`,
				});
			}
		}
	}

	return errors;
}
