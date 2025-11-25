#!/usr/bin/env node

/**
 * 🔄 Script para Sincronizar Inscriptions
 * 
 * Busca inscriptions reais do Ord Server e popula o banco de dados
 */

import ordApi from '../server/utils/ordApi.js';
import { db } from '../server/db/init.js';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function syncInscriptions(limit = 100) {
    try {
        log('\n🔄 Sincronizando inscriptions do Ord Server...', 'cyan');
        log(`   Buscando últimas ${limit} inscriptions...\n`, 'blue');
        
        // Buscar inscriptions do Ord Server
        const inscriptions = await ordApi.getLatestInscriptions(limit);
        
        if (!inscriptions || inscriptions.length === 0) {
            log('⚠️  Nenhuma inscription encontrada no Ord Server', 'yellow');
            return;
        }
        
        let added = 0;
        let skipped = 0;
        
        // Adicionar cada inscription ao banco
        for (const insc of inscriptions) {
            try {
                // Tentar obter mais detalhes da inscription
                let details = null;
                try {
                    if (insc.id) {
                        details = await ordApi.getInscription(insc.id);
                    }
                } catch (err) {
                    // Se não conseguir detalhes, usar dados básicos
                }
                
                const inscriptionId = insc.id || insc.inscription_id;
                const inscriptionNumber = insc.number || insc.inscription_number;
                const contentType = details?.content_type || insc.content_type || 'unknown';
                const owner = details?.address || insc.address || null;
                
                // Inserir no banco (ignorar se já existir)
                const result = db.prepare(`
                    INSERT OR IGNORE INTO inscriptions 
                    (id, inscription_number, content_type, owner, listed, price, created_at)
                    VALUES (?, ?, ?, ?, 0, NULL, ?)
                `).run(
                    inscriptionId,
                    inscriptionNumber,
                    contentType,
                    owner,
                    Date.now()
                );
                
                if (result.changes > 0) {
                    added++;
                    log(`  ✅ #${inscriptionNumber} - ${inscriptionId?.slice(0, 20)}...`, 'green');
                } else {
                    skipped++;
                }
                
                // Delay para não sobrecarregar o Ord Server
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (err) {
                log(`  ⚠️  Erro ao processar inscription: ${err.message}`, 'yellow');
            }
        }
        
        log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
        log(`✅ Sincronização completa!`, 'green');
        log(`   ${added} inscriptions adicionadas`, 'green');
        log(`   ${skipped} inscriptions já existiam`, 'yellow');
        log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`, 'cyan');
        
        // Mostrar estatísticas do banco
        const stats = db.prepare('SELECT COUNT(*) as total FROM inscriptions').get();
        log(`📊 Total no banco: ${stats.total} inscriptions\n`, 'blue');
        
    } catch (error) {
        log(`\n❌ Erro ao sincronizar: ${error.message}\n`, 'red');
        throw error;
    }
}

// Executar
const limit = process.argv[2] ? parseInt(process.argv[2]) : 100;
syncInscriptions(limit)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));








