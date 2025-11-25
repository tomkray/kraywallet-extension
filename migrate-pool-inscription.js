// migrate-pool-inscription.js
// Adiciona colunas de inscription na tabela defi_pools

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'ordinals.db');
const db = new Database(dbPath);

console.log('🔧 Migrando tabela defi_pools...');

try {
    // Verificar se as colunas já existem
    const tableInfo = db.prepare('PRAGMA table_info(defi_pools)').all();
    const hasInscriptionCols = tableInfo.some(col => col.name === 'use_inscription');
    
    if (hasInscriptionCols) {
        console.log('✅ Colunas de inscription já existem!');
    } else {
        console.log('📝 Adicionando colunas...');
        
        db.exec(`
            ALTER TABLE defi_pools ADD COLUMN use_inscription INTEGER DEFAULT 0;
        `);
        
        db.exec(`
            ALTER TABLE defi_pools ADD COLUMN pool_inscription_id TEXT;
        `);
        
        db.exec(`
            ALTER TABLE defi_pools ADD COLUMN pool_inscription_number INTEGER;
        `);
        
        db.exec(`
            ALTER TABLE defi_pools ADD COLUMN pool_image TEXT;
        `);
        
        console.log('✅ Migração concluída!');
    }
    
    // Mostrar estrutura da tabela
    console.log('\n📊 Estrutura da tabela:');
    const columns = db.prepare('PRAGMA table_info(defi_pools)').all();
    columns.forEach(col => {
        console.log(`   ${col.name} (${col.type})`);
    });
    
} catch (error) {
    console.error('❌ Erro na migração:', error.message);
} finally {
    db.close();
}


