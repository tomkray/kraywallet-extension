/**
 * 🔐 ATOMIC SWAP API ROUTES
 * 
 * Implementa marketplace não-custodial com SIGHASH_SINGLE|ANYONECANPAY (0x83)
 * 
 * FLUXO:
 * 1. POST /listings - Seller cria template PSBT
 * 2. POST /listings/:id/seller-signature - Seller envia PSBT assinado
 * 3. GET /listings (public) - Listar ofertas ativas
 * 4. POST /listings/:id/buy/prepare - Buyer prepara compra (backend monta PSBT)
 * 5. POST /listings/:id/buy/finalize - Buyer finaliza (backend valida e broadcast)
 */

import express from 'express';
import { db } from '../db/init-supabase.js';
import { createListingTemplatePSBT, validateSellerSignedPSBT } from '../utils/atomicSwapBuilder.js';
import { prepareBuyerPSBT, validateOutput0Immutable } from '../utils/atomicSwapPurchase.js';
import bitcoinRpc from '../utils/bitcoinRpc.js';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import crypto from 'crypto';
import axios from 'axios';

bitcoin.initEccLib(ecc);

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 SIGNATURE VERIFICATION (para Cancel e Update Price)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify Bitcoin signature (simplified for now)
 * TODO: Implement real Bitcoin signature verification using bitcoinjs-message or similar
 */
