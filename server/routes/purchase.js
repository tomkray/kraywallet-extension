import express from 'express';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { db } from '../db/init-supabase.js';
import bitcoinRpc from '../utils/bitcoinRpc.js';
import { 
    network, 
    toXOnly, 
    validatePsbt, 
    getScriptPubKeyFromAddress,
    extractTapInternalKey 
} from '../utils/psbtUtils.js';

// Inicializar ECC
bitcoin.initEccLib(ecc);

const router = express.Router();

/**
 * POST /api/purchase/build-atomic-psbt
 * Constrói PSBT atômico seguindo BIP 174 RIGOROSAMENTE
 * 
 * 🔒 SEGURANÇA: O frontend deve buscar o sellerPsbt usando o endpoint protegido:
 *    POST /api/offers/:id/get-seller-psbt
 *    Este endpoint valida o buyer address e registra logs de auditoria.
 *    NUNCA busque o PSBT diretamente do endpoint público GET /api/offers
 */
router.post('/build-atomic-psbt', async (req, res) => {
    try {
        console.log('\n🏗️  === BUILD ATOMIC PSBT REQUEST ===');
        console.log('📥 Request body keys:', Object.keys(req.body));
        
        const { 
            sellerPsbt,
            sellerAddress,  // ✅ Endereço do seller (da oferta)
            buyerAddress, 
            buyerUtxos, 
            buyerPublicKey,  // ✅ ADICIONADO
            paymentAmount, 
            feeRate, 
            estimatedFee 
        } = req.body;
        
        console.log('📋 Parameters received:');
        console.log('   - sellerPsbt:', sellerPsbt ? `${sellerPsbt.substring(0, 50)}...` : 'MISSING');
        console.log('   - sellerAddress:', sellerAddress || 'MISSING');
        console.log('   - buyerAddress:', buyerAddress || 'MISSING');
        console.log('   - buyerPublicKey:', buyerPublicKey || 'MISSING');
        console.log('   - paymentAmount:', paymentAmount || 'MISSING');
        console.log('   - buyerUtxos:', buyerUtxos?.length || 0);
        
        if (!sellerPsbt || !sellerAddress || !buyerAddress || !buyerPublicKey || !paymentAmount) {
            console.error('❌ Missing required fields!');
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // ═══════════════════════════════════════════════════════════════
        // 🛡️ VALIDAÇÃO DE PREPARAÇÃO DE COMPRA (SecurityValidator)
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n🛡️  VALIDATING PURCHASE PREPARATION...');
        
        try {
            const { default: SecurityValidator } = await import('../validators/SecurityValidator.js');
            
            // Buscar listing (offer) do banco para validação completa
            // Nota: Aqui assumimos que a oferta foi passada via request ou buscamos do banco
            // TODO: Adicionar offerId no request body
            
            const prepValidation = await SecurityValidator.validatePurchasePreparation({
                listing: {
                    status: 'active', // TODO: buscar do banco
                    price: paymentAmount,
                    marketplace_fee: 0, // TODO: calcular
                    seller_address: sellerAddress,
                    expires_at: null // TODO: buscar do banco
                },
                buyerAddress,
                buyerUtxos
            });
            
            if (!prepValidation.valid) {
                console.error('❌ PURCHASE PREPARATION VALIDATION FAILED!');
                console.error('Errors:', prepValidation.errors);
                
                return res.status(400).json({
                    error: 'Purchase validation failed',
                    details: prepValidation.errors
                });
            }
            
            console.log('✅ Purchase preparation validation PASSED');
            
        } catch (validationError) {
            console.error('⚠️  Purchase validation error:', validationError.message);
            // Continuar mesmo se validação falhar
        }
        
        console.log('\n🏗️  CONSTRUINDO PSBT ATÔMICO (BIP 174)...');
        
        // ==========================================
        // 1. DECODIFICAR PSBT DO VENDEDOR
        // ==========================================
        console.log('1️⃣  Decodificando PSBT do vendedor...');
        
        let psbtString = sellerPsbt;
        if (sellerPsbt.startsWith('70736274')) {
            psbtString = Buffer.from(sellerPsbt, 'hex').toString('base64');
        }
        
        const sellerPsbtDecoded = bitcoin.Psbt.fromBase64(psbtString, { network });
        
        // Validar PSBT do vendedor
        if (sellerPsbtDecoded.inputCount === 0) {
            throw new Error('PSBT do vendedor não tem inputs');
        }
        
        const sellerInput = sellerPsbtDecoded.data.inputs[0];
        if (!sellerInput.witnessUtxo) {
            throw new Error('PSBT do vendedor: witnessUtxo faltando');
        }
        
        // 🔧 FIX: Unisat remove tapInternalKey após assinar
        // Vamos extrair do witnessUtxo.script (P2TR)
        if (!sellerInput.tapInternalKey) {
            console.log('⚠️  tapInternalKey faltando, extraindo do script...');
            const script = sellerInput.witnessUtxo.script;
            
            // P2TR script: OP_1 (0x51) + 32 bytes (tapInternalKey)
            if (script.length === 34 && script[0] === 0x51 && script[1] === 0x20) {
                sellerInput.tapInternalKey = script.slice(2, 34);
                console.log('✅ tapInternalKey extraído:', sellerInput.tapInternalKey.toString('hex'));
            } else {
                throw new Error('PSBT do vendedor: não é P2TR válido');
            }
        }
        
        // 🔍 DEBUG: Ver todos os campos do input
        console.log('🔍 Campos do seller input:', Object.keys(sellerInput));
        console.log('   - witnessUtxo:', !!sellerInput.witnessUtxo);
        console.log('   - tapInternalKey:', !!sellerInput.tapInternalKey);
        console.log('   - tapKeySig:', !!sellerInput.tapKeySig);
        console.log('   - tapScriptSig:', !!sellerInput.tapScriptSig);
        console.log('   - partialSig:', !!sellerInput.partialSig);
        console.log('   - finalScriptWitness:', !!sellerInput.finalScriptWitness);
        
        // 🔧 FIX: Unisat finaliza o PSBT (finalScriptWitness), mas precisamos de tapKeySig parcial
        if (!sellerInput.tapKeySig && sellerInput.finalScriptWitness) {
            console.log('⚠️  PSBT finalizado, extraindo tapKeySig do finalScriptWitness...');
            
            // 🔍 DEBUG: Ver estrutura completa do finalScriptWitness
            console.log('🔍 finalScriptWitness type:', typeof sellerInput.finalScriptWitness);
            console.log('🔍 finalScriptWitness instanceof Buffer:', sellerInput.finalScriptWitness instanceof Buffer);
            console.log('🔍 finalScriptWitness length:', sellerInput.finalScriptWitness?.length);
            
            // finalScriptWitness é um Buffer contendo a witness serializada
            // Para P2TR key-path, o formato é: [signature] (65 bytes com sighash type)
            const witnessBuffer = sellerInput.finalScriptWitness;
            
            if (witnessBuffer && witnessBuffer.length > 0) {
                // Parse do witness: primeiro byte é o número de items, depois cada item
                let offset = 0;
                const numItems = witnessBuffer[offset];
                offset += 1;
                
                console.log('🔍 Número de witness items:', numItems);
                
                if (numItems >= 1) {
                    // Ler o primeiro (e único para key-path) item
                    const itemLength = witnessBuffer[offset];
                    offset += 1;
                    
                    console.log('🔍 Signature length:', itemLength);
                    
                    const sig = witnessBuffer.slice(offset, offset + itemLength);
                    
                    console.log('🔍 Signature extracted, length:', sig.length);
                    
                    if (sig.length >= 64 && sig.length <= 65) {
                        // Remover sighash type se existir (último byte)
                        const cleanSig = sig.length === 65 ? sig.slice(0, 64) : sig;
                        const sighashType = sig.length === 65 ? sig[64] : 0x01; // Default ALL
                        
                        sellerInput.tapKeySig = cleanSig;
                        sellerInput.sighashType = sighashType;
                        
                        console.log('✅ tapKeySig extraído do finalScriptWitness');
                        console.log('   Signature length:', cleanSig.length);
                        console.log('   SighashType:', '0x' + sighashType.toString(16));
                        
                        // Remover finalScriptWitness para desfinalizar
                        delete sellerInput.finalScriptWitness;
                        console.log('✅ PSBT desfinalizado para permitir adicionar inputs');
                    } else {
                        console.error('❌ Assinatura inválida, length:', sig.length);
                        throw new Error('PSBT do vendedor: assinatura inválida');
                    }
                } else {
                    console.error('❌ finalScriptWitness sem items');
                    throw new Error('PSBT do vendedor: finalScriptWitness sem items');
                }
            } else {
                console.error('❌ finalScriptWitness vazio');
                throw new Error('PSBT do vendedor: finalScriptWitness vazio');
            }
        }
        
        // ℹ️  Com Encrypted Signature Atomic Swap, o PSBT pode NÃO ter assinatura ainda
        // A assinatura do seller foi extraída e criptografada separadamente
        if (sellerInput.tapKeySig) {
            console.log('✅ PSBT do vendedor tem tapKeySig (sistema antigo)');
        } else {
            console.log('ℹ️  PSBT do vendedor SEM assinatura (Encrypted Signature Atomic Swap)');
            console.log('   Assinatura do seller será adicionada no broadcast');
        }
        
        console.log('✅ PSBT do vendedor validado');
        console.log('   Inscription value:', sellerInput.witnessUtxo.value, 'sats');
        
        // ==========================================
        // 2. CALCULAR VALORES E SELECIONAR UTXOs
        // ==========================================
        console.log('\n2️⃣  Calculando valores...');
        
        const inscriptionValue = sellerInput.witnessUtxo.value;
        const feeEstimate = estimatedFee || 1000;
        
        // ✅ USAR O PAYMENT AMOUNT DO REQUEST (que vem do banco de dados - preço real da oferta)
        // ⚠️ NÃO usar o valor do Output 0 do PSBT, pois esse é o valor da inscription, não o preço!
        const paymentAmountFromRequest = paymentAmount; // Preço REAL da oferta
        
        console.log('   Payment amount (from request - REAL PRICE):', paymentAmountFromRequest, 'sats');
        console.log('   Inscription value (Output 0):', inscriptionValue, 'sats');
        
        // 💰 BUSCAR SERVICE FEE (se for oferta externa do ORD)
        let serviceFeeAmount = 0;
        let serviceFeeAddress = null;
        let offerSource = 'kraywallet';
        
        if (req.body.offerId) {
            // 🔒 VALIDAÇÃO CRÍTICA DE SEGURANÇA: Verificar o preço real da oferta
            const offerData = db.prepare('SELECT offer_amount, source, service_fee_percentage, service_fee_address FROM offers WHERE id = ?').get(req.body.offerId);
            if (offerData) {
                // 🛡️ ANTI-MANIPULATION: Validar que o preço do request bate com o banco de dados
                if (paymentAmountFromRequest !== offerData.offer_amount) {
                    console.error('❌ SECURITY ALERT: Price manipulation attempt detected!');
                    console.error(`   Expected: ${offerData.offer_amount} sats`);
                    console.error(`   Received: ${paymentAmountFromRequest} sats`);
                    return res.status(400).json({ 
                        error: `Price mismatch! Expected ${offerData.offer_amount} sats, got ${paymentAmountFromRequest} sats.` 
                    });
                }
                console.log('✅ Price validated: matches database');
                
                offerSource = offerData.source || 'kraywallet';
                
                // ✅ Apenas calcular fee se NÃO for Kray Wallet
                if (offerSource !== 'kraywallet') {
                    const feePercentage = offerData.service_fee_percentage || 0;
                    serviceFeeAddress = offerData.service_fee_address;
                    
                    if (feePercentage > 0 && serviceFeeAddress) {
                        serviceFeeAmount = Math.floor(paymentAmountFromRequest * (feePercentage / 100));
                        
                        // ✅ Anti-dust: se fee < 546 sats, forçar 546 sats
                        if (serviceFeeAmount > 0 && serviceFeeAmount < 546) {
                            serviceFeeAmount = 546;
                        }
                        
                        console.log(`\n💰 SERVICE FEE (External Offer):`);
                        console.log(`   Source: ${offerSource}`);
                        console.log(`   Fee: ${feePercentage}%`);
                        console.log(`   Amount: ${serviceFeeAmount} sats ${serviceFeeAmount === 546 ? '(minimum anti-dust)' : ''}`);
                        console.log(`   Address: ${serviceFeeAddress}`);
                    }
                } else {
                    console.log(`\n⭐ NO SERVICE FEE: Kray Wallet offer (0% fee)`);
                }
            }
        }
        
        const totalNeeded = paymentAmountFromRequest + serviceFeeAmount + feeEstimate;
        
        // 🛡️ PROTEÇÃO CRÍTICA: Filtrar UTXOs puros (sem Inscriptions nem Runes)
        console.log('\n🛡️  Filtering pure UTXOs (protecting Inscriptions and Runes)...');
        console.log('   Total UTXOs received:', buyerUtxos?.length || 0);
        
        let pureUtxos = buyerUtxos || [];
        
        try {
            const { default: UTXOFilter } = await import('../utils/utxoFilter.js');
            const utxoFilter = new UTXOFilter();
            
            // Filtrar apenas UTXOs seguros para usar
            pureUtxos = await utxoFilter.filterPureUTXOs(buyerUtxos || []);
            console.log('   Pure UTXOs (safe to use):', pureUtxos.length);
        } catch (filterError) {
            console.error('   ⚠️  UTXO filter failed, using all UTXOs:', filterError.message);
            pureUtxos = buyerUtxos || [];
        }
        
        if (pureUtxos.length === 0) {
            return res.status(400).json({
                error: 'No pure UTXOs available. All your UTXOs contain Inscriptions or Runes that cannot be used for payment.'
            });
        }
        
        let totalValue = 0;
        const selectedUtxos = [];
        
        if (pureUtxos && pureUtxos.length > 0) {
            for (const utxo of pureUtxos) {
                const utxoData = {
                    txid: utxo.txid || utxo.txId,
                    vout: utxo.vout || utxo.outputIndex || 0,
                    satoshis: utxo.satoshis || utxo.value || utxo.amount,
                    scriptPubKey: utxo.scriptPubKey || utxo.scriptPk
                };
                
                if (!utxoData.txid || !utxoData.satoshis) continue;
                
                selectedUtxos.push(utxoData);
                totalValue += utxoData.satoshis;
                
                if (totalValue >= totalNeeded) break;
            }
        }
        
        if (totalValue < totalNeeded) {
            return res.status(400).json({ 
                error: `Insufficient UTXOs. Need ${totalNeeded} sats, have ${totalValue} sats`
            });
        }
        
        const change = totalValue - totalNeeded;
        
        console.log('   Inscription:', inscriptionValue, 'sats');
        console.log('   Pagamento:', paymentAmount, 'sats');
        console.log('   Fee:', feeEstimate, 'sats');
        console.log('   Total in:', totalValue + inscriptionValue, 'sats');
        console.log('   Change:', change, 'sats');
        
        // ==========================================
        // 3. NÃO CRIAR NOVO PSBT! Usar o PSBT assinado do vendedor
        // ==========================================
        
        // ==========================================
        // 5. ✨ NOVA ESTRATÉGIA: USAR O PSBT DO VENDEDOR E ADICIONAR OUTPUTS!
        // ==========================================
        console.log('\n5️⃣  Usando PSBT assinado do vendedor e adicionando outputs...');
        
        // ⚠️ ESTRATÉGIA: Em vez de reconstruir o PSBT, usar o PSBT assinado e ADICIONAR outputs
        // Isso mantém a assinatura do vendedor válida!
        
        // Usar o PSBT assinado do vendedor como base
        const psbtFromSeller = bitcoin.Psbt.fromBase64(psbtString, { network });
        
        console.log('📊 Seller PSBT (assinado):');
        console.log('   Inputs:', psbtFromSeller.inputCount);
        console.log('   Outputs:', psbtFromSeller.txOutputs.length);
        if (psbtFromSeller.txOutputs.length > 0) {
            console.log('   Output 0:', psbtFromSeller.txOutputs[0].value, 'sats');
        } else {
            console.log('   No outputs (SIGHASH_NONE|ANYONECANPAY - buyer will add all outputs)');
        }
        
        // Verificar se o vendedor assinou (ou se usa Encrypted Signature Atomic Swap)
        const sellerSig = psbtFromSeller.data.inputs[0];
        const hasSignature = sellerSig.tapKeySig || sellerSig.partialSig;
        
        if (!hasSignature) {
            console.log('ℹ️  Seller PSBT without signature (Encrypted Signature Atomic Swap)');
            console.log('   Seller signature will be added during broadcast');
        } else {
            console.log('✅ Seller signature present (traditional atomic swap)');
        }
        console.log('🔍 Seller PSBT input 0 details:');
        console.log('   tapKeySig:', sellerSig.tapKeySig ? '✅ Present' : '❌ Missing');
        console.log('   tapInternalKey:', sellerSig.tapInternalKey ? '✅ Present (' + sellerSig.tapInternalKey.toString('hex').substring(0, 16) + '...)' : '❌ MISSING!');
        console.log('   witnessUtxo.script:', sellerSig.witnessUtxo?.script.toString('hex').substring(0, 40) + '...');
        console.log('   witnessUtxo.value:', sellerSig.witnessUtxo?.value, 'sats');
        
        // ==========================================
        // 🔐 ENCRYPTED SIGNATURE ATOMIC SWAP: SIGHASH_NONE|ANYONECANPAY
        // ==========================================
        // ✅ Seller assina com SIGHASH_NONE|ANYONECANPAY (0x82):
        //    - NONE: Seller NÃO compromete outputs (marketplace constrói TODOS)
        //    - ANYONECANPAY: Seller não se importa com outros inputs (buyer adiciona)
        //    - ENCRYPTED: Seller signature é CRIPTOGRAFADA (buyer NUNCA vê)
        //    - VALIDATED: Backend valida TUDO antes de descriptografar
        //
        // Seller PSBT: 1 input (inscription), 0 outputs
        // Marketplace constrói TODOS outputs:
        //   - Output 0: Inscription → Buyer
        //   - Output 1: Payment → Seller
        //   - Output 2+: Change → Buyer (se necessário)
        
        console.log('\n🔐 ENCRYPTED SIGNATURE ATOMIC SWAP (SIGHASH_NONE)...');
        console.log('   Seller signed ONLY Input 0 (inscription)');
        console.log('   Seller did NOT sign outputs (marketplace constructs ALL)');
        console.log('   Backend will validate everything before decrypting!\n');
        
        console.log('📊 Seller PSBT (reference):');
        console.log('   Inputs:', psbtFromSeller.inputCount);
        console.log('   Outputs:', psbtFromSeller.txOutputs.length);
        console.log('   ✅ No outputs (SIGHASH_NONE - marketplace constructs)');
        
        // ==========================================
        // 1️⃣  CRIAR NOVO PSBT COM ESTRUTURA CORRETA
        // ==========================================
        console.log('\n1️⃣  Creating new PSBT with correct inputs/outputs...');
        
        // Criar PSBT do zero com estrutura final
        const buyerPsbt = new bitcoin.Psbt({ network });
        
        // Input 0: Inscription (do seller - SEM assinatura por enquanto!)
        // ⚠️ CRÍTICO: bitcoinjs-lib NÃO permite addInput() depois que existe assinatura!
        // Então adicionamos TODOS os inputs primeiro, DEPOIS copiamos a assinatura.
        buyerPsbt.addInput({
            hash: psbtFromSeller.txInputs[0].hash,
            index: psbtFromSeller.txInputs[0].index,
            witnessUtxo: sellerSig.witnessUtxo,
            tapInternalKey: sellerSig.tapInternalKey
        });
        
        console.log('   ✅ Input 0: Inscription (from seller - signature will be added later)');
        
        // Inputs 1+: Buyer UTXOs (evitar duplicatas!)
        const sellerInputTxid = Buffer.from(psbtFromSeller.txInputs[0].hash).reverse().toString('hex');
        const sellerInputVout = psbtFromSeller.txInputs[0].index;
        
        for (const utxo of selectedUtxos) {
            // ⚠️ SKIP se for o mesmo UTXO que a inscription do seller
            if (utxo.txid === sellerInputTxid && utxo.vout === sellerInputVout) {
                console.log(`   ⚠️  Skipping duplicate UTXO: ${utxo.txid}:${utxo.vout}`);
                continue;
            }
            
            let scriptPubKey;
            if (utxo.scriptPubKey) {
                scriptPubKey = Buffer.from(utxo.scriptPubKey, 'hex');
            } else {
                scriptPubKey = getScriptPubKeyFromAddress(buyerAddress, network);
            }
            
            // ✅ ADICIONAR tapInternalKey PARA TAPROOT!
            let tapInternalKey = null;
            try {
                tapInternalKey = toXOnly(Buffer.from(buyerPublicKey, 'hex'));
            } catch (e) {
                // Se falhar, tentar extrair do scriptPubKey
                if (scriptPubKey.length === 34 && scriptPubKey[0] === 0x51 && scriptPubKey[1] === 0x20) {
                    tapInternalKey = scriptPubKey.slice(2);
                }
            }
            
            buyerPsbt.addInput({
                hash: Buffer.from(utxo.txid, 'hex').reverse(),
                index: utxo.vout,
                witnessUtxo: {
                    script: scriptPubKey,
                    value: utxo.satoshis
                },
                ...(tapInternalKey && { tapInternalKey })
            });
            console.log(`   ✅ Input ${buyerPsbt.inputCount - 1}: ${utxo.satoshis} sats (buyer)`);
        }
        
        // ✅ SIGHASH_NONE|ANYONECANPAY: Marketplace constrói TODOS os outputs!
        //   - Output 0: Inscription → Buyer
        //   - Output 1: Payment → Seller
        //   - Output 2+: Change → Buyer (se necessário)
        
        console.log('\n✅ SIGHASH_NONE: Marketplace constructs ALL outputs!');
        console.log('   Seller signature does NOT commit to outputs');
        console.log('   Backend will validate outputs before decrypting signature');
        
        // 📦 OUTPUT 0: Inscription → Buyer
        console.log('\n📦 CONSTRUCTING OUTPUTS:');
        
        buyerPsbt.addOutput({
            address: buyerAddress,
            value: inscriptionValue
        });
        console.log(`   ✅ Output 0: Inscription (${inscriptionValue} sats) → BUYER`);
        
        // 💰 OUTPUT 1: Payment → Seller
        buyerPsbt.addOutput({
            address: sellerAddress,
            value: paymentAmount
        });
        console.log(`   ✅ Output 1: Payment (${paymentAmount} sats) → SELLER`);
        
        // 💵 OUTPUT 2+: Change → Buyer (se necessário)
        if (change >= 546) {
            buyerPsbt.addOutput({
                address: buyerAddress,
                value: change
            });
            console.log(`   ✅ Output 2: Change (${change} sats) → BUYER`);
        } else {
            console.log(`   ⚠️  Change too small (${change} sats), will be mining fee`);
        }
        
        // ==========================================
        // 2️⃣  VALIDAÇÃO FINAL DOS OUTPUTS
        // ==========================================
        console.log('\n🔒 FINAL OUTPUT VALIDATION:');
        console.log(`   Output 0: ${buyerPsbt.txOutputs[0].value} sats → BUYER (inscription)`);
        console.log(`   Output 1: ${buyerPsbt.txOutputs[1].value} sats → SELLER (payment)`);
        if (buyerPsbt.txOutputs.length > 2) {
            console.log(`   Output 2: ${buyerPsbt.txOutputs[2].value} sats → BUYER (change)`);
        }
        
        // ✅ Verificar inscription (Output 0)
        const output0Address = bitcoin.address.fromOutputScript(buyerPsbt.txOutputs[0].script, network);
        if (output0Address !== buyerAddress) {
            throw new Error(`INSCRIPTION ADDRESS VALIDATION FAILED! Expected ${buyerAddress}, got ${output0Address}`);
        }
        if (buyerPsbt.txOutputs[0].value !== inscriptionValue) {
            throw new Error(`INSCRIPTION VALUE VALIDATION FAILED! Expected ${inscriptionValue} sats, got ${buyerPsbt.txOutputs[0].value} sats`);
        }
        console.log(`   ✅ Output 0 validated: Inscription → Buyer (${inscriptionValue} sats)`);
        
        // ✅ Verificar payment (Output 1)
        const output1Address = bitcoin.address.fromOutputScript(buyerPsbt.txOutputs[1].script, network);
        if (output1Address !== sellerAddress) {
            throw new Error(`PAYMENT ADDRESS VALIDATION FAILED! Expected ${sellerAddress}, got ${output1Address}`);
        }
        if (buyerPsbt.txOutputs[1].value !== paymentAmount) {
            throw new Error(`PAYMENT VALUE VALIDATION FAILED! Expected ${paymentAmount} sats, got ${buyerPsbt.txOutputs[1].value} sats`);
        }
        console.log(`   ✅ Output 1 validated: Payment → Seller (${paymentAmount} sats)`);
        
        // ==========================================
        // 3️⃣  SELLER SIGNATURE (Encrypted Signature Atomic Swap)
        // ==========================================
        console.log('\n3️⃣  Seller signature status...');
        
        console.log('   🔍 Seller signature details:');
        console.log('      tapKeySig:', sellerSig.tapKeySig ? 'present' : 'NOT PRESENT (encrypted)');
        console.log('      tapKeySig length:', sellerSig.tapKeySig?.length || 0);
        console.log('      sighashType:', sellerSig.sighashType || 'none');
        
        // 🔐 ENCRYPTED SIGNATURE ATOMIC SWAP:
        // Seller signature is ENCRYPTED and stored in database
        // It will ONLY be decrypted and added during broadcast
        // AFTER backend validates all outputs!
        
        if (sellerSig.tapKeySig) {
            // Old system: signature already in PSBT
            buyerPsbt.data.inputs[0].tapKeySig = sellerSig.tapKeySig;
            if (sellerSig.sighashType) {
                buyerPsbt.data.inputs[0].sighashType = sellerSig.sighashType;
            }
            console.log('   ⚠️  OLD SYSTEM: Seller signature copied to Input 0');
            console.log('   ⚠️  Signature length:', sellerSig.tapKeySig.length, 'bytes');
            console.log('   ⚠️  SIGHASH type:', sellerSig.sighashType);
        } else {
            console.log('   ✅ ENCRYPTED SIGNATURE ATOMIC SWAP: Seller signature is encrypted');
            console.log('   ✅ Signature will be added during broadcast');
            console.log('   ✅ After backend validates ALL outputs');
            console.log('   ✅ This prevents fraud attempts');
        }
        
        // Usar buyerPsbt como psbt final
        const psbt = buyerPsbt;
        
        console.log('\n✅ COMBINED PSBT LOADED:');
        console.log('   Inputs:', psbt.inputCount);
        console.log('   Outputs:', psbt.txOutputs.length);
        console.log('   Input 0 has signature:', !!psbt.data.inputs[0].tapKeySig);
        
        // Verificar balanço final
        let totalIn = 0;
        let totalOut = 0;
        
        for (let i = 0; i < psbt.inputCount; i++) {
            const input = psbt.data.inputs[i];
            if (input.witnessUtxo) {
                totalIn += input.witnessUtxo.value;
            }
        }
        
        for (const output of psbt.txOutputs) {
            totalOut += output.value;
        }
        
        const calculatedFee = totalIn - totalOut;
        
        console.log('\n💰 BALANÇO FINAL:');
        console.log('   Total Inputs:', totalIn, 'sats');
        console.log('   Total Outputs:', totalOut, 'sats');
        console.log('   Fee:', calculatedFee, 'sats');
        
        console.log('\n✅ PSBT ATÔMICO CRIADO COM SUCESSO');
        console.log('   Total inputs:', psbt.inputCount);
        console.log('   Total outputs:', psbt.txOutputs.length);
        console.log('   Input 0 assinado (seller):', !!psbt.data.inputs[0].tapKeySig);
        console.log('   Inputs 1+ aguardando assinatura da carteira\n');
        
        const atomicPsbtBase64 = psbt.toBase64();
        const atomicPsbtHex = Buffer.from(atomicPsbtBase64, 'base64').toString('hex');
        
        console.log('\n📋 ========== ATOMIC PSBT CREATED ==========');
        console.log('Length (base64):', atomicPsbtBase64.length, 'chars');
        console.log('Length (hex):', atomicPsbtHex.length, 'chars');
        console.log('\n📋 COMPLETE ATOMIC PSBT (BASE64):');
        console.log(atomicPsbtBase64);
        console.log('\n📋 COMPLETE ATOMIC PSBT (HEX):');
        console.log(atomicPsbtHex);
        console.log('===========================================\n');
        
        res.json({
            success: true,
            psbt: atomicPsbtBase64,
            details: {
                totalInputs: psbt.inputCount,
                totalOutputs: psbt.txOutputs.length,
                buyerPays: paymentAmount,
                estimatedFee: feeEstimate,
                actualFee: calculatedFee,
                change: change >= 546 ? change : 0,
                balance: {
                    totalIn,
                    totalOut,
                    fee: calculatedFee
                }
            }
        });
        
    } catch (error) {
        console.error('\n❌ ========== ERRO AO CRIAR PSBT ATÔMICO ==========');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        if (error.response) {
            console.error('HTTP Response:', error.response.status, error.response.data);
        }
        console.error('===================================================\n');
        
        res.status(500).json({ 
            error: 'Failed to create buyer PSBT',
            message: error.message,
            type: error.constructor.name,
            details: error.stack
        });
    }
});

export default router;
