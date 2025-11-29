import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '../db/init-supabase.js';
import * as bitcoin from 'bitcoinjs-lib';

const execAsync = promisify(exec);
const router = express.Router();

// Configurações de Service Fee do .env
const SERVICE_FEE_ADDRESS = process.env.SERVICE_FEE_ADDRESS || 'bc1qyour_kray_station_address_here';
const SERVICE_FEE_PERCENTAGE = parseFloat(process.env.SERVICE_FEE_PERCENTAGE) || 1.0;
const SERVICE_FEE_MIN_AMOUNT = parseInt(process.env.SERVICE_FEE_MIN_AMOUNT) || 100;
const ORD_CLI_PATH = process.env.ORD_CLI_PATH || 'ord';

/**
 * GET /api/ord-offers/index
 * Indexa ofertas criadas via ORD CLI externo
 */
router.get('/index', async (req, res) => {
    try {
        console.log('\n🔍 ========== INDEXING ORD OFFERS ==========');
        console.log(`📂 ORD CLI Path: ${ORD_CLI_PATH}`);
        console.log(`💰 Service Fee: ${SERVICE_FEE_PERCENTAGE}% → ${SERVICE_FEE_ADDRESS}`);
        
        // Listar ofertas criadas via ORD CLI
        // Nota: Este comando pode variar dependendo da versão do ORD
        const { stdout } = await execAsync(`${ORD_CLI_PATH} wallet offers --json`);
        
        // Parse JSON output do ORD
        const ordOffers = JSON.parse(stdout);
        
        console.log(`\n📋 Found ${ordOffers.length} ORD offers`);
        
        let indexed = 0;
        let skipped = 0;
        
        // Salvar no nosso banco com flag "external"
        for (const offer of ordOffers) {
            try {
                // Verificar se já existe
                const existing = db.prepare('SELECT id FROM offers WHERE id = ?').get(offer.id);
                
                if (existing) {
                    console.log(`   ⏭️  Offer ${offer.id} already indexed, skipping...`);
                    skipped++;
                    continue;
                }
                
                // Decode PSBT to get inscription info
                const psbtObj = bitcoin.Psbt.fromBase64(offer.psbt);
                
                // Extract inscription ID from PSBT input
                // Assume o input 0 é a inscription
                const inscriptionUtxo = psbtObj.txInputs[0];
                const txidHex = Buffer.from(inscriptionUtxo.hash).reverse().toString('hex');
                const inscriptionId = `${txidHex}i${inscriptionUtxo.index}`;
                
                // Extract seller address from PSBT
                const sellerAddress = offer.address || extractAddressFromPsbt(psbtObj);
                
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
                
                console.log(`   ✅ Indexed offer ${offer.id} (${offer.price} sats)`);
                indexed++;
            } catch (offerError) {
                console.error(`   ❌ Error indexing offer ${offer.id}:`, offerError.message);
            }
        }
        
        console.log('\n✅ ========== INDEXING COMPLETE ==========');
        console.log(`   Indexed: ${indexed}`);
        console.log(`   Skipped: ${skipped}`);
        console.log(`   Total: ${ordOffers.length}`);
        
        res.json({ 
            success: true, 
            indexed,
            skipped,
            total: ordOffers.length
        });
    } catch (error) {
        console.error('❌ Error indexing ORD offers:', error);
        res.status(500).json({ 
            error: error.message,
            hint: 'Make sure ORD CLI is installed and configured correctly'
        });
    }
});

/**
 * POST /api/ord-offers/submit-psbt
 * 🔒 MÉTODO SEGURO: Usuário cria PSBT localmente e submete
 * 
 * Fluxo:
 * 1. Usuário executa `ord wallet offer create` LOCALMENTE
 * 2. Copia o PSBT gerado
 * 3. Submete via esta API
 * 4. API valida e publica no marketplace
 */
router.post('/submit-psbt', async (req, res) => {
    try {
        const { psbt, inscriptionId, price, description } = req.body;
        
        console.log('\n🔒 ===== SUBMIT PSBT (SECURE METHOD) =====');
        console.log(`📋 Inscription ID: ${inscriptionId}`);
        console.log(`💰 Price: ${price} sats`);
        
        if (!psbt || !inscriptionId || !price) {
            return res.status(400).json({ 
                error: 'Missing required fields: psbt, inscriptionId, price' 
            });
        }
        
        // Validar PSBT
        const psbtObj = bitcoin.Psbt.fromBase64(psbt);
        
        // Extrair seller address
        const input0 = psbtObj.data.inputs[0];
        let sellerAddress = 'unknown';
        if (input0.witnessUtxo) {
            const network = bitcoin.networks.bitcoin;
            sellerAddress = bitcoin.address.fromOutputScript(input0.witnessUtxo.script, network);
        }
        
        console.log(`👤 Seller Address: ${sellerAddress}`);
        console.log(`✅ PSBT is valid`);
        
        // Calcular service fee
        const serviceFee = Math.floor(price * (SERVICE_FEE_PERCENTAGE / 100));
        
        // Gerar ID único
        const offerId = `ord-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        // Salvar no banco
        db.prepare(`
            INSERT INTO offers (
                id, type, inscription_id, offer_amount, 
                psbt, creator_address, created_at, 
                status, source, service_fee_percentage,
                service_fee_address, sighash_type, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            offerId,
            'inscription',
            inscriptionId,
            price,
            psbt,
            sellerAddress,
            Date.now(),
            'active',
            'ord-cli',
            SERVICE_FEE_PERCENTAGE,
            SERVICE_FEE_ADDRESS,
            'SINGLE|ANYONECANPAY',
            description || null
        );
        
        console.log('✅ ========== OFFER PUBLISHED ==========');
        console.log(`   Offer ID: ${offerId}`);
        console.log(`   Status: ACTIVE`);
        console.log(`   Marketplace: LIVE`);
        
        res.json({
            success: true,
            offerId,
            message: 'Offer published successfully on marketplace!',
            marketplaceUrl: `http://localhost:3000/ordinals.html`
        });
        
    } catch (error) {
        console.error('❌ Error submitting PSBT:', error);
        res.status(500).json({ 
            error: error.message
        });
    }
});

