import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '../db/init-supabase.js';
import * as bitcoin from 'bitcoinjs-lib';

const execAsync = promisify(exec);

// Configurações
const SERVICE_FEE_ADDRESS = process.env.SERVICE_FEE_ADDRESS || 'bc1qyour_kray_station_address_here';
const SERVICE_FEE_PERCENTAGE = parseFloat(process.env.SERVICE_FEE_PERCENTAGE) || 1.0;
const ORD_CLI_PATH = process.env.ORD_CLI_PATH || 'ord';
const ORD_INDEXING_ENABLED = process.env.ORD_INDEXING_ENABLED === 'true';
const ORD_INDEXING_INTERVAL = parseInt(process.env.ORD_INDEXING_INTERVAL) || 300000; // 5 min

/**
 * Indexar ofertas do ORD CLI
 */
async function indexOrdOffers() {
    try {
        console.log('\n🔄 [CRON] Indexing ORD offers...');
        
        // Listar ofertas criadas via ORD CLI
        const { stdout } = await execAsync(`${ORD_CLI_PATH} wallet offers --json`);
        const ordOffers = JSON.parse(stdout);
        
        let indexed = 0;
        let skipped = 0;
        
        for (const offer of ordOffers) {
            try {
                // Verificar se já existe
                const existing = db.prepare('SELECT id FROM offers WHERE id = ?').get(offer.id);
                
                if (existing) {
                    skipped++;
                    continue;
                }
                
                // Decode PSBT
                const psbtObj = bitcoin.Psbt.fromBase64(offer.psbt);
                const inscriptionUtxo = psbtObj.txInputs[0];
                const txidHex = Buffer.from(inscriptionUtxo.hash).reverse().toString('hex');
                const inscriptionId = `${txidHex}i${inscriptionUtxo.index}`;
                
                // Extract seller address
                const sellerAddress = extractAddressFromPsbt(psbtObj);
                
                // Inserir no banco
                db.prepare(`
                    INSERT INTO offers (
                        id, type, inscription_id, offer_amount, 
                        psbt, creator_address, created_at, 
                        status, source, service_fee_percentage,
                        service_fee_address, sighash_type
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    offer.id,
                    'inscription',
                    inscriptionId,
                    offer.price,
                    offer.psbt,
                    sellerAddress,
                    Date.now(),
                    'active',
                    'ord-cli',
                    SERVICE_FEE_PERCENTAGE,
                    SERVICE_FEE_ADDRESS,
                    offer.sighash_type || 'SINGLE|ANYONECANPAY'
                );
                
                indexed++;
            } catch (offerError) {
                console.error(`   ❌ Error indexing offer ${offer.id}:`, offerError.message);
            }
        }
        
        if (indexed > 0 || skipped > 0) {
            console.log(`✅ [CRON] Indexed: ${indexed}, Skipped: ${skipped}, Total: ${ordOffers.length}`);
        }
    } catch (error) {
        // Silently fail se ORD CLI não estiver disponível
        if (!error.message.includes('command not found')) {
            console.error('❌ [CRON] Error indexing ORD offers:', error.message);
        }
    }
}

/**
 * Helper: Extract address from PSBT
 */
function extractAddressFromPsbt(psbt) {
    try {
        const input0 = psbt.data.inputs[0];
        if (input0.witnessUtxo) {
            const network = bitcoin.networks.bitcoin;
            return bitcoin.address.fromOutputScript(input0.witnessUtxo.script, network);
        }
        return 'unknown';
    } catch (e) {
        return 'unknown';
    }
}

/**
 * Iniciar cron job
 */
export function startOrdIndexingJob() {
    if (!ORD_INDEXING_ENABLED) {
        console.log('ℹ️  ORD indexing is disabled');
        return;
    }
    
    console.log(`🔄 Starting ORD indexing cron job (every ${ORD_INDEXING_INTERVAL}ms)`);
    
    // Rodar a cada X minutos (configurável via .env)
    const intervalMinutes = Math.floor(ORD_INDEXING_INTERVAL / 60000);
    const cronSchedule = `*/${intervalMinutes} * * * *`;
    
    cron.schedule(cronSchedule, indexOrdOffers);
    
    // Rodar imediatamente na inicialização
    indexOrdOffers();
}