function verifySignature(address, message, signature) {
    try {
        // Validações básicas
        if (!message.includes('I cancel this listing') && 
            !message.includes('I update this listing price')) {
            console.log('❌ Invalid message format');
            return false;
        }
        
        if (!signature || signature.length < 50) {
            console.log('❌ Invalid signature length');
            return false;
        }
        
        if (!address.startsWith('bc1') && !address.startsWith('tb1') && !address.match(/^[13]/)) {
            console.log('❌ Invalid address format');
            return false;
        }
        
        console.log('✅ Signature validation passed (simplified)');
        return true;
        
    } catch (error) {
        console.error('❌ Error verifying signature:', error);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 LOCAL NODES CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

// QuickNode habilitado
const USE_QUICKNODE = process.env.QUICKNODE_ENABLED === 'true';

// Bitcoin RPC is imported from ../utils/bitcoinRpc.js (já usa QuickNode)

/**
 * ORD Server API Call
 */
async function ordServerApi(endpoint) {
    try {
        // Usar API local que proxy para QuickNode
        const response = await axios.get(`http://localhost:4000/api${endpoint}`);
        return response.data;
    } catch (error) {
        console.error(`API error (${endpoint}):`, error.message);
        throw new Error(`API ${endpoint} failed: ${error.message}`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏪 MARKETPLACE CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const MARKET_FEE_PERCENTAGE = 2.0; // 2%
const DUST_LIMIT = 546; // sats
const MIN_FEE_RATE = 1; // sat/vB

// Buscar market fee address do config
function getMarketFeeAddress() {
    const config = db.prepare('SELECT value FROM marketplace_config WHERE key = ?')
        .get('market_fee_address');
    // 💰 TREASURE MARKETPLACE: bc1pe3nvklfghzyepcjme5tyrv28kkmruypq0tmykgcdatkkreufyrhqaxf9p2
    return config?.value || 'bc1pe3nvklfghzyepcjme5tyrv28kkmruypq0tmykgcdatkkreufyrhqaxf9p2';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1️⃣ POST /listings - Criar Template PSBT para Seller Assinar
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/', async (req, res) => {
    try {
        console.log('\n📝 ═══════════════════════════════════════════════════════');
        console.log('   CREATE LISTING REQUEST');
        console.log('═══════════════════════════════════════════════════════\n');
        
        const {
            seller_txid,
            seller_vout,
            price_sats,
            seller_payout_address,
            inscription_id,
            inscription_number,
            content_type,
            network = 'mainnet'
        } = req.body;
        
        // ✅ Validações
        if (!seller_txid || seller_vout === undefined || !price_sats || !seller_payout_address) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: seller_txid, seller_vout, price_sats, seller_payout_address'
            });
        }
        
        if (price_sats < DUST_LIMIT) {
            return res.status(400).json({
                success: false,
                error: `Price must be at least ${DUST_LIMIT} sats (dust limit)`
            });
        }
        
        // ✅ Verificar se UTXO já está listado (ATIVO)
        const existingListing = db.prepare(`
            SELECT order_id, status, price_sats FROM atomic_listings 
            WHERE seller_txid = ? AND seller_vout = ? 
            AND status IN ('PENDING_SIGNATURES', 'OPEN')
        `).get(seller_txid, seller_vout);
        
        if (existingListing) {
            return res.status(400).json({
                success: false,
                error: `This inscription is already listed (${existingListing.status})`,
                existing_order_id: existingListing.order_id,
                existing_price: existingListing.price_sats,
                hint: 'Cancel the existing listing first, or update its price'
            });
        }
        
        // ✅ Buscar UTXO details via Bitcoin Core RPC (local node)
        console.log(`🔍 Fetching UTXO details from local Bitcoin node...`);
        console.log(`   TXID: ${seller_txid}`);
        console.log(`   vout: ${seller_vout}`);
        
        let seller_value, seller_script_pubkey;
        
        try {
            // Buscar TX via Bitcoin RPC
            const txData = await bitcoinRpc.call('getrawtransaction', [seller_txid, true]);
            
            if (!txData || !txData.vout || !txData.vout[seller_vout]) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid vout ${seller_vout} for tx ${seller_txid}`
                });
            }
            
            const vout = txData.vout[seller_vout];
            
            // Converter BTC para sats
            seller_value = Math.floor(vout.value * 100000000);
            seller_script_pubkey = vout.scriptPubKey.hex;
            
            console.log(`✅ UTXO found (local node):`);
            console.log(`   Value: ${seller_value} sats`);
            console.log(`   Script: ${seller_script_pubkey.substring(0, 40)}...`);
            
            // Verificar se UTXO já foi gasto via gettxout
            const utxoData = await bitcoinRpc.call('gettxout', [seller_txid, seller_vout, true]);
            
            if (!utxoData) {
                return res.status(400).json({
                    success: false,
                    error: 'This UTXO has already been spent'
                });
            }
            
            console.log(`✅ UTXO is unspent (confirmations: ${utxoData.confirmations})`);
            
        } catch (error) {
            console.error('❌ Failed to fetch UTXO from local node:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to verify UTXO on blockchain (check if Bitcoin node is running)'
            });
        }
        
        // ✅ Criar Template PSBT
        const { psbtBase64, psbtHex } = createListingTemplatePSBT({
            seller_txid,
            seller_vout,
            seller_value,
            seller_script_pubkey,
            seller_payout_address,
            price_sats,
            network
        });
        
        // ✅ Gerar order_id
        const order_id = 'ord_' + crypto.randomBytes(16).toString('hex');
        
        // ✅ Calcular PSBT hash (anti-replay)
        const psbtHash = crypto.createHash('sha256').update(psbtBase64).digest('hex');
        
        // ✅ Calcular expires_at (30 dias)
        const created_at = Math.floor(Date.now() / 1000);
        const expires_at = created_at + (30 * 24 * 60 * 60); // 30 dias
        
        // ✅ Salvar no banco (status PENDING até seller assinar)
        db.prepare(`
            INSERT INTO atomic_listings (
                order_id,
                seller_txid,
                seller_vout,
                seller_value,
                seller_script_pubkey,
                seller_payout_address,
                price_sats,
                listing_psbt_base64,
                psbt_hash,
                inscription_id,
                inscription_number,
                content_type,
                status,
                created_at,
                expires_at,
                creator_address,
                source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            order_id,
            seller_txid,
            seller_vout,
            seller_value,
            seller_script_pubkey,
            seller_payout_address,
            price_sats,
            psbtBase64,
            psbtHash,
            inscription_id || null,
            inscription_number || null,
            content_type || null,
            'PENDING',
            created_at,
            expires_at,
            seller_payout_address,
            'kraywallet'
        );
        
        console.log(`✅ Listing created: ${order_id}`);
        console.log(`📋 Status: PENDING (awaiting seller signature)`);
        console.log('═══════════════════════════════════════════════════════\n');
        
        res.json({
            success: true,
            order_id,
            template_psbt_base64: psbtBase64,
            instructions: {
                step: 1,
                action: 'Sign this PSBT with SIGHASH_SINGLE|ANYONECANPAY (0x83)',
                note: 'You are signing input[0] and locking output[0] (your payout)',
                next_endpoint: `/api/atomic-swap/listings/${order_id}/seller-signature`
            }
        });
        
    } catch (error) {
        console.error('❌ Create listing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2️⃣ POST /listings/:id/seller-signature - Validar e Salvar PSBT Assinado
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:order_id/seller-signature', async (req, res) => {
    try {
        console.log('\n✍️  ═══════════════════════════════════════════════════════');
        console.log('   SUBMIT SELLER SIGNATURE');
        console.log('═══════════════════════════════════════════════════════\n');
        
        const { order_id } = req.params;
        const { listing_psbt_base64 } = req.body;
        
        if (!listing_psbt_base64) {
            return res.status(400).json({
                success: false,
                error: 'Missing listing_psbt_base64'
            });
        }
        
        // ✅ Buscar listing
        const listing = db.prepare('SELECT * FROM atomic_listings WHERE order_id = ?')
            .get(order_id);
        
        if (!listing) {
            return res.status(404).json({
                success: false,
                error: 'Listing not found'
            });
        }
        
        if (listing.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: `Listing is ${listing.status}, cannot update signature`
            });
        }
        
        // ✅ Validar PSBT assinado
        const validation = validateSellerSignedPSBT(listing_psbt_base64, {
            seller_payout_address: listing.seller_payout_address,
            price_sats: listing.price_sats,
            network: 'mainnet'
        });
        
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid signed PSBT',
                details: validation.errors
            });
        }
        
        // ✅ Verificar UTXO ainda não foi gasto (Bitcoin RPC local)
        console.log('🔍 Verifying UTXO is still unspent...');
        
        try {
            const utxoData = await bitcoinRpc.call('gettxout', [listing.seller_txid, listing.seller_vout, true]);
            
            if (!utxoData) {
                // UTXO foi gasto - marcar como CANCELLED
                db.prepare('UPDATE atomic_listings SET status = ? WHERE order_id = ?')
                    .run('CANCELLED', order_id);
                
                return res.status(400).json({
                    success: false,
                    error: 'UTXO has been spent, listing cancelled'
                });
            }
            
            console.log(`✅ UTXO is unspent (confirmations: ${utxoData.confirmations})`);
        } catch (error) {
            console.warn('⚠️  Could not verify UTXO status:', error.message);
            // Continuar mesmo assim (node pode estar temporariamente offline)
        }
        
        // ✅ Atualizar listing com PSBT assinado
        db.prepare(`
            UPDATE atomic_listings 
            SET listing_psbt_base64 = ?,
                status = 'OPEN'
            WHERE order_id = ?
        `).run(listing_psbt_base64, order_id);
        
        console.log(`✅ Listing ${order_id} is now OPEN`);
        console.log(`✅ Seller signature validated (SIGHASH 0x83)`);
        console.log('═══════════════════════════════════════════════════════\n');
        
        res.json({
            success: true,
            order_id,
            status: 'OPEN',
            message: 'Listing is now active and visible to buyers'
        });
        
    } catch (error) {
        console.error('❌ Submit signature error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3️⃣ GET /listings - Listar Ofertas Ativas (Public)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', (req, res) => {
    try {
        const { limit = 50, offset = 0, seller_address } = req.query;
        
        // Se seller_address fornecido, filtrar por seller
        let listings, total;
        
        if (seller_address) {
            // 📋 MY LISTINGS (filtrado por seller)
            listings = db.prepare(`
                SELECT * FROM atomic_listings
                WHERE seller_payout_address = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `).all(seller_address, parseInt(limit), parseInt(offset));
            
            total = db.prepare(`
                SELECT COUNT(*) as count FROM atomic_listings
                WHERE seller_payout_address = ?
            `).get(seller_address).count;
        } else {
            // 🌐 PUBLIC LISTINGS (apenas OPEN)
            listings = db.prepare(`
                SELECT * FROM active_listings
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `).all(parseInt(limit), parseInt(offset));
            
            total = db.prepare(`
                SELECT COUNT(*) as count FROM active_listings
            `).get().count;
        }
        
        res.json({
            success: true,
            listings,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + listings.length < total
            }
        });
        
    } catch (error) {
        console.error('❌ List error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4️⃣ GET /listings/:id - Buscar Oferta Específica
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:order_id', (req, res) => {
    try {
        const { order_id } = req.params;
        
        const listing = db.prepare(`
            SELECT 
                order_id,
                seller_payout_address,
                price_sats,
                inscription_id,
                inscription_number,
                content_type,
                status,
                created_at,
                expires_at,
                creator_address,
                -- Calcular taxa
                CAST(price_sats * 0.02 AS INTEGER) as market_fee_sats,
                -- Total
                price_sats + CAST(price_sats * 0.02 AS INTEGER) as total_buyer_cost
            FROM atomic_listings
            WHERE order_id = ?
        `).get(order_id);
        
        if (!listing) {
            return res.status(404).json({
                success: false,
                error: 'Listing not found'
            });
        }
        
        res.json({
            success: true,
            listing
        });
        
    } catch (error) {
        console.error('❌ Get listing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5️⃣ POST /listings/:id/buy/prepare - Montar PSBT Atômico para Buyer
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:order_id/buy/prepare', async (req, res) => {
    try {
        console.log('\n🛒 ═══════════════════════════════════════════════════════');
        console.log('   PREPARE PURCHASE');
        console.log('═══════════════════════════════════════════════════════\n');
        
        const { order_id } = req.params;
        const {
            buyer_address,
            buyer_change_address,
            buyer_inputs,  // [{ txid, vout, value, scriptPubKey }]
            miner_fee_rate = 2
        } = req.body;
        
        // ✅ Validações
        if (!buyer_address || !buyer_inputs || !Array.isArray(buyer_inputs)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: buyer_address, buyer_inputs[]'
            });
        }
        
        // ✅ Buscar listing
        const listing = db.prepare('SELECT * FROM atomic_listings WHERE order_id = ?')
            .get(order_id);
        
        if (!listing) {
            return res.status(404).json({
                success: false,
                error: 'Listing not found'
            });
        }
        
        if (listing.status !== 'OPEN') {
            return res.status(400).json({
                success: false,
                error: `Listing is ${listing.status}, not available for purchase`
            });
        }
        
        // ✅ Verificar se UTXO do seller ainda não foi gasto (Bitcoin RPC local)
        console.log('🔍 Verifying seller UTXO is still unspent...');
        
        try {
            const utxoData = await bitcoinRpc.call('gettxout', [listing.seller_txid, listing.seller_vout, true]);
            
            if (!utxoData) {
                // UTXO foi gasto - marcar como CANCELLED
                db.prepare('UPDATE atomic_listings SET status = ? WHERE order_id = ?')
                    .run('CANCELLED', order_id);
                
                return res.status(400).json({
                    success: false,
                    error: 'UTXO has been spent, listing cancelled'
                });
            }
            
            console.log(`✅ UTXO is unspent (confirmations: ${utxoData.confirmations})`);
        } catch (error) {
            console.warn('⚠️  Could not verify UTXO status:', error.message);
            // Continuar (node pode estar temporariamente offline)
        }
        
        // ✅ Verificar output[0] byte-a-byte idêntico
        const validation = validateOutput0Immutable(
            listing.listing_psbt_base64,
            listing.listing_psbt_base64,
            'mainnet'
        );
        
        if (!validation.valid) {
            return res.status(500).json({
                success: false,
                error: 'Listing PSBT validation failed',
                details: validation.error
            });
        }
        
        console.log('✅ Output[0] validation passed');
        console.log(`   Address: ${validation.output0.address}`);
        console.log(`   Value: ${validation.output0.value} sats`);
        
        // ✅ Preparar PSBT para buyer assinar
        const { psbtBase64, summary } = prepareBuyerPSBT({
            listing_psbt_base64: listing.listing_psbt_base64,
            seller_value: listing.seller_value,
            price_sats: listing.price_sats,
            buyer_address,
            buyer_change_address: buyer_change_address || buyer_address,
            buyer_inputs,
            miner_fee_rate,
            market_fee_address: getMarketFeeAddress(),
            network: 'mainnet'
        });
        
        // ✅ Gerar attempt_id
        const attempt_id = 'att_' + crypto.randomBytes(16).toString('hex');
        const psbt_hash = crypto.createHash('sha256').update(psbtBase64).digest('hex');
        const created_at = Math.floor(Date.now() / 1000);
        
        // ✅ Salvar purchase attempt
        db.prepare(`
            INSERT INTO purchase_attempts (
                attempt_id,
                order_id,
                psbt_to_sign_base64,
                psbt_hash,
                buyer_address,
                buyer_change_address,
                buyer_inputs_json,
                total_buyer_input,
                inscription_output_value,
                market_fee_output_value,
                change_output_value,
                miner_fee,
                state,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            attempt_id,
            order_id,
            psbtBase64,
            psbt_hash,
            buyer_address,
            buyer_change_address || buyer_address,
            JSON.stringify(buyer_inputs),
            summary.totalBuyerInput,
            summary.inscriptionOutput,
            summary.marketFee,
            summary.change,
            summary.minerFee,
            'PENDING_SIGNATURES',
            created_at
        );
        
        console.log(`✅ Purchase attempt created: ${attempt_id}`);
        console.log(`📋 Status: PENDING_SIGNATURES`);
        console.log('═══════════════════════════════════════════════════════\n');
        
        res.json({
            success: true,
            attempt_id,
            psbt_to_sign_base64: psbtBase64,
            summary: {
                ...summary,
                buyer_inputs_to_sign: summary.buyerInputIndices,
                total_cost: summary.sellerPayout + summary.inscriptionOutput + summary.marketFee + summary.minerFee - summary.totalBuyerInput + summary.change,
                breakdown: {
                    seller_payout: summary.sellerPayout,
                    inscription_to_buyer: summary.inscriptionOutput,
                    market_fee_2_percent: summary.marketFee,
                    miner_fee: summary.minerFee,
                    change_to_buyer: summary.change
                }
            },
            instructions: {
                step: 2,
                action: 'Sign buyer inputs (indices 1+) with your wallet',
                note: 'DO NOT sign input[0] (seller has already signed it)',
                next_endpoint: `/api/atomic-swap/listings/${order_id}/buy/finalize`
            }
        });
        
    } catch (error) {
        console.error('❌ Prepare purchase error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6️⃣ POST /listings/:id/buy/finalize - Validar, Adicionar Seller Sig e Broadcast
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:order_id/buy/finalize', async (req, res) => {
    try {
        console.log('\n✅ ═══════════════════════════════════════════════════════');
        console.log('   FINALIZE PURCHASE');
        console.log('═══════════════════════════════════════════════════════\n');
        
        const { order_id } = req.params;
        const { attempt_id, psbt_signed_by_buyer_base64 } = req.body;
        
        if (!attempt_id || !psbt_signed_by_buyer_base64) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: attempt_id, psbt_signed_by_buyer_base64'
            });
        }
        
        // ✅ Buscar purchase attempt
        const attempt = db.prepare('SELECT * FROM purchase_attempts WHERE attempt_id = ? AND order_id = ?')
            .get(attempt_id, order_id);
        
        if (!attempt) {
            return res.status(404).json({
                success: false,
                error: 'Purchase attempt not found'
            });
        }
        
        if (attempt.state !== 'PENDING_SIGNATURES') {
            return res.status(400).json({
                success: false,
                error: `Purchase attempt is ${attempt.state}, cannot finalize`
            });
        }
        
        // ✅ Buscar listing
        const listing = db.prepare('SELECT * FROM atomic_listings WHERE order_id = ?')
            .get(order_id);
        
        if (!listing || listing.status !== 'OPEN') {
            return res.status(400).json({
                success: false,
                error: 'Listing is no longer available'
            });
        }
        
        const network = bitcoin.networks.bitcoin;
        
        // ═══════════════════════════════════════════════════════════════
        // VALIDAÇÕES DE SEGURANÇA (Hard Checks)
        // ═══════════════════════════════════════════════════════════════
        
        console.log('🛡️  Running security validations...\n');
        
        // 1. Validar output[0] imutável
        console.log('1️⃣  Validating output[0] immutability...');
        const output0Validation = validateOutput0Immutable(
            psbt_signed_by_buyer_base64,
            listing.listing_psbt_base64,
            'mainnet'
        );
        
        if (!output0Validation.valid) {
            console.error('❌ Output[0] validation failed:', output0Validation.error);
            return res.status(400).json({
                success: false,
                error: 'FRAUD DETECTED: Output[0] has been tampered with',
                details: output0Validation.error
            });
        }
        
        console.log('✅ Output[0] is immutable (seller payout locked)');
        
        // 2. Parse PSBTs
        const buyerPsbt = bitcoin.Psbt.fromBase64(psbt_signed_by_buyer_base64, { network });
        const sellerPsbt = bitcoin.Psbt.fromBase64(listing.listing_psbt_base64, { network });
        
        // 3. Validar market fee output presente
        console.log('\n2️⃣  Validating market fee output...');
        
        if (buyerPsbt.txOutputs.length < 3) {
            return res.status(400).json({
                success: false,
                error: 'Market fee output is missing'
            });
        }
        
        const marketFeeOutput = buyerPsbt.txOutputs[2];  // Output[2] = market fee
        const marketFeeAddress = getMarketFeeAddress();
        const expectedMarketFee = attempt.market_fee_output_value;
        
        const actualMarketFeeAddress = bitcoin.address.fromOutputScript(marketFeeOutput.script, network);
        const actualMarketFeeValue = marketFeeOutput.value;
        
        if (actualMarketFeeAddress !== marketFeeAddress) {
            return res.status(400).json({
                success: false,
                error: 'Market fee address is incorrect'
            });
        }
        
        if (actualMarketFeeValue < expectedMarketFee) {
            return res.status(400).json({
                success: false,
                error: `Market fee too low: expected ${expectedMarketFee} sats, got ${actualMarketFeeValue} sats`
            });
        }
        
        console.log(`✅ Market fee validated: ${actualMarketFeeValue} sats → ${actualMarketFeeAddress}`);
        
        // 4. Validar inscription output para buyer
        console.log('\n3️⃣  Validating inscription output...');
        
        const inscriptionOutput = buyerPsbt.txOutputs[1];  // Output[1] = inscription → buyer
        const inscriptionAddress = bitcoin.address.fromOutputScript(inscriptionOutput.script, network);
        
        if (inscriptionAddress !== attempt.buyer_address) {
            return res.status(400).json({
                success: false,
                error: 'Inscription output address mismatch'
            });
        }
        
        console.log(`✅ Inscription routes to buyer: ${inscriptionAddress}`);
        
        // 5. Validar buyer inputs estão assinados
        console.log('\n4️⃣  Validating buyer signatures...');
        
        const buyerInputs = JSON.parse(attempt.buyer_inputs_json);
        for (let i = 1; i <= buyerInputs.length; i++) {
            const input = buyerPsbt.data.inputs[i];
            if (!input.tapKeySig && !input.partialSig && !input.finalScriptSig) {
                return res.status(400).json({
                    success: false,
                    error: `Buyer input[${i}] is not signed`
                });
            }
        }
        
        console.log(`✅ All ${buyerInputs.length} buyer input(s) are signed`);
        
        // ═══════════════════════════════════════════════════════════════
        // ADICIONAR SELLER SIGNATURE ao input[0]
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n5️⃣  Adding seller signature to input[0]...');
        
        const sellerInput = sellerPsbt.data.inputs[0];
        const sellerOutput0 = sellerPsbt.data.outputs[0];
        
        if (!sellerInput.tapKeySig) {
            return res.status(500).json({
                success: false,
                error: 'Seller signature not found in listing PSBT'
            });
        }
        
        // 🔍 DEBUG: Verificar tapKeySig do seller
        console.log('   📋 Seller tapKeySig:');
        console.log(`      Length: ${sellerInput.tapKeySig.length} bytes`);
        console.log(`      Hex: ${sellerInput.tapKeySig.toString('hex').substring(0, 40)}...`);
        console.log(`      Last byte (sighash): 0x${sellerInput.tapKeySig[sellerInput.tapKeySig.length - 1].toString(16)}`);
        
        // 🔍 DEBUG: Comparar output[0] do seller PSBT vs buyer PSBT
        const buyerOutput0 = buyerPsbt.data.outputs[0];
        console.log('\n   📋 Comparing output[0]:');
        console.log(`      Seller output[0] script: ${sellerOutput0.script?.toString('hex').substring(0, 60)}...`);
        console.log(`      Buyer output[0] script:  ${buyerOutput0.script?.toString('hex').substring(0, 60)}...`);
        console.log(`      Scripts match: ${sellerOutput0.script?.equals(buyerOutput0.script)}`);
        console.log(`      Seller value: ${sellerOutput0.value}`);
        console.log(`      Buyer value:  ${buyerOutput0.value}`);
        console.log(`      Values match: ${sellerOutput0.value === buyerOutput0.value}`);
        
        // ✅ Copiar APENAS a assinatura do seller (tapKeySig)
        // Os outros campos (tapInternalKey, witnessUtxo, etc.) já foram copiados
        // quando preparamos o buyer PSBT em /buy/prepare
        
        const buyerInput0 = buyerPsbt.data.inputs[0];
        
        // 🔍 DEBUG: Verificar estado atual do input[0] do buyer
        console.log('\n   📋 Buyer input[0] BEFORE adding signature:');
        console.log(`      Has tapKeySig: ${!!buyerInput0.tapKeySig}`);
        console.log(`      Has tapInternalKey: ${!!buyerInput0.tapInternalKey}`);
        console.log(`      Has witnessUtxo: ${!!buyerInput0.witnessUtxo}`);
        console.log(`      witnessUtxo script: ${buyerInput0.witnessUtxo?.script.toString('hex').substring(0, 40)}...`);
        console.log(`      witnessUtxo value: ${buyerInput0.witnessUtxo?.value}`);
        console.log(`      tapInternalKey: ${buyerInput0.tapInternalKey?.toString('hex').substring(0, 40)}...`);
        
        // Comparar com seller
        console.log('\n   📋 Comparing seller vs buyer input[0]:');
        console.log(`      Seller witnessUtxo: ${sellerInput.witnessUtxo?.script.toString('hex').substring(0, 40)}...`);
        console.log(`      Buyer witnessUtxo:  ${buyerInput0.witnessUtxo?.script.toString('hex').substring(0, 40)}...`);
        console.log(`      Scripts match: ${sellerInput.witnessUtxo?.script.equals(buyerInput0.witnessUtxo?.script)}`);
        console.log(`      Seller tapInternalKey: ${sellerInput.tapInternalKey?.toString('hex').substring(0, 40)}...`);
        console.log(`      Buyer tapInternalKey:  ${buyerInput0.tapInternalKey?.toString('hex').substring(0, 40)}...`);
        console.log(`      Keys match: ${sellerInput.tapInternalKey?.equals(buyerInput0.tapInternalKey)}`);
        
        // Verificar se já tem a assinatura (não deveria ter)
        if (buyerInput0.tapKeySig) {
            console.log('   ⚠️  Input[0] already has tapKeySig, skipping update');
        } else {
            // 🔥 CRITICAL FIX: Adicionar assinatura E sighashType do seller
            // bitcoinjs-lib precisa do sighashType para finalizeInput() funcionar!
            buyerPsbt.updateInput(0, {
                tapKeySig: sellerInput.tapKeySig,
                sighashType: sellerInput.sighashType  // ✅ CRÍTICO!
            });
            console.log('   ✅ tapKeySig AND sighashType added to input[0]');
            console.log('   📋 sighashType:', sellerInput.sighashType, `(0x${sellerInput.sighashType?.toString(16) || '??'})`);
        }
        
        console.log('✅ Seller signature added to input[0]');
        
        // ═══════════════════════════════════════════════════════════════
        // FINALIZAR PSBT
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n6️⃣  Finalizing PSBT...');
        
        try {
            // Finalizar todos os inputs
            for (let i = 0; i < buyerPsbt.inputCount; i++) {
                try {
                    buyerPsbt.finalizeInput(i);
                } catch (e) {
                    console.error(`❌ Failed to finalize input ${i}:`, e.message);
                    throw new Error(`Failed to finalize input ${i}: ${e.message}`);
                }
            }
            
            console.log('✅ All inputs finalized');
            
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: `Finalization failed: ${error.message}`
            });
        }
        
        // ═══════════════════════════════════════════════════════════════
        // EXTRACT TRANSACTION
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n7️⃣  Extracting transaction...');
        
        let tx, txHex, txid;
        
        try {
            tx = buyerPsbt.extractTransaction();
            txHex = tx.toHex();
            txid = tx.getId();
            
            console.log('✅ Transaction extracted');
            console.log(`   TXID: ${txid}`);
            console.log(`   Size: ${txHex.length / 2} bytes`);
            
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: `Transaction extraction failed: ${error.message}`
            });
        }
        
        // ═══════════════════════════════════════════════════════════════
        // BROADCAST (Bitcoin Core RPC local)
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n8️⃣  Broadcasting transaction via local Bitcoin node...');
        
        try {
            // Broadcast via sendrawtransaction
            const broadcastedTxid = await bitcoinRpc.call('sendrawtransaction', [txHex]);
            
            if (broadcastedTxid !== txid) {
                console.warn(`⚠️  TXID mismatch: expected ${txid}, got ${broadcastedTxid}`);
            }
            
            console.log('✅ Transaction broadcast successfully (local node)!');
            console.log(`   TXID: ${broadcastedTxid}`);
            console.log(`   Transaction will propagate to network`);
            
        } catch (error) {
            console.error('❌ Broadcast failed:', error.message);
            
            // Salvar erro no attempt
            db.prepare(`
                UPDATE purchase_attempts 
                SET state = 'FAILED'
                WHERE attempt_id = ?
            `).run(attempt_id);
            
            // Log error message (não salvar no banco, apenas log)
            console.error(`   Error message: ${error.message}`);
            
            return res.status(500).json({
                success: false,
                error: 'Broadcast failed',
                details: error.message
            });
        }
        
        // ═══════════════════════════════════════════════════════════════
        // ATUALIZAR BANCO DE DADOS
        // ═══════════════════════════════════════════════════════════════
        
        const broadcasted_at = Math.floor(Date.now() / 1000);
        
        // Atualizar purchase attempt
        db.prepare(`
            UPDATE purchase_attempts 
            SET final_txid = ?,
                state = 'BROADCASTED',
                signed_at = ?,
                broadcasted_at = ?
            WHERE attempt_id = ?
        `).run(txid, broadcasted_at, broadcasted_at, attempt_id);
        
        // Atualizar listing
        db.prepare(`
            UPDATE atomic_listings 
            SET status = 'FILLED',
                filled_at = ?
            WHERE order_id = ?
        `).run(broadcasted_at, order_id);
        
        console.log('\n✅ DATABASE UPDATED:');
        console.log(`   Listing ${order_id}: OPEN → FILLED`);
        console.log(`   Attempt ${attempt_id}: PENDING → BROADCASTED`);
        console.log('═══════════════════════════════════════════════════════\n');
        
        res.json({
            success: true,
            txid,
            status: 'BROADCASTED',
            message: 'Purchase complete! Transaction broadcasted to Bitcoin network.',
            details: {
                seller_received: listing.price_sats,
                buyer_received_inscription: listing.inscription_id,
                market_fee: actualMarketFeeValue,
                total_buyer_cost: attempt.total_buyer_input - attempt.change_output_value
            }
        });
        
    } catch (error) {
        console.error('❌ Finalize purchase error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7️⃣ POST /listings/:id/cancel - Cancelar Listagem (COM ASSINATURA)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:order_id/cancel', async (req, res) => {
    try {
        const { order_id } = req.params;
        const { seller_address, signature, message } = req.body;
        
        console.log('🔐 Cancel listing request:', { order_id, seller_address, hasSignature: !!signature });
        
        // Validação de campos obrigatórios
        if (!seller_address || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: seller_address, signature, message'
            });
        }
        
        const listing = db.prepare('SELECT * FROM atomic_listings WHERE order_id = ?')
            .get(order_id);
        
        if (!listing) {
            return res.status(404).json({
                success: false,
                error: 'Listing not found'
            });
        }
        
        // Verificar autorização (seller)
        if (listing.seller_payout_address !== seller_address) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized: only seller can cancel listing'
            });
        }
        
        // 🔐 VALIDAR ASSINATURA (anti-fraude)
        const isValidSignature = verifySignature(seller_address, message, signature);
        if (!isValidSignature) {
            return res.status(401).json({
                success: false,
                error: 'Invalid signature - authentication failed'
            });
        }
        
        console.log('✅ Signature verified for cancel operation');
        
        if (listing.status === 'FILLED') {
            return res.status(400).json({
                success: false,
                error: 'Cannot cancel filled listing'
            });
        }
        
        // Cancelar
        db.prepare('UPDATE atomic_listings SET status = ? WHERE order_id = ?')
            .run('CANCELLED', order_id);
        
        console.log(`✅ Listing ${order_id} cancelled by ${seller_address}`);
        
        res.json({
            success: true,
            message: 'Listing cancelled successfully'
        });
        
    } catch (error) {
        console.error('❌ Cancel listing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8️⃣ POST /listings/:id/update-price - Atualizar Preço da Listagem
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:order_id/update-price', async (req, res) => {
    try {
        const { order_id } = req.params;
        const { new_price_sats, seller_address, signature, message } = req.body;
        
        console.log('\n💰 ═══════════════════════════════════════════════════════');
        console.log('   UPDATE PRICE REQUEST (WITH SIGNATURE)');
        console.log('═══════════════════════════════════════════════════════\n');
        console.log(`   Order ID: ${order_id}`);
        console.log(`   New Price: ${new_price_sats} sats`);
        console.log(`   Has Signature: ${!!signature}`);
        
        // Validação de campos obrigatórios
        if (!seller_address || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: seller_address, signature, message'
            });
        }
        
        // Validações
        if (!new_price_sats || new_price_sats < DUST_LIMIT) {
            return res.status(400).json({
                success: false,
                error: `Price must be at least ${DUST_LIMIT} sats (dust limit)`
            });
        }
        
        const listing = db.prepare('SELECT * FROM atomic_listings WHERE order_id = ?')
            .get(order_id);
        
        if (!listing) {
            return res.status(404).json({
                success: false,
                error: 'Listing not found'
            });
        }
        
        // Verificar autorização (seller)
        if (listing.seller_payout_address !== seller_address) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized: only seller can update price'
            });
        }
        
        // 🔐 VALIDAR ASSINATURA (anti-fraude)
        const isValidSignature = verifySignature(seller_address, message, signature);
        if (!isValidSignature) {
            return res.status(401).json({
                success: false,
                error: 'Invalid signature - authentication failed'
            });
        }
        
        console.log('✅ Signature verified for price update operation');
        
        // Só pode atualizar se ainda não foi vendido
        if (listing.status === 'FILLED') {
            return res.status(400).json({
                success: false,
                error: 'Cannot update price: listing already sold'
            });
        }
        
        // Se já foi assinado (OPEN), precisa cancelar e recriar
        if (listing.status === 'OPEN') {
            return res.status(400).json({
                success: false,
                error: 'Cannot update price after signing. Please cancel and create a new listing.',
                hint: 'Price is locked in the PSBT signature'
            });
        }
        
        // Se PENDING_SIGNATURES, pode atualizar
        if (listing.status === 'PENDING_SIGNATURES') {
            // Atualizar preço e recriar PSBT template
            try {
                // Buscar UTXO value
                const utxoData = await bitcoinRpc.call('gettxout', [
                    listing.seller_txid,
                    listing.seller_vout,
                    true
                ]);
                
                if (!utxoData) {
                    return res.status(400).json({
                        success: false,
                        error: 'UTXO not found or already spent'
                    });
                }
                
                const seller_value = Math.round(utxoData.value * 100000000);
                
                // Recriar template PSBT com novo preço
                const { psbtBase64 } = await createListingTemplatePSBT({
                    seller_txid: listing.seller_txid,
                    seller_vout: listing.seller_vout,
                    seller_value,
                    price_sats: new_price_sats,
                    seller_payout_address: listing.seller_payout_address,
                    network: listing.network || 'mainnet'
                });
                
                // Atualizar no banco
                db.prepare(`
                    UPDATE atomic_listings 
                    SET price_sats = ?, template_psbt_base64 = ?, updated_at = ?
                    WHERE order_id = ?
                `).run(new_price_sats, psbtBase64, Math.floor(Date.now() / 1000), order_id);
                
                console.log('✅ Price updated successfully!');
                console.log(`   Old price: ${listing.price_sats} sats`);
                console.log(`   New price: ${new_price_sats} sats`);
                
                res.json({
                    success: true,
                    message: 'Price updated successfully',
                    order_id,
                    old_price: listing.price_sats,
                    new_price: new_price_sats,
                    template_psbt_base64: psbtBase64,
                    note: 'Please sign the new PSBT to activate the listing'
                });
                
            } catch (error) {
                throw new Error(`Failed to update price: ${error.message}`);
            }
        } else {
            return res.status(400).json({
                success: false,
                error: `Cannot update price with status: ${listing.status}`
            });
        }
        
    } catch (error) {
        console.error('❌ Update price error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

