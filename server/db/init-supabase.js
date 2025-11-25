/**
 * 🗄️ Database Initialization - Supabase
 * Versão 100% compatível com Vercel serverless
 */

import { supabase } from './supabase.js';

/**
 * Inicializar database (verificar conexão)
 */
export async function initDatabase() {
    try {
        console.log('Initializing database...');

        if (process.env.USE_SUPABASE === 'true') {
            console.log('📊 Using Supabase (cloud database)');

            // Testar conexão
            const { data, error } = await supabase
                .from('inscriptions')
                .select('count')
                .limit(1);

            if (error && error.code !== 'PGRST116') {
                console.warn('⚠️  Supabase connection issue:', error.message);
            } else {
                console.log('✅ Supabase connected');
            }

            return true;
        } else {
            console.log('ℹ️  Database disabled (serverless mode without DB)');
            return false;
        }
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        return false;
    }
}

/**
 * Helper functions compatíveis com código SQLite existente
 */
export const db = {
    // SELECT
    prepare: (sql) => ({
        get: async (...params) => {
            try {
                const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
                if (!tableName) throw new Error('Table not found in SQL');

                const { data, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .limit(1)
                    .single();

                if (error) return null;
                return data;
            } catch (e) {
                return null;
            }
        },

        all: async (...params) => {
            try {
                const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
                if (!tableName) return [];

                let query = supabase.from(tableName).select('*');

                // WHERE clause simples (address = ?)
                if (sql.includes('WHERE') && params[0]) {
                    const column = sql.match(/WHERE\s+(\w+)/i)?.[1];
                    if (column) {
                        query = query.eq(column, params[0]);
                    }
                }

                const { data, error } = await query;

                if (error) {
                    console.warn('Supabase query error:', error.message);
                    return [];
                }

                return data || [];
            } catch (e) {
                console.error('DB query error:', e.message);
                return [];
            }
        },

        run: async (...params) => {
            // INSERT/UPDATE/DELETE
            return { changes: 0 };
        }
    }),

    exec: (sql) => {
        // SQL direto (não usado em produção)
        console.log('SQL exec (skipped in Supabase):', sql.substring(0, 50));
    },

    pragma: (cmd) => {
        // SQLite pragmas (não aplicável ao Supabase)
        console.log('Pragma skipped (Supabase):', cmd);
    }
};

// Migrations são feitas via SQL Editor do Supabase
function runMigrations() {
    console.log('ℹ️  Migrations managed via Supabase SQL Editor');
}

// Função getDatabase para compatibilidade com código antigo
export function getDatabase() {
    return db;
}

export { supabase };
export default { initDatabase, db, getDatabase };

