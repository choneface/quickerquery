import { parseContext } from './sqlParser.js';
export function getSuggestion(query, schema) {
    if (!query.trim()) {
        return undefined;
    }
    const context = parseContext(query);
    const candidates = getCandidates(context, schema);
    const ranked = rankCandidates(candidates, context.partial);
    if (ranked.length === 0) {
        return undefined;
    }
    // Build the complete suggestion by replacing the partial with the match
    const suggestion = matchCase(ranked[0].text, context.partial);
    if (!context.partial) {
        // No partial word - just append the suggestion
        return query + suggestion;
    }
    // Replace the partial word with the full suggestion
    const beforePartial = query.slice(0, query.length - context.partial.length);
    return beforePartial + suggestion;
}
/**
 * Transform the suggestion to match the case style of the partial word typed by the user.
 * - If partial is all lowercase → return suggestion in lowercase
 * - If partial is all uppercase → return suggestion in uppercase
 * - Otherwise → return suggestion as-is (original case)
 */
function matchCase(suggestion, partial) {
    if (!partial) {
        return suggestion;
    }
    const isAllLower = partial === partial.toLowerCase();
    const isAllUpper = partial === partial.toUpperCase();
    if (isAllLower) {
        return suggestion.toLowerCase();
    }
    if (isAllUpper) {
        return suggestion.toUpperCase();
    }
    // Mixed case - return original
    return suggestion;
}
function getCandidates(context, schema) {
    const candidates = [];
    switch (context.type) {
        case 'SELECT_COLUMNS': {
            // Add columns from known tables
            const columns = getColumnsForTables(context.tables, schema);
            for (const col of columns) {
                candidates.push({ text: col, priority: 1 });
            }
            // Add functions (high priority in SELECT)
            for (const fn of schema.functions) {
                candidates.push({ text: fn, priority: 2 });
            }
            // Add keywords
            for (const kw of schema.keywords) {
                candidates.push({ text: kw, priority: 3 });
            }
            // Add all table columns if no specific tables
            if (context.tables.length === 0) {
                for (const table of schema.tables) {
                    for (const col of table.columns) {
                        candidates.push({ text: col.name, priority: 1 });
                    }
                }
            }
            break;
        }
        case 'FROM_TABLE':
        case 'JOIN_TABLE': {
            // Suggest table names
            for (const table of schema.tables) {
                candidates.push({ text: table.name, priority: 1 });
            }
            break;
        }
        case 'JOIN_ON': {
            // Suggest FK-based join conditions with highest priority
            const joinConditions = getJoinConditions(context.leftTable, context.rightTable, schema);
            for (const condition of joinConditions) {
                candidates.push({ text: condition, priority: 0 }); // Highest priority
            }
            // Fall back to column suggestions if no FK relationships
            const columns = getColumnsForTables(context.tables, schema);
            for (const col of columns) {
                candidates.push({ text: col, priority: 1 });
            }
            break;
        }
        case 'WHERE_COLUMN': {
            // Add columns from known tables
            const columns = getColumnsForTables(context.tables, schema);
            for (const col of columns) {
                candidates.push({ text: col, priority: 1 });
            }
            // Add functions (useful in WHERE)
            for (const fn of schema.functions) {
                candidates.push({ text: fn, priority: 2 });
            }
            // Add keywords
            for (const kw of schema.keywords) {
                candidates.push({ text: kw, priority: 3 });
            }
            // Add all table columns if no specific tables
            if (context.tables.length === 0) {
                for (const table of schema.tables) {
                    for (const col of table.columns) {
                        candidates.push({ text: col.name, priority: 1 });
                    }
                }
            }
            break;
        }
        case 'TABLE_COLUMN': {
            // Suggest columns for the specific table
            const table = schema.tables.find((t) => t.name.toLowerCase() === context.table.toLowerCase());
            if (table) {
                for (const col of table.columns) {
                    candidates.push({ text: col.name, priority: 1 });
                }
            }
            break;
        }
        case 'KEYWORD':
        case 'UNKNOWN':
        default: {
            // Suggest keywords first, then functions
            for (const kw of schema.keywords) {
                candidates.push({ text: kw, priority: 1 });
            }
            for (const fn of schema.functions) {
                candidates.push({ text: fn, priority: 2 });
            }
            // Also suggest table names
            for (const table of schema.tables) {
                candidates.push({ text: table.name, priority: 3 });
            }
            break;
        }
    }
    return candidates;
}
function getColumnsForTables(tableNames, schema) {
    const columns = [];
    for (const tableName of tableNames) {
        const table = schema.tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase());
        if (table) {
            for (const col of table.columns) {
                columns.push(col.name);
            }
        }
    }
    return columns;
}
/**
 * Get join condition suggestions based on FK relationships between two tables.
 * Returns conditions like "orders.user_id = users.id"
 */
function getJoinConditions(leftTableName, rightTableName, schema) {
    const conditions = [];
    const leftTable = schema.tables.find((t) => t.name.toLowerCase() === leftTableName.toLowerCase());
    const rightTable = schema.tables.find((t) => t.name.toLowerCase() === rightTableName.toLowerCase());
    if (!leftTable || !rightTable) {
        return conditions;
    }
    // Check if rightTable has FK to leftTable
    // e.g., orders.user_id -> users.id
    // Suggests: orders.user_id = users.id
    for (const fk of rightTable.foreignKeys) {
        if (fk.referencedTable.toLowerCase() === leftTableName.toLowerCase()) {
            conditions.push(`${rightTable.name}.${fk.column} = ${leftTable.name}.${fk.referencedColumn}`);
        }
    }
    // Check if leftTable has FK to rightTable
    // e.g., users.department_id -> departments.id
    // Suggests: users.department_id = departments.id
    for (const fk of leftTable.foreignKeys) {
        if (fk.referencedTable.toLowerCase() === rightTableName.toLowerCase()) {
            conditions.push(`${leftTable.name}.${fk.column} = ${rightTable.name}.${fk.referencedColumn}`);
        }
    }
    return conditions;
}
function rankCandidates(candidates, partial) {
    if (!partial) {
        // No partial - return candidates sorted by priority then alphabetically
        return candidates
            .sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return a.text.localeCompare(b.text);
        });
    }
    const upperPartial = partial.toUpperCase();
    // Filter to only candidates that match the partial (case-insensitive prefix)
    const matching = candidates.filter((c) => c.text.toUpperCase().startsWith(upperPartial));
    // Don't suggest if the partial is already a complete match
    if (matching.length === 1 && matching[0].text.toUpperCase() === upperPartial) {
        return [];
    }
    // Sort by priority, then by length (shorter = more likely), then alphabetically
    return matching.sort((a, b) => {
        if (a.priority !== b.priority) {
            return a.priority - b.priority;
        }
        if (a.text.length !== b.text.length) {
            return a.text.length - b.text.length;
        }
        return a.text.localeCompare(b.text);
    });
}
