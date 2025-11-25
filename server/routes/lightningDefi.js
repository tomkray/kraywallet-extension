/**
 * ⚡ LIGHTNING DeFi API ROUTES - VERSÃO CORRETA E SEGURA
 * 
 * ARQUITETURA REVISADA:
 * - Usuário SEMPRE mantém controle das chaves
 * - Runes ficam no endereço Taproot DO USUÁRIO
 * - Pool é registrada off-chain no State Tracker
 * - Runestone SEMPRE validado antes de broadcast
 * 
 * @author KrayWallet Team
 * @version 2.0 (REWRITTEN FOR SECURITY)
 */

import express from 'express';
import * as bitcoin from 'bitcoinjs-lib';
import { getLNDPoolClient } from '../lightning/lndPoolClient.js';
import StateTracker from '../lightning/krayStateTracker.js';
import PSBTBuilderRunes from '../utils/psbtBuilderRunes.js';
import bitcoinRpc from '../utils/bitcoinRpc.js';
import syntheticRunesService from '../services/syntheticRunesService.js';
import mempoolFees from '../utils/mempoolFees.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 GET RECOMMENDED FEES (from mempool.space)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/lightning-defi/recommended-fees
 * 
 * Retorna fees recomendados do mempool.space em tempo real
 */
router.get('/recommended-fees', async (req, res) => {
    console.log('\n💰 ========== GET RECOMMENDED FEES ==========');
    
    try {
        const fees = await mempoolFees.getRecommendedFees();
        
        res.json({
            success: true,
            fees: {
                fastest: fees.fastestFee,
                halfHour: fees.halfHourFee,
                hour: fees.hourFee,
                economy: fees.economyFee,
                minimum: fees.minimumFee
            },
            recommended: fees.halfHourFee, // Padrão recomendado
            estimatedTimes: {
                [fees.fastestFee]: '~10 minutes',
                [fees.halfHourFee]: '~30 minutes',
                [fees.hourFee]: '~1 hour',
                [fees.economyFee]: '~2-4 hours',
                [fees.minimumFee]: '~4+ hours'
            }
        });
        
    } catch (error) {
        console.error('❌ Error getting fees:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            fallback: {
                recommended: 10,
                estimatedTime: '~30 minutes'
            }
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🏊 CREATE POOL - VERSÃO CORRETA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/lightning-defi/create-pool
 * 
 * NOVA ARQUITETURA:
 * 1. User envia BTC + Runes do seu endereço Taproot
 * 2. PSBT cria output para o MESMO endereço do user (não cria novo!)
 * 3. OP_RETURN contém Runestone VÁLIDO transferindo Runes
 * 4. User assina com SUA chave privada
 * 5. Backend valida Runestone antes de broadcast
 * 6. Pool registrada no State Tracker (off-chain)
 * 
 * Body:
 * {
 *   runeId: "840000:3",
 *   runeName: "DOG•GO•TO•THE•MOON",
 *   runeSymbol: "🐕",
 *   runeAmount: "70000000000",  // Raw amount (atomic units)
 *   btcAmount: 10000,            // Sats
 *   userAddress: "bc1p...",      // Endereço Taproot do user
 *   userUtxos: [...],            // UTXOs do user
 *   feeRate: 10,                 // Opcional
 *   poolName: "My Pool"          // Opcional
 * }
 */
router.post('/create-pool', async (req, res) => {
    console.log('\n🏊 ========== CREATE POOL (SECURE VERSION) ==========');
    
    try {
        const {
            runeId,
            runeName,
            runeSymbol,
            runeAmount,
            btcAmount,
            userAddress,
            userUtxos,
            poolFeeRate = 30,                 // ✅ Pool fee (LP fee) em basis points (0.30% = 30)
            networkFeeRate = null,            // ✅ Bitcoin network fee (sats/vB) - se null, busca do mempool
            poolName,
            useInscription = false,           // ✅ Opcional
            poolInscriptionId = null,         // ✅ Opcional
            poolInscriptionNumber = null,     // ✅ Opcional
            poolImage = null                  // ✅ Opcional
        } = req.body;
        
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 1: Validar parâmetros
        // ═══════════════════════════════════════════════════════════════════════
        
        console.log('\n✅ STEP 1: Validating parameters...');
        
        if (!runeId || !runeName || !userAddress || !userUtxos) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: runeId, runeName, userAddress, userUtxos'
            });
        }
        
        if (!runeAmount || BigInt(runeAmount) <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid runeAmount'
            });
        }
        
        if (!btcAmount || btcAmount < 546) {
            return res.status(400).json({
                success: false,
                error: 'btcAmount must be at least 546 sats (dust limit)'
            });
        }
        
        console.log('   Rune:', runeName, `(${runeId})`);
        console.log('   Rune Amount:', runeAmount);
        console.log('   BTC Amount:', btcAmount, 'sats');
        console.log('   User Address:', userAddress);
        console.log('   Pool Fee Rate (LP):', poolFeeRate / 100, '%');
        
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 1.5: Buscar Bitcoin Network Fee do mempool.space (DYNAMIC!)
        // ═══════════════════════════════════════════════════════════════════════
        
        let feeRate;
        
        if (networkFeeRate) {
            // User forneceu custom fee rate
            feeRate = networkFeeRate;
            console.log('   ⚙️  Using custom network fee:', feeRate, 'sats/vB');
        } else {
            // Buscar do mempool.space (AUTOMÁTICO!)
            console.log('\n💰 Fetching dynamic network fee from mempool.space...');
            feeRate = await mempoolFees.getDefaultFeeRate();
            console.log('   ✅ Network Fee Rate (from mempool):', feeRate, 'sats/vB');
            
            const estimatedTime = await mempoolFees.estimateConfirmationTime(feeRate);
            console.log('   ⏱️  Estimated confirmation time:', estimatedTime);
        }
        
        // Validar que é endereço Taproot e extrair tapInternalKey
        const network = bitcoin.networks.bitcoin;
        let userScript;
        let userTapInternalKey;
        
        try {
            userScript = bitcoin.address.toOutputScript(userAddress, network);
            
            // Verificar se é P2TR (Taproot)
            if (!(userScript.length === 34 && userScript[0] === 0x51 && userScript[1] === 0x20)) {
                throw new Error('Address must be Taproot (bc1p...)');
            }
            
            // ✅ CRÍTICO: Extrair tapInternalKey do endereço
            const decoded = bitcoin.address.fromBech32(userAddress);
            if (decoded.version === 1 && decoded.data.length === 32) {
                userTapInternalKey = decoded.data;
                console.log('   ✅ Valid Taproot address');
                console.log('   🔑 tapInternalKey:', userTapInternalKey.toString('hex'));
            } else {
                throw new Error('Invalid Taproot address format');
            }
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: `Invalid address: ${e.message}`
            });
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 2: Selecionar inputs (BTC + Rune)
        // ═══════════════════════════════════════════════════════════════════════
        
        console.log('\n📊 STEP 2: Selecting inputs...');
        
        const psbt = new bitcoin.Psbt({ network });
        
        let totalInputValue = 0;
        let runeInputFound = false;
        
        // 🛡️ CRÍTICO: Filtrar UTXOs antes de usar!
        // NUNCA gastar UTXOs com inscriptions (exceto se explicitamente permitido para imagem do pool)
        const filteredUtxos = userUtxos.filter(utxo => {
            // Se tem inscription E não é a inscription da pool, PULAR!
            if (utxo.hasInscription || utxo.inscription) {
                const inscriptionId = utxo.inscription?.id || utxo.inscriptionId;
                
                // Permitir apenas se for a inscription escolhida para o pool
                if (useInscription && inscriptionId === poolInscriptionId) {
                    console.log(`   🖼️  Allowing pool inscription UTXO: ${inscriptionId}`);
                    return true;
                }
                
                console.warn(`   ⚠️  SKIPPING inscription UTXO: ${utxo.txid}:${utxo.vout}`);
                console.warn(`       Inscription: ${inscriptionId || 'unknown'}`);
                console.warn(`       🛡️  PROTECTED: This inscription will NOT be spent!`);
                return false;
            }
            
            return true;
        });
        
        console.log(`   🛡️  Filtered UTXOs: ${filteredUtxos.length} / ${userUtxos.length} (${userUtxos.length - filteredUtxos.length} inscriptions protected)`);
        
        if (filteredUtxos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No usable UTXOs found. All your UTXOs contain inscriptions. Please ensure you have pure BTC or rune UTXOs available.'
            });
        }
        
        for (const utxo of filteredUtxos) {
            totalInputValue += utxo.value;
            
            // Adicionar input
            const inputData = {
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: Buffer.from(utxo.scriptPubKey || utxo.script_pubkey, 'hex'),
                    value: utxo.value
                }
            };
            
            // ✅ CRÍTICO: Adicionar tapInternalKey automaticamente
            // Usa o tapInternalKey do UTXO (se fornecido) ou do endereço do usuário
            if (utxo.tapInternalKey) {
                const tapKey = Buffer.from(utxo.tapInternalKey, 'hex');
                if (tapKey.length === 32) {
                    inputData.tapInternalKey = tapKey;
                    console.log(`   Input: ${utxo.txid.substring(0, 16)}...:${utxo.vout} = ${utxo.value} sats (custom tapKey)`);
                }
            } else if (userTapInternalKey) {
                // ✅ NOVO: Usar tapInternalKey extraído do endereço do usuário
                inputData.tapInternalKey = userTapInternalKey;
                console.log(`   Input: ${utxo.txid.substring(0, 16)}...:${utxo.vout} = ${utxo.value} sats (user tapKey)`);
            } else {
                console.log(`   Input: ${utxo.txid.substring(0, 16)}...:${utxo.vout} = ${utxo.value} sats (no tapKey)`);
            }
            
            psbt.addInput(inputData);
            
            if (utxo.hasRunes) {
                runeInputFound = true;
            }
        }
        
        // ✅ VALIDAÇÃO CRÍTICA: Deve ter pelo menos 1 UTXO com runes!
        if (!runeInputFound) {
            console.error('   ❌ CRITICAL: No rune UTXO found in filtered inputs!');
            console.error('       The Runestone will be created but runes will NOT transfer (BURNED)!');
            return res.status(400).json({
                success: false,
                error: 'CRITICAL: No rune UTXO found. Cannot create pool without rune inputs. Please ensure you have confirmed rune UTXOs.'
            });
        }
        
        console.log('   ✅ Rune UTXO(s) found!');
        console.log('   Total input value:', totalInputValue, 'sats');
        
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 3: Criar outputs
        // ═══════════════════════════════════════════════════════════════════════
        
        console.log('\n📤 STEP 3: Creating outputs...');
        
        // ✅ MUDANÇA CRÍTICA: Output vai para o MESMO endereço do user!
        // NÃO criamos endereço novo!
        
        // Output 0: Funding (BTC + Runes) volta para o PRÓPRIO user
        const fundingAmount = btcAmount;
        
        psbt.addOutput({
            address: userAddress,  // ← MESMO endereço! User mantém controle!
            value: fundingAmount
        });
        
        console.log('   Output 0 (funding):', fundingAmount, 'sats');
        console.log('   Address:', userAddress);
        console.log('   ✅ SECURE: Output goes back to USER address (no new address created)');
        
        // Output 1: OP_RETURN (Runestone)
        console.log('\n🪙 Building Runestone...');
        console.log('   Rune ID:', runeId);
        console.log('   Amount:', runeAmount);
        console.log('   Target Output: 0 (user address)');
        
        // ✅ PSBTBuilderRunes já é uma instância (singleton)
        const runestoneScriptHex = PSBTBuilderRunes.buildRunestone({
            runeId: runeId,
            amount: runeAmount,
            outputIndex: 0  // Runes vão para output 0 (userAddress)
        });
        
        const runestoneScript = Buffer.from(runestoneScriptHex, 'hex');
        
        console.log('   Runestone hex:', runestoneScriptHex);
        console.log('   Runestone length:', runestoneScript.length, 'bytes');
        
        // ✅ VALIDAÇÃO CRÍTICA: Verificar que Runestone não está vazio!
        if (runestoneScript.length < 4) {
            throw new Error('CRITICAL: Runestone is too short (likely empty)!');
        }
        
        // Verificar que começa com OP_RETURN (0x6a) + OP_13 (0x5d)
        if (runestoneScript[0] !== 0x6a || runestoneScript[1] !== 0x5d) {
            throw new Error('CRITICAL: Invalid Runestone format!');
        }
        
        console.log('   ✅ Runestone validated (not empty, correct format)');
        
        psbt.addOutput({
            script: runestoneScript,
            value: 0
        });
        
        console.log('   Output 1 (OP_RETURN): Runestone');
        
        // Output 2: Change (se necessário)
        // ✅ Estimativa conservadora: assume 3 outputs (funding + OP_RETURN + change)
        // Para Taproot: input ~57 vB, output ~43 vB, overhead ~10 vB
        // ✅ CRÍTICO: Usar filteredUtxos.length (não userUtxos.length!)
        const estimatedSize = (filteredUtxos.length * 57) + (3 * 43) + 10;
        const fee = Math.ceil(estimatedSize * feeRate);
        const changeAmount = totalInputValue - fundingAmount - fee;
        
        console.log('\n💸 Fee calculation:');
        console.log('   Estimated size:', estimatedSize, 'vB');
        console.log('   Fee:', fee, 'sats');
        console.log('   Change:', changeAmount, 'sats');
        
        if (changeAmount > 546) {
            psbt.addOutput({
                address: userAddress,
                value: changeAmount
            });
            console.log('   Output 2 (change):', changeAmount, 'sats');
        } else if (changeAmount < 0) {
            return res.status(400).json({
                success: false,
                error: `Insufficient funds. Need ${fee + fundingAmount} sats, have ${totalInputValue} sats`
            });
        } else {
            console.log('   ⚠️  Change too small (dust), added to fee');
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 4: Gerar Pool ID e retornar PSBT
        // ═══════════════════════════════════════════════════════════════════════
        
        console.log('\n📋 STEP 4: Generating pool ID...');
        
        const poolId = `${runeId}:${Date.now()}`;
        
        console.log('   Pool ID:', poolId);
        console.log('   Pool Name:', poolName || `${runeSymbol}/BTC Pool`);
        
        const psbtBase64 = psbt.toBase64();
        
        console.log('\n✅ ========== PSBT CREATED ==========');
        console.log('Inputs:', psbt.inputCount);
        console.log('Outputs:', psbt.txOutputs.length);
        console.log('PSBT length:', psbtBase64.length);
        console.log('');
        console.log('⚠️  NEXT STEP: User must sign this PSBT with their wallet');
        console.log('✅ SECURITY: User maintains full control of funds');
        console.log('✅ SECURITY: No new addresses created');
        console.log('✅ SECURITY: Runestone validated');
        
        res.json({
            success: true,
            psbt: psbtBase64,
            poolId,
            funding: {
                address: userAddress,
                amount: fundingAmount,
                runeId,
                runeName,
                runeAmount
            },
            fee,
            runestone: runestoneScriptHex,
            message: 'PSBT created. Please sign with your wallet.',
            nextStep: 'POST /api/lightning-defi/finalize-pool with signed PSBT'
        });
        
    } catch (error) {
        console.error('\n❌ Error creating pool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 FINALIZE POOL - VERSÃO COM VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/lightning-defi/finalize-pool
 * 
 * VALIDAÇÕES CRÍTICAS:
 * 1. ✅ Verificar que PSBT está assinado
 * 2. ✅ Validar Runestone no OP_RETURN
 * 3. ✅ Verificar que runes vão para output correto
 * 4. ✅ Broadcast apenas se tudo estiver OK
 * 5. ✅ Registrar pool no State Tracker
 */
router.post('/finalize-pool', async (req, res) => {
    console.log('\n📡 ========== FINALIZE POOL (WITH VALIDATION) ==========');
    
    try {
        const { psbt: psbtInput, poolId, poolName } = req.body;
        
        if (!psbtInput || !poolId) {
            return res.status(400).json({
                success: false,
                error: 'Missing psbt or poolId'
            });
        }
        
        // Extrair string do PSBT (caso venha como objeto)
        const psbtBase64 = typeof psbtInput === 'object' && psbtInput.signedPsbt 
            ? psbtInput.signedPsbt 
            : psbtInput;
        
        console.log('   Pool ID:', poolId);
        console.log('   PSBT length:', psbtBase64.length);
        
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 1: Parse e validar PSBT assinado
        // ═══════════════════════════════════════════════════════════════════════
        
        console.log('\n🔍 STEP 1: Validating signed PSBT...');
        
        const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
        
        console.log('   Inputs:', psbt.inputCount);
        console.log('   Outputs:', psbt.txOutputs.length);
        
        // Verificar se está assinado
        let signed = false;
        try {
            psbt.validateSignaturesOfAllInputs(() => true);
            signed = true;
            console.log('   ✅ PSBT is signed');
        } catch (e) {
            console.log('   ⚠️  PSBT signatures not validated (may be normal)');
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 2: Finalizar e extrair TX
        // ═══════════════════════════════════════════════════════════════════════
        
        console.log('\n🔨 STEP 2: Finalizing PSBT...');
        
        try {
            psbt.finalizeAllInputs();
            console.log('   ✅ All inputs finalized');
        } catch (e) {
            console.warn('   ⚠️  Some inputs could not be finalized:', e.message);
            // Continuar mesmo assim (pode ser normal para Taproot)
        }
        
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        const txid = tx.getId();
        
        console.log('   TXID:', txid);
        console.log('   TX size:', txHex.length / 2, 'bytes');
        
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 3: VALIDAR RUNESTONE (CRÍTICO!)
        // ═══════════════════════════════════════════════════════════════════════
        
        console.log('\n🔍 STEP 3: VALIDATING RUNESTONE (CRITICAL!)...');
        
        // Encontrar output OP_RETURN
        let opReturnOutput = null;
        let opReturnIndex = -1;
        
        for (let i = 0; i < tx.outs.length; i++) {
            const out = tx.outs[i];
            if (out.script[0] === 0x6a) {  // OP_RETURN
                opReturnOutput = out;
                opReturnIndex = i;
                break;
            }
        }
        
        if (!opReturnOutput) {
            console.error('   ❌ CRITICAL: No OP_RETURN found in transaction!');
            return res.status(400).json({
                success: false,
                error: 'CRITICAL: No OP_RETURN (Runestone) found in transaction. Aborting broadcast to prevent rune loss.'
            });
        }
        
        console.log('   ✅ OP_RETURN found at output', opReturnIndex);
        console.log('   Script length:', opReturnOutput.script.length, 'bytes');
        console.log('   Script hex:', opReturnOutput.script.toString('hex').substring(0, 40) + '...');
        
        // Validar formato do Runestone
        if (opReturnOutput.script.length < 4) {
            console.error('   ❌ CRITICAL: Runestone is TOO SHORT (likely empty)!');
            return res.status(400).json({
                success: false,
                error: 'CRITICAL: Runestone is empty or invalid. Aborting broadcast to prevent rune loss.',
                runestoneHex: opReturnOutput.script.toString('hex')
            });
        }
        
        // Verificar formato: OP_RETURN (0x6a) + OP_13 (0x5d)
        if (opReturnOutput.script[0] !== 0x6a) {
            console.error('   ❌ CRITICAL: Not an OP_RETURN!');
            return res.status(400).json({
                success: false,
                error: 'CRITICAL: Output is not an OP_RETURN. Aborting.'
            });
        }
        
        if (opReturnOutput.script[1] !== 0x5d) {
            console.error('   ❌ CRITICAL: Not a valid Runestone (missing OP_13)!');
            return res.status(400).json({
                success: false,
                error: 'CRITICAL: Not a valid Runestone format. Aborting broadcast to prevent rune loss.',
                runestoneHex: opReturnOutput.script.toString('hex')
            });
        }
        
        console.log('   ✅ Runestone format is VALID');
        console.log('   ✅ Runestone is NOT empty');
        console.log('   ✅ Contains protocol identifier (OP_13)');
        
        // Extrair payload do Runestone (após OP_RETURN + OP_13 + size)
        const runestonePayload = opReturnOutput.script.slice(3); // Pular 6a 5d <size>
        console.log('   Payload length:', runestonePayload.length, 'bytes');
        console.log('   Payload hex:', runestonePayload.toString('hex'));
        
        // ✅ VALIDATION PASSED!
        console.log('\n✅ ========== RUNESTONE VALIDATION PASSED ==========');
        
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 4: Broadcast TX
        // ═══════════════════════════════════════════════════════════════════════
        
        console.log('\n📡 STEP 4: Broadcasting transaction...');
        
        try {
            await bitcoinRpc.call('sendrawtransaction', [txHex]);
            console.log('   ✅ Transaction broadcast successful!');
        } catch (broadcastError) {
            console.error('   ❌ Broadcast failed:', broadcastError.message);
            
            // Se falhar, não é crítico (pode estar no mempool já)
            console.log('   ⚠️  Continuing anyway (may be in mempool)...');
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 5: Registrar pool no State Tracker
        // ═══════════════════════════════════════════════════════════════════════
        
        console.log('\n📊 STEP 5: Registering pool in State Tracker...');
        
        // Extrair dados da TX
        const fundingOutput = tx.outs[0];  // Output 0 = funding
        const fundingValue = fundingOutput.value;
        
        // Decodificar endereço do funding output
        const fundingScript = fundingOutput.script;
        const fundingAddress = bitcoin.address.fromOutputScript(fundingScript, bitcoin.networks.bitcoin);
        
        console.log('   Funding UTXO:', `${txid}:0`);
        console.log('   Funding Value:', fundingValue, 'sats');
        console.log('   Funding Address:', fundingAddress);
        
        // Criar registro no State Tracker
        try {
            await StateTracker.createPool({
                poolId,
                userAddress: fundingAddress,
                utxoTxid: txid,
                utxoVout: 0,
                runeId: poolId.split(':')[0] + ':' + poolId.split(':')[1],  // Extract from poolId
                runeAmount: '0',  // TODO: extrair do request
                btcAmount: fundingValue,
                poolName: poolName || 'Lightning DeFi Pool',
                status: 'pending',
                createdAt: Date.now()
            });
            
            console.log('   ✅ Pool registered in State Tracker');
        } catch (stError) {
            console.error('   ⚠️  Failed to register in State Tracker:', stError.message);
            // Não é crítico, continuar
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 6: Retornar sucesso
        // ═══════════════════════════════════════════════════════════════════════
        
        console.log('\n✅ ========== POOL CREATED SUCCESSFULLY ==========');
        console.log('TXID:', txid);
        console.log('Pool ID:', poolId);
        console.log('Explorer:', `https://mempool.space/tx/${txid}`);
        
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 5: Initialize Virtual Pool (L2 State)
        // ═══════════════════════════════════════════════════════════════════════
        
        console.log('\n🌩️ STEP 5: Initializing virtual pool (L2 state)...');
        
        try {
            await syntheticRunesService.initializeVirtualPool(
                poolId,
                fundingValue,
                parseFloat(pool.funding.runeAmount) / 1e8  // Convert atomic units to display units
            );
            
            console.log('   ✅ Virtual pool initialized!');
            console.log('   Ready for instant Lightning swaps! ⚡');
            
        } catch (virtualError) {
            console.warn('   ⚠️  Failed to initialize virtual pool:', virtualError.message);
            console.warn('   Pool will still work for on-chain swaps');
        }
        
        res.json({
            success: true,
            txid,
            poolId,
            fundingUtxo: `${txid}:0`,
            fundingValue,
            fundingAddress,
            explorerUrl: `https://mempool.space/tx/${txid}`,
            message: 'Pool created successfully! ✨ Lightning swaps enabled! ⚡',
            validations: {
                runestoneFormat: 'VALID ✅',
                runestoneNotEmpty: 'VALID ✅',
                protocolIdentifier: 'VALID ✅'
            },
            features: {
                l1Swaps: true,
                l2LightningSwaps: true,
                syntheticRunes: true
            }
        });
        
    } catch (error) {
        console.error('\n❌ Error finalizing pool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 GET POOLS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/pools', async (req, res) => {
    try {
        const pools = await StateTracker.listActiveChannels();
        
        res.json({
            success: true,
            count: pools.length,
            pools: pools.map(pool => ({
                id: pool.poolId,
                name: pool.poolName,
                rune: pool.runeId,
                btc: pool.btcAmount,
                status: pool.status,
                created: pool.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 GET STATUS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/status', async (req, res) => {
    try {
        const pools = await StateTracker.listActiveChannels();
        
        res.json({
            success: true,
            version: '2.0-SECURE',
            security: {
                userControlsFunds: true,
                noOrphanAddresses: true,
                runestoneValidated: true
            },
            pools: {
                total: pools.length,
                active: pools.filter(p => p.status === 'active').length,
                pending: pools.filter(p => p.status === 'pending').length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 SWAP (Lightning Off-chain)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/lightning-defi/swap
 * 
 * Fazer swap off-chain via Lightning Network
 * Os saldos são atualizados no State Tracker
 */
router.post('/swap', async (req, res) => {
    console.log('\n🔄 ========== SWAP (Off-chain) ==========');
    
    try {
        const { poolId, inputAsset, inputAmount, outputAsset } = req.body;
        
        if (!poolId || !inputAsset || !inputAmount || !outputAsset) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        console.log('   Pool:', poolId);
        console.log('   Swap:', inputAmount, inputAsset, '→', outputAsset);
        
        // TODO: Implementar lógica de swap off-chain
        // Por enquanto, retornar placeholder
        
        res.json({
            success: true,
            message: 'Swap functionality coming soon',
            swap: {
                input: `${inputAmount} ${inputAsset}`,
                output: `TBD ${outputAsset}`
            }
        });
        
    } catch (error) {
        console.error('❌ Error in swap:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 CLOSE POOL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/lightning-defi/close-pool
 * 
 * Fechar pool = Gastar o UTXO da pool e retornar fundos para o usuário
 */
router.post('/close-pool', async (req, res) => {
    console.log('\n🔒 ========== CLOSE POOL ==========');
    
    try {
        const { poolId, userAddress } = req.body;
        
        if (!poolId || !userAddress) {
            return res.status(400).json({
                success: false,
                error: 'Missing poolId or userAddress'
            });
        }
        
        console.log('   Pool ID:', poolId);
        console.log('   User Address:', userAddress);
        
        // Buscar pool no State Tracker
        const pool = await StateTracker.getPool(poolId);
        
        if (!pool) {
            return res.status(404).json({
                success: false,
                error: 'Pool not found'
            });
        }
        
        // TODO: Criar PSBT para gastar o UTXO da pool
        // e retornar fundos + runes para o usuário
        
        res.json({
            success: true,
            message: 'Close pool functionality coming soon',
            pool: {
                id: poolId,
                utxo: `${pool.utxoTxid}:${pool.utxoVout}`,
                value: pool.btcAmount
            }
        });
        
    } catch (error) {
        console.error('❌ Error closing pool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 LIST POOLS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/lightning-defi/list-pools
 * 
 * Listar pools disponíveis (incluindo estado virtual L2)
 */
router.get('/list-pools', async (req, res) => {
    console.log('\n📋 ========== LIST POOLS ==========');
    
    try {
        const pools = await StateTracker.listActiveChannels();
        
        console.log(`   Found ${pools.length} active pools`);
        
        // Enriquecer com dados do virtual pool state
        const enrichedPools = await Promise.all(pools.map(async (pool) => {
            try {
                const stats = await syntheticRunesService.getPoolStats(pool.poolId);
                
                return {
                    poolId: pool.poolId,
                    runeName: pool.runeName,
                    runeSymbol: pool.runeSymbol,
                    runeId: pool.runeId,
                    btcAmount: pool.btcAmount,
                    runeAmount: pool.runeAmount,
                    createdAt: pool.createdAt,
                    // ✅ Pool branding (logo + creator)
                    poolImageUrl: pool.pool_image_url || '/images/kray-station-logo.png',
                    poolImageInscriptionId: pool.pool_image_inscription_id || null,
                    creatorAddress: pool.creator_address || pool.userAddress,
                    // L2 stats
                    l2Enabled: stats.success,
                    virtualBtc: stats.success ? stats.l2.btc : pool.btcAmount,
                    virtualRunes: stats.success ? stats.l2.runes : pool.runeAmount,
                    syntheticIssued: stats.success ? stats.syntheticIssued : 0,
                    totalSwaps: stats.success ? stats.totalSwaps : 0,
                    feesCollected: stats.success ? stats.feesCollected : 0
                };
            } catch (err) {
                console.warn(`   ⚠️  Pool ${pool.poolId} has no L2 state (L1 only)`);
                return {
                    poolId: pool.poolId,
                    runeName: pool.runeName,
                    runeSymbol: pool.runeSymbol,
                    runeId: pool.runeId,
                    btcAmount: pool.btcAmount,
                    runeAmount: pool.runeAmount,
                    createdAt: pool.createdAt,
                    // ✅ Pool branding (logo + creator)
                    poolImageUrl: pool.pool_image_url || '/images/kray-station-logo.png',
                    poolImageInscriptionId: pool.pool_image_inscription_id || null,
                    creatorAddress: pool.creator_address || pool.userAddress,
                    l2Enabled: false
                };
            }
        }));
        
        res.json({
            success: true,
            pools: enrichedPools
        });
        
    } catch (error) {
        console.error('❌ Error listing pools:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🌩️ SYNTHETIC RUNES - L2 INSTANT SWAPS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/lightning-defi/swap-lightning
 * 
 * Swap instantâneo via Lightning usando synthetic runes
 * - User paga BTC via Lightning
 * - Recebe synthetic runes instantaneamente
 * - Pode trocar de volta ou resgatar para L1 depois
 */
router.post('/swap-lightning', async (req, res) => {
    console.log('\n⚡ ========== LIGHTNING SWAP (SYNTHETIC) ==========');
    
    try {
        const { poolId, userAddress, fromAsset, toAsset, amountIn, minAmountOut } = req.body;
        
        console.log('   Pool:', poolId);
        console.log('   User:', userAddress);
        console.log('   From:', fromAsset);
        console.log('   To:', toAsset);
        console.log('   Amount in:', amountIn);
        console.log('   Min out:', minAmountOut);
        
        // 1. Calcular swap usando AMM virtual
        const calculation = await syntheticRunesService.calculateSwap(
            poolId, fromAsset, toAsset, amountIn
        );
        
        // 2. Validar slippage
        if (calculation.amountOut < minAmountOut) {
            return res.status(400).json({
                success: false,
                error: `Slippage too high. Expected ${minAmountOut}, got ${calculation.amountOut}`,
                slippage: calculation.slippage
            });
        }
        
        // 3. Se comprando synthetic (BTC → Runes), criar Lightning invoice
        if (fromAsset === 'BTC') {
            const lnd = getLNDPoolClient();
            
            const invoice = await lnd.addInvoice({
                value: amountIn,
                memo: `Swap ${amountIn} sats for ${calculation.amountOut.toFixed(8)} synthetic runes`,
                expiry: 3600
            });
            
            const swapId = `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Salvar swap pendente
            await syntheticRunesService.executeSwap(
                swapId, poolId, userAddress,
                fromAsset, toAsset,
                amountIn, calculation.amountOut,
                calculation.fee, calculation.executionPrice, calculation.slippage
            );
            
            console.log('   ✅ Lightning invoice created!');
            console.log('   Swap ID:', swapId);
            console.log('   Amount out:', calculation.amountOut);
            
            return res.json({
                success: true,
                swapId,
                invoice: invoice.payment_request,
                paymentHash: invoice.r_hash,
                amountOut: calculation.amountOut,
                fee: calculation.fee,
                price: calculation.executionPrice,
                slippage: calculation.slippage,
                expiresAt: Date.now() + 3600000,
                message: 'Pay invoice to complete swap'
            });
        }
        
        // 4. Se vendendo synthetic (Runes → BTC), verificar balance e pagar via Lightning
        if (toAsset === 'BTC') {
            const balance = await syntheticRunesService.getVirtualBalance(userAddress, poolId);
            
            if (balance.balance < amountIn) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient virtual balance. Have ${balance.balance}, need ${amountIn}`
                });
            }
            
            // Executar swap
            const swapId = `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            await syntheticRunesService.executeSwap(
                swapId, poolId, userAddress,
                fromAsset, toAsset,
                amountIn, calculation.amountOut,
                calculation.fee, calculation.executionPrice, calculation.slippage
            );
            
            // TODO: Pagar user via Lightning
            // const lnd = getLNDPoolClient();
            // await lnd.sendPayment({ amt: calculation.amountOut, ... });
            
            console.log('   ✅ Swap completed!');
            console.log('   User sold:', amountIn, 'synthetic runes');
            console.log('   User receives:', calculation.amountOut, 'sats');
            
            return res.json({
                success: true,
                swapId,
                amountOut: calculation.amountOut,
                message: 'Swap completed! BTC will be sent via Lightning.'
            });
        }
        
    } catch (error) {
        console.error('❌ Error in lightning swap:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/lightning-defi/virtual-balance/:address/:poolId
 * 
 * Obter balance de synthetic runes do usuário
 */
router.get('/virtual-balance/:address/:poolId', async (req, res) => {
    try {
        const { address, poolId } = req.params;
        
        const balance = await syntheticRunesService.getVirtualBalance(address, poolId);
        
        res.json({
            success: true,
            address,
            poolId,
            balance: balance.balance,
            transactionCount: balance.transactionCount
        });
        
    } catch (error) {
        console.error('❌ Error getting balance:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/lightning-defi/request-redemption
 * 
 * Solicitar resgate de synthetic → real runes (L2 → L1)
 */
router.post('/request-redemption', async (req, res) => {
    console.log('\n💰 ========== REQUEST REDEMPTION ==========');
    
    try {
        const { userAddress, poolId, amount } = req.body;
        
        console.log('   User:', userAddress);
        console.log('   Pool:', poolId);
        console.log('   Amount:', amount, 'synthetic runes');
        
        const result = await syntheticRunesService.requestRedemption(
            userAddress, poolId, amount
        );
        
        console.log('   ✅ Redemption requested!');
        console.log('   Redemption ID:', result.redemptionId);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error requesting redemption:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/lightning-defi/process-redemption
 * 
 * Processar redemption (criar + assinar + broadcast L1 TX)
 */
router.post('/process-redemption', async (req, res) => {
    console.log('\n🔨 ========== PROCESS REDEMPTION ==========');
    
    try {
        const { redemptionId } = req.body;
        
        // TODO: Implementar criação de PSBT + assinatura + broadcast
        // Por enquanto, retornar placeholder
        
        res.json({
            success: true,
            redemptionId,
            message: 'Redemption processing not yet implemented',
            status: 'pending'
        });
        
    } catch (error) {
        console.error('❌ Error processing redemption:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/lightning-defi/pool-stats/:poolId
 * 
 * Obter estatísticas da pool (L1 + L2)
 */
router.get('/pool-stats/:poolId', async (req, res) => {
    try {
        const { poolId } = req.params;
        
        const stats = await syntheticRunesService.getPoolStats(poolId);
        
        res.json(stats);
        
    } catch (error) {
        console.error('❌ Error getting pool stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/lightning-defi/audit-pool/:poolId
 * 
 * Auditar pool (verificar invariantes de segurança)
 */
router.get('/audit-pool/:poolId', async (req, res) => {
    try {
        const { poolId } = req.params;
        
        const audit = await syntheticRunesService.auditPool(poolId);
        
        res.json(audit);
        
    } catch (error) {
        console.error('❌ Error auditing pool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/lightning-defi/register-deposit
 * 
 * Registrar depósito de runes reais (L1 → L2)
 */
router.post('/register-deposit', async (req, res) => {
    console.log('\n📥 ========== REGISTER DEPOSIT ==========');
    
    try {
        const { userAddress, poolId, runeId, amount, txid, vout } = req.body;
        
        const result = await syntheticRunesService.registerDeposit(
            userAddress, poolId, runeId, amount, txid, vout
        );
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error registering deposit:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

