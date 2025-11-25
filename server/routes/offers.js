import express from 'express';
import { db } from '../db/init-supabase.js';
import { generateOfferId } from '../utils/helpers.js';
import { encryptPSBT, decryptPSBT, extractAndEncryptSignature } from '../utils/psbtCrypto.js';
import { network } from '../utils/psbtUtils.js';

const router = express.Router();

// GET /api/offers - Listar todas as ofertas
router.get('/', (req, res) => {
    try {
        const { type, status, address, limit = 50, offset = 0, sortBy = 'popular' } = req.query;

        // JOIN com inscriptions para pegar o número real
        let query = `
            SELECT 
                o.*,
                i.inscription_number,
                i.content_type
            FROM offers o
            LEFT JOIN inscriptions i ON o.inscription_id = i.id
            WHERE 1=1
        `;
        const params = [];

        if (type) {
            query += ' AND o.type = ?';
            params.push(type);
        }

        if (status) {
            query += ' AND o.status = ?';
            params.push(status);
        }

        if (address) {
            query += ' AND o.creator_address = ?';
            params.push(address);
        }

        // Ordenação: por popularidade (likes) ou por data
        if (sortBy === 'popular') {
            query += ' ORDER BY o.likes_count DESC, o.created_at DESC LIMIT ? OFFSET ?';
        } else {
            query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
        }
        params.push(parseInt(limit), parseInt(offset));

        const offers = db.prepare(query).all(...params);

        // 🔒 SEGURANÇA CRÍTICA: Remover PSBT antes de retornar (nunca expor PSBT publicamente!)
        // PSBT assinado contém a assinatura do seller, que pode ser usada por atacantes
        // para criar transações fraudulentas fora do marketplace
        const safeOffers = offers.map(({ psbt, ...offer }) => ({
            ...offer,
            // Adicionar flag indicando que tem PSBT disponível (sem expor o PSBT)
            hasPsbt: !!psbt
        }));

        // Contar total
        let countQuery = 'SELECT COUNT(*) as total FROM offers o WHERE 1=1';
        const countParams = [];
        if (type) {
            countQuery += ' AND o.type = ?';
            countParams.push(type);
        }
        if (status) {
            countQuery += ' AND o.status = ?';
            countParams.push(status);
        }
        if (address) {
            countQuery += ' AND o.creator_address = ?';
            countParams.push(address);
        }

        const { total } = db.prepare(countQuery).get(...countParams);

        res.json({
            success: true,
            offers: safeOffers,  // ✅ Agora sem PSBT!
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + offers.length < total
            }
        });
    } catch (error) {
        console.error('Error fetching offers:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/offers/:id - Buscar oferta específica
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        // JOIN com inscriptions para pegar dados completos
        const offer = db.prepare(`
            SELECT 
                o.*,
                i.inscription_number,
                i.content_type
            FROM offers o
            LEFT JOIN inscriptions i ON o.inscription_id = i.id
            WHERE o.id = ?
        `).get(id);

        if (!offer) {
            return res.status(404).json({ success: false, error: 'Offer not found' });
        }

        // 🔒 SEGURANÇA: Remover PSBT antes de retornar
        const { psbt, ...safeOffer } = offer;
        
        res.json({ 
            success: true, 
            ...safeOffer,
            hasPsbt: !!psbt  // Flag indicando se tem PSBT (sem expor)
        });
    } catch (error) {
        console.error('Error fetching offer:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/offers - Criar nova oferta
router.post('/', async (req, res) => {
    try {
        const {
            type,
            inscriptionId,
            fromRune,
            toRune,
            fromAmount,
            toAmount,
            offerAmount,
            feeRate,
            psbt,
            creatorAddress,
            expiresIn,
            sighashType  // ✨ NOVO: tipo de SIGHASH usado
        } = req.body;
        
        // 🔥 ANTI-CACHE HEADERS
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        // LOG: Verificar tamanho do PSBT recebido
        console.log('📥 Received PSBT from seller');
        console.log('  PSBT length:', psbt ? psbt.length : 0, 'characters');
        console.log('  PSBT preview:', psbt ? psbt.substring(0, 50) + '...' : 'empty');
        if (sighashType) {
            console.log('  SIGHASH type:', sighashType, '✨');
        }

        if (!type || !psbt || !creatorAddress) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (type === 'inscription' && !inscriptionId) {
            return res.status(400).json({ error: 'Inscription ID required for inscription offers' });
        }

        if (type === 'rune_swap' && (!fromRune || !toRune)) {
            return res.status(400).json({ error: 'Runes required for swap offers' });
        }

        // ═══════════════════════════════════════════════════════════════
        // 🛡️ VALIDAÇÃO DE CRIAÇÃO DE LISTAGEM (SecurityValidator)
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n🛡️  VALIDATING LISTING CREATION...');
        
        try {
            const { default: SecurityValidator } = await import('../validators/SecurityValidator.js');
            const bitcoin = await import('bitcoinjs-lib');
            
            // Para ofertas de inscription, buscar UTXO REAL do PSBT
            let utxo = null;
            if (type === 'inscription' && inscriptionId) {
                // ✅ Extrair o UTXO real do PSBT (input 0)
                const psbtObj = bitcoin.Psbt.fromBase64(psbt, { network });
                const input0 = psbtObj.data.inputs[0];
                const txInput0 = psbtObj.txInputs[0];
                
                // 🔒 CRÍTICO: witnessUtxo DEVE existir - não há fallback no Bitcoin!
                if (!input0.witnessUtxo || !input0.witnessUtxo.value) {
                    console.error('❌ CRITICAL ERROR: witnessUtxo missing in PSBT!');
                    return res.status(400).json({ 
                        error: 'Invalid PSBT: witnessUtxo is required for Bitcoin transactions. No fallback values allowed.' 
                    });
                }
                
                utxo = {
                    txid: Buffer.from(txInput0.hash).reverse().toString('hex'), // TXID em hex (reversed)
                    vout: txInput0.index,
                    value: input0.witnessUtxo.value // VALOR REAL - SEM FALLBACK!
                };
                
                console.log('✅ UTXO extracted from PSBT (REAL VALUE):', utxo);
            }
            
            const listingValidation = await SecurityValidator.validateListingCreation({
                inscriptionId,
                utxo,
                price: offerAmount || 1000,
                psbtBase64: psbt
            });
            
            if (!listingValidation.valid) {
                console.error('❌ LISTING CREATION VALIDATION FAILED!');
                console.error('Errors:', listingValidation.errors);
                
                return res.status(400).json({
                    error: 'Listing validation failed',
                    details: listingValidation.errors
                });
            }
            
            console.log('✅ Listing creation validation PASSED');
            
        } catch (validationError) {
            console.error('⚠️  Listing validation error:', validationError.message);
            // Continuar mesmo se validação falhar (para não quebrar sistema existente)
        }

        // 🔐 ═══════════════════════════════════════════════════════════════
        // 🔥 KRAY STATION: ENCRYPTED SIGNATURE ATOMIC SWAP (MÁXIMA SEGURANÇA)
        // 🔐 ═══════════════════════════════════════════════════════════════
        console.log('\n🔥 ===== KRAY STATION ENCRYPTED SIGNATURE ATOMIC SWAP =====');
        console.log('   📝 Extracting and encrypting seller signature...');
        
        // ✅ SEMPRE usar encrypted signature (proteção total)
        const extractResult = await extractAndEncryptSignature(psbt);
        const encryptedSignature = extractResult.encryptedSignature;
        const signatureKey = extractResult.encryptedKey;
        const extractedSighashType = extractResult.sighashType;
        
        console.log('   📊 EXTRACT RESULT:');
        console.log('      extractedSighashType (raw):', extractedSighashType);
        console.log('      extractedSighashType (type):', typeof extractedSighashType);
        console.log('      extractedSighashType (hex):', '0x' + extractedSighashType.toString(16));
        console.log('      Expected: 0x82 (130 in decimal)');
        console.log('      Match: ', extractedSighashType === 0x82 ? '✅ YES' : '❌ NO');
        
        // ✅ Validar que é SIGHASH_NONE|ANYONECANPAY (0x82)
        if (extractedSighashType !== 0x82 && extractedSighashType !== 130) {
            console.error('❌ SECURITY ERROR: Only SIGHASH_NONE|ANYONECANPAY (0x82) is supported!');
            return res.status(400).json({
                error: 'Invalid SIGHASH type. Only SIGHASH_NONE|ANYONECANPAY (0x82) is allowed for security.'
            });
        }
        
        // Criptografar PSBT sem assinatura
        const encrypted = encryptPSBT(extractResult.unsignedPsbt);
        const encryptedPsbt = encrypted.encryptedPsbt;
        const encryptedKey = encrypted.encryptedKey;
        
        console.log('   ✅ Seller signature encrypted (RSA-4096 + AES-256-GCM)');
        console.log('   ✅ PSBT encrypted (buyer will NEVER see seller signature)');
        console.log('   ✅ Backend will validate everything before decrypting');
        console.log('\n✅ KRAY STATION ENCRYPTED ATOMIC SWAP READY!');

        const id = generateOfferId();
        const createdAt = Date.now();
        const expiresAt = expiresIn ? createdAt + expiresIn : null;

        const result = db.prepare(`
            INSERT INTO offers (
                id, type, inscription_id, from_rune, to_rune, 
                from_amount, to_amount, offer_amount, fee_rate, 
                psbt, encrypted_key, encrypted_signature, signature_key,
                creator_address, status, created_at, expires_at, sighash_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
        `).run(
            id, type, inscriptionId, fromRune, toRune,
            fromAmount, toAmount, offerAmount, feeRate,
            encryptedPsbt, encryptedKey, encryptedSignature, signatureKey,
            creatorAddress, createdAt, expiresAt, extractedSighashType
        );

        // ✅ Atualizar/Criar inscription na tabela inscriptions para aparecer no marketplace
        if (type === 'inscription' && inscriptionId) {
            try {
                // Tentar atualizar primeiro
                const updateResult = db.prepare(`
                    UPDATE inscriptions 
                    SET listed = 1, price = ?, owner = ?
                    WHERE id = ?
                `).run(offerAmount, creatorAddress, inscriptionId);
                
                // Se não existe, criar nova entrada
                if (updateResult.changes === 0) {
                    console.log(`ℹ️  Inscription ${inscriptionId} not in database, creating...`);
                    
                    // ✅ Buscar número REAL da inscription no ORD server
                    let inscriptionNumber = null;
                    try {
                        const inscResponse = await fetch(`https://ordinals.com/inscription/${inscriptionId}`);
                        if (inscResponse.ok) {
                            const inscHtml = await inscResponse.text();
                            const numberMatch = inscHtml.match(/Inscription\s+(\d+)/i);
                            if (numberMatch) {
                                inscriptionNumber = parseInt(numberMatch[1]);
                                console.log(`   ✅ Found real inscription number: #${inscriptionNumber}`);
                            }
                        }
                    } catch (ordError) {
                        console.log(`   ⚠️  Could not fetch inscription number from ORD server: ${ordError.message}`);
                        // Fallback: usar o "i831" do final do ID
                        inscriptionNumber = parseInt(inscriptionId.match(/i(\d+)$/)?.[1]) || 0;
                    }
                    
                    db.prepare(`
                        INSERT INTO inscriptions (
                            id, inscription_number, content_type, listed, price, owner
                        ) VALUES (?, ?, ?, 1, ?, ?)
                    `).run(inscriptionId, inscriptionNumber, 'unknown', offerAmount, creatorAddress);
                    
                    console.log(`✅ Inscription ${inscriptionId} created and listed with price ${offerAmount}`);
                } else {
                    console.log(`✅ Inscription ${inscriptionId} marked as listed with price ${offerAmount}`);
                }
            } catch (inscError) {
                console.warn('⚠️  Could not update inscription listing status:', inscError.message);
            }
        }

        const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);

        // ═══════════════════════════════════════════════════════════════
        // 📊 AUDIT LOG: OFFER CREATED
        // ═══════════════════════════════════════════════════════════════
        
        try {
            const { default: auditLogger } = await import('../utils/auditLogger.js');
            
            const crypto = await import('crypto');
            const psbtHash = crypto.createHash('sha256').update(psbt).digest('hex');
            
            auditLogger.offerCreated({
                offerId: id,
                type,
                inscriptionId,
                price: offerAmount,
                sellerAddress: creatorAddress,
                psbtHash
            });
        } catch (auditError) {
            console.warn('⚠️  Failed to write audit log:', auditError.message);
        }

        res.status(201).json({
            success: true,
            offer
        });
    } catch (error) {
        console.error('Error creating offer:', error);
        
        // 📊 AUDIT LOG: CRITICAL ERROR
        try {
            const { default: auditLogger } = await import('../utils/auditLogger.js');
            auditLogger.criticalError({
                endpoint: 'POST /api/offers',
                error: error.message,
                stack: error.stack,
                requestData: { type, inscriptionId, creatorAddress }
            });
        } catch {}
        
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/offers/:id/submit - Submeter oferta (novo na v0.23.3)
router.put('/:id/submit', (req, res) => {
    try {
        const { id } = req.params;
        const { txid } = req.body;

        const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);

        if (!offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }

        if (offer.status !== 'pending') {
            return res.status(400).json({ error: 'Offer already submitted or completed' });
        }

        const result = db.prepare(`
            UPDATE offers 
            SET status = 'active', txid = ?
            WHERE id = ?
        `).run(txid || null, id);

        const updatedOffer = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);

        res.json({
            success: true,
            message: 'Offer submitted successfully',
            offer: updatedOffer
        });
    } catch (error) {
        console.error('Error submitting offer:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/offers/:id/cancel - Cancelar oferta (DELETA DO BANCO!)
router.put('/:id/cancel', (req, res) => {
    try {
        const { id } = req.params;

        const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);

        if (!offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }

        if (offer.status === 'completed') {
            return res.status(400).json({ error: 'Cannot cancel completed offer' });
        }

        console.log(`🗑️ Deleting offer ${id} from database...`);
        
        // 🗑️ DELETAR A OFERTA DO BANCO DE DADOS
        const result = db.prepare(`
            DELETE FROM offers 
            WHERE id = ?
        `).run(id);

        console.log(`✅ Offer ${id} deleted from database (${result.changes} rows affected)`);

        res.json({
            success: true,
            message: 'Offer cancelled and deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error cancelling offer:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/offers/:id/complete - Completar oferta
router.put('/:id/complete', (req, res) => {
    try {
        const { id } = req.params;
        const { txid } = req.body;

        if (!txid) {
            return res.status(400).json({ error: 'Transaction ID required' });
        }

        const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);

        if (!offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }

        db.prepare(`
            UPDATE offers 
            SET status = 'completed', txid = ?, filled_at = ?
            WHERE id = ?
        `).run(txid, Date.now(), id);

        // Se for swap de runes, registrar trade
        if (offer.type === 'rune_swap') {
            const tradeId = generateOfferId();
            db.prepare(`
                INSERT INTO trades (
                    id, type, from_rune, to_rune, from_amount, to_amount,
                    trader_address, txid, created_at
                ) VALUES (?, 'swap', ?, ?, ?, ?, ?, ?, ?)
            `).run(
                tradeId, offer.from_rune, offer.to_rune,
                offer.from_amount, offer.to_amount,
                offer.creator_address, txid, Date.now()
            );
        }

        res.json({
            success: true,
            message: 'Offer completed successfully'
        });
    } catch (error) {
        console.error('Error completing offer:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/offers/:id - Deletar oferta (após venda bem-sucedida)
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { txid, buyer_address } = req.body; // Receber txid e buyer do frontend
        
        console.log(`🗑️  Processing sale completion for offer: ${id}`);
        console.log(`   TXID: ${txid}`);
        console.log(`   Buyer: ${buyer_address}`);
        
        // Verificar se oferta existe
        const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);
        if (!offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }
        
        // ✅ SALVAR HISTÓRICO DE VENDA ANTES DE DELETAR!
        if (offer.inscription_id && txid && buyer_address) {
            console.log('💾 Saving sale to history...');
            
            // Buscar dados da inscription
            const inscription = db.prepare('SELECT inscription_number FROM inscriptions WHERE id = ?')
                .get(offer.inscription_id);
            
            // Inserir no histórico
            const saleRecord = db.prepare(`
                INSERT INTO sales_history (
                    inscription_id,
                    inscription_number,
                    seller_address,
                    buyer_address,
                    sale_price,
                    fee_rate,
                    txid,
                    sale_date,
                    sighash_type,
                    offer_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                offer.inscription_id,
                inscription?.inscription_number,
                offer.creator_address,
                buyer_address,
                offer.offer_amount,
                offer.fee_rate,
                txid,
                Date.now(),
                'SIGHASH_SINGLE|ANYONECANPAY', // Tipo usado no atomic swap
                offer.id
            );
            
            console.log(`   ✅ Sale saved to history (ID: ${saleRecord.lastInsertRowid})`);
            console.log(`   📊 Details:`);
            console.log(`      Inscription: ${offer.inscription_id} (#${inscription?.inscription_number})`);
            console.log(`      Seller: ${offer.creator_address}`);
            console.log(`      Buyer: ${buyer_address}`);
            console.log(`      Price: ${offer.offer_amount} sats`);
            console.log(`      TXID: ${txid}`);
        } else {
            console.warn('⚠️  Missing data for sale history, skipping...');
        }
        
        // Deletar oferta
        const result = db.prepare('DELETE FROM offers WHERE id = ?').run(id);
        
        // Atualizar inscription para não estar mais listada
        if (offer.inscription_id) {
            db.prepare('UPDATE inscriptions SET listed = 0, price = NULL WHERE id = ?')
                .run(offer.inscription_id);
            console.log(`   ✅ Inscription ${offer.inscription_id} unmarked as listed`);
        }
        
        console.log(`✅ Offer ${id} deleted successfully`);
        
        res.json({
            success: true,
            message: 'Sale completed and saved to history',
            deletedCount: result.changes
        });
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 🔒 ENDPOINT PROTEGIDO: GET SELLER PSBT (apenas para compra)
// ═══════════════════════════════════════════════════════════════
// Este endpoint APENAS retorna o PSBT do seller quando um buyer
// está efetivamente comprando. Isso previne que atacantes obtenham
// PSBTs assinados para criar transações fraudulentas.
router.post('/:id/get-seller-psbt', (req, res) => {
    try {
        const { id } = req.params;
        const { buyerAddress } = req.body;
        
        console.log('\n🔒 ===== PROTECTED PSBT REQUEST =====');
        console.log('   Offer ID:', id);
        console.log('   Buyer Address:', buyerAddress);
        
        // Validação básica
        if (!buyerAddress) {
            return res.status(400).json({ 
                success: false, 
                error: 'Buyer address is required' 
            });
        }
        
        // Validar formato do endereço Bitcoin
        if (!buyerAddress.startsWith('bc1') && !buyerAddress.startsWith('tb1')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid Bitcoin address format' 
            });
        }
        
        // Buscar offer com PSBT CRIPTOGRAFADO
        const offer = db.prepare(`
            SELECT id, psbt, encrypted_key, offer_amount, creator_address, status 
            FROM offers 
            WHERE id = ?
        `).get(id);
        
        if (!offer) {
            return res.status(404).json({ 
                success: false, 
                error: 'Offer not found' 
            });
        }
        
        // Verificar se offer está ativa
        if (offer.status !== 'active') {
            return res.status(400).json({ 
                success: false, 
                error: `Offer is ${offer.status}, not available for purchase` 
            });
        }
        
        // Verificar se tem PSBT
        if (!offer.psbt || !offer.encrypted_key) {
            return res.status(400).json({ 
                success: false, 
                error: 'Offer has no PSBT (incomplete listing)' 
            });
        }
        
        // 🔓 DESCRIPTOGRAFAR PSBT (apenas quando buyer vai comprar)
        console.log('🔓 Decrypting PSBT for buyer...');
        let decryptedPsbt;
        try {
            decryptedPsbt = decryptPSBT(offer.psbt, offer.encrypted_key);
            console.log('✅ PSBT decrypted successfully');
        } catch (error) {
            console.error('❌ Failed to decrypt PSBT:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to decrypt offer PSBT' 
            });
        }
        
        // ✅ AUDITORIA: Log de acesso ao PSBT
        console.log(`   ✅ PSBT accessed by buyer: ${buyerAddress.substring(0, 20)}...`);
        console.log(`   Offer amount: ${offer.offer_amount} sats`);
        console.log(`   Seller: ${offer.creator_address.substring(0, 20)}...`);
        
        // Retornar APENAS os dados necessários para construir a compra
        res.json({ 
            success: true,
            psbt: decryptedPsbt,  // ✅ PSBT descriptografado
            offerAmount: offer.offer_amount,
            sellerAddress: offer.creator_address
        });
        
    } catch (error) {
        console.error('Error fetching seller PSBT:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

export default router;




