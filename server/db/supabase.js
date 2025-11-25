/**
 * 🗄️ Supabase Database Client
 * Substitui better-sqlite3 para produção
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://yspgufasgeyyyfatlegy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
    console.warn('⚠️  SUPABASE_SERVICE_KEY not configured');
}

// Criar cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false
    }
});

/**
 * Inicializar tabelas no Supabase
 */
export async function initSupabaseTables() {
    try {
        console.log('📊 Initializing Supabase tables...');
        
        // Verificar conexão
        const { data, error } = await supabase.from('inscriptions').select('count').limit(1);
        
        if (error) {
            console.log('   ℹ️  Tables need to be created (run SQL in Supabase dashboard)');
            return false;
        }
        
        console.log('   ✅ Supabase tables ready');
        return true;
        
    } catch (error) {
        console.error('   ❌ Supabase error:', error.message);
        return false;
    }
}

/**
 * Helper para queries compatíveis com SQLite
 */
export const db = {
    prepare: (sql) => ({
        get: async (...params) => {
            // Converter SQL SQLite para Supabase
            const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
            
            if (!tableName) {
                throw new Error('Could not parse table name');
            }
            
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1)
                .single();
            
            if (error) throw error;
            return data;
        },
        
        all: async (...params) => {
            // Converter SQL SQLite para Supabase
            const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
            const whereClause = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|$)/i)?.[1];
            
            if (!tableName) {
                throw new Error('Could not parse table name');
            }
            
            let query = supabase.from(tableName).select('*');
            
            // Aplicar WHERE se existir
            if (whereClause && params[0]) {
                const column = whereClause.match(/(\w+)\s*=/)?.[1];
                if (column) {
                    query = query.eq(column, params[0]);
                }
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.error('Supabase query error:', error);
                return [];
            }
            
            return data || [];
        },
        
        run: async (...params) => {
            // INSERT/UPDATE/DELETE
            console.log('SQL run:', sql, params);
            // TODO: Implementar conforme necessário
            return { changes: 0 };
        }
    }),
    
    exec: async (sql) => {
        // Executar SQL direto (migrations)
        console.log('SQL exec:', sql);
        // Migrations devem ser feitas no Supabase dashboard
        return true;
    }
};

export default supabase;

