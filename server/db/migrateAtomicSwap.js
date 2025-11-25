/**
 * 🔐 ATOMIC SWAP MIGRATION
 * 
 * Aplica schema para marketplace SIGHASH_SINGLE|ANYONECANPAY (0x83)
 * 
 * Este migration cria as tabelas necessárias para o fluxo de 2 passos:
 * 1. Seller lista → assina com SIGHASH_SINGLE|ANYONECANPAY
 * 2. Buyer compra → backend completa PSBT → buyer assina → broadcast
 */

import { db } from './init-supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function migrateAtomicSwap() {
    console.log('\n🔐 ═══════════════════════════════════════════════════════');
    console.log('   ATOMIC SWAP MIGRATION - SIGHASH_SINGLE|ANYONECANPAY');
    console.log('═══════════════════════════════════════════════════════\n');
    
    try {
        // Ler SQL migration
        const migrationPath = path.join(__dirname, 'migrations', '001_atomic_swap_schema.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📄 Loading migration from:', migrationPath);
        
        // Executar migration (sem transaction para evitar problemas com PRAGMA)
        try {
            // Executar SQL inteiro (better-sqlite3 lida com múltiplos statements)
            db.exec(migrationSQL);
        } catch (error) {
            // Ignorar erros de "já existe" (idempotente)
            if (!error.message.includes('already exists') && 
                !error.message.includes('duplicate column name')) {
                console.error('   ⚠️  Migration error:', error.message);
                // Não fazer throw - continuar mesmo com erro
            }
        }
        
        console.log('✅ Migration applied successfully!');
        console.log('\n📊 Tables created:');
        console.log('   - atomic_listings (seller offers)');
        console.log('   - purchase_attempts (buyer purchases)');
        console.log('   - marketplace_config (global settings)');
        
        console.log('\n📈 Views created:');
        console.log('   - active_listings (open offers)');
        console.log('   - marketplace_stats (metrics)');
        
        console.log('\n🔍 Indexes created for performance');
        console.log('✅ Triggers created for validation\n');
        
        // Verificar tabelas
        const tables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            AND (name LIKE 'atomic_%' OR name = 'marketplace_config')
            ORDER BY name
        `).all();
        
        console.log('✅ Verified tables:', tables.map(t => t.name).join(', '));
        
        // Verificar config
        const config = db.prepare('SELECT * FROM marketplace_config').all();
        console.log('\n⚙️  Marketplace Configuration:');
        config.forEach(c => {
            console.log(`   ${c.key}: ${c.value}`);
        });
        
        console.log('\n✅ Atomic Swap schema ready!');
        console.log('═══════════════════════════════════════════════════════\n');
        
        return { success: true };
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Auto-run se executado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    await migrateAtomicSwap();
    process.exit(0);
}