/**
 * ⚠️  ENDPOINT REMOVIDO POR SEGURANÇA
 * POST /api/ord-offers/create
 * 
 * Este endpoint foi REMOVIDO porque executava comandos ORD wallet
 * no servidor, o que é um RISCO DE SEGURANÇA em produção.
 * 
 * Use /submit-psbt ao invés disso.
 */
router.post('/create', async (req, res) => {
    try {
        const { inscriptionId, price } = req.body;
        
        console.log('\n🚀 ========== AUTO-CREATING ORD OFFER ==========');
        console.log(`📋 Inscription ID: ${inscriptionId}`);
        console.log(`💰 Price: ${price} sats`);
        
        if (!inscriptionId || !price) {
            return res.status(400).json({ 
                error: 'Missing inscriptionId or price' 
            });
        }
        
        // Calcular fees
        const serviceFee = Math.floor(price * (SERVICE_FEE_PERCENTAGE / 100));
        const sellerReceives = price - serviceFee;
        
        console.log(`💸 Service Fee (${SERVICE_FEE_PERCENTAGE}%): ${serviceFee} sats`);
        console.log(`✅ Seller Receives: ${sellerReceives} sats`);
        
        // Executar ORD CLI para criar oferta
        console.log(`\n⚙️  Executing: ${ORD_CLI_PATH} wallet offer create ${inscriptionId} ${sellerReceives}`);
        
        const { stdout, stderr } = await execAsync(
            `${ORD_CLI_PATH} wallet offer create ${inscriptionId} ${sellerReceives}`
        );
        
        if (stderr) {
            console.log('⚠️  stderr:', stderr);
        }
        
        console.log('📦 ORD CLI Output:', stdout.substring(0, 200) + '...');
        
        // Parse PSBT from output
        // ORD CLI geralmente retorna o PSBT em base64
        const psbtMatch = stdout.match(/([A-Za-z0-9+/=]{100,})/);
        if (!psbtMatch) {
            throw new Error('Failed to extract PSBT from ORD output');
        }
        
        const psbtBase64 = psbtMatch[0];
        console.log('✅ PSBT extracted:', psbtBase64.substring(0, 50) + '...');
        
        // Decode PSBT para extrair informações
        const psbtObj = bitcoin.Psbt.fromBase64(psbtBase64);
        
        // Extrair seller address
        const input0 = psbtObj.data.inputs[0];
        let sellerAddress = 'unknown';
        if (input0.witnessUtxo) {
            const network = bitcoin.networks.bitcoin;
            sellerAddress = bitcoin.address.fromOutputScript(input0.witnessUtxo.script, network);
        }
        
        console.log(`👤 Seller Address: ${sellerAddress}`);
        
        // Gerar ID único para a oferta
        const offerId = `ord-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        // Salvar no banco de dados
        db.prepare(`
            INSERT INTO offers (
                id, type, inscription_id, offer_amount, 
                psbt, creator_address, created_at, 
                status, source, service_fee_percentage,
                service_fee_address, sighash_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            offerId,
            'inscription',
            inscriptionId,
            price,
            psbtBase64,
            sellerAddress,
            Date.now(),
            'active',
            'ord-cli',
            SERVICE_FEE_PERCENTAGE,
            SERVICE_FEE_ADDRESS,
            'SINGLE|ANYONECANPAY'
        );
        
        console.log('✅ ========== OFFER CREATED SUCCESSFULLY ==========');
        console.log(`   Offer ID: ${offerId}`);
        console.log(`   Status: ACTIVE`);
        console.log(`   Now visible in Marketplace! 🎉`);
        
        res.json({
            success: true,
            offerId,
            inscriptionId,
            price,
            serviceFee,
            sellerReceives,
            psbt: psbtBase64,
            status: 'active',
            message: 'Offer created and listed on marketplace!'
        });
        
    } catch (error) {
        console.error('❌ Error creating ORD offer:', error);
        res.status(500).json({ 
            error: error.message,
            hint: 'Make sure ORD CLI is installed and wallet is unlocked'
        });
    }
});

/**
 * GET /api/ord-offers/config
 * Retorna configurações de service fee
 */
router.get('/config', (req, res) => {
    res.json({
        serviceFeeAddress: SERVICE_FEE_ADDRESS,
        serviceFeePercentage: SERVICE_FEE_PERCENTAGE,
        serviceFeeMinAmount: SERVICE_FEE_MIN_AMOUNT,
        ordCliPath: ORD_CLI_PATH
    });
});

/**
 * Helper: Extract address from PSBT
 */
function extractAddressFromPsbt(psbt) {
    try {
        // Tentar extrair do witnessUtxo do input 0
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

export default router;

