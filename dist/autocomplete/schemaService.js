import { SQL_KEYWORDS, SQL_FUNCTIONS } from './keywords.js';
export async function loadSchema(client) {
    const tablesResult = await client.query(`
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = current_schema()
		  AND table_type = 'BASE TABLE'
		ORDER BY table_name
	`);
    const columnsResult = await client.query(`
		SELECT table_name, column_name, data_type, is_nullable
		FROM information_schema.columns
		WHERE table_schema = current_schema()
		ORDER BY table_name, ordinal_position
	`);
    const foreignKeysResult = await client.query(`
		SELECT
			kcu.table_name,
			kcu.column_name,
			ccu.table_name AS referenced_table,
			ccu.column_name AS referenced_column
		FROM information_schema.key_column_usage kcu
		JOIN information_schema.constraint_column_usage ccu
			ON kcu.constraint_name = ccu.constraint_name
			AND kcu.constraint_schema = ccu.constraint_schema
		JOIN information_schema.table_constraints tc
			ON kcu.constraint_name = tc.constraint_name
			AND kcu.constraint_schema = tc.constraint_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
			AND kcu.table_schema = current_schema()
	`);
    const tableMap = new Map();
    for (const row of tablesResult.rows) {
        tableMap.set(row.table_name, {
            name: row.table_name,
            schema: 'public',
            columns: [],
            foreignKeys: [],
        });
    }
    for (const row of columnsResult.rows) {
        const table = tableMap.get(row.table_name);
        if (table) {
            const column = {
                name: row.column_name,
                dataType: row.data_type,
                isNullable: row.is_nullable === 'YES',
            };
            table.columns.push(column);
        }
    }
    for (const row of foreignKeysResult.rows) {
        const table = tableMap.get(row.table_name);
        if (table) {
            const fk = {
                column: row.column_name,
                referencedTable: row.referenced_table,
                referencedColumn: row.referenced_column,
            };
            table.foreignKeys.push(fk);
        }
    }
    return {
        tables: Array.from(tableMap.values()),
        keywords: SQL_KEYWORDS,
        functions: SQL_FUNCTIONS,
    };
}
export function createEmptySchema() {
    return {
        tables: [],
        keywords: SQL_KEYWORDS,
        functions: SQL_FUNCTIONS,
    };
}
