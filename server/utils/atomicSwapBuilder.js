/**
 * 🔐 ATOMIC SWAP PSBT BUILDER
 * 
 * Constrói PSBTs para marketplace com SIGHASH_SINGLE|ANYONECANPAY (0x83)
 * 
 * REGRAS CRÍTICAS (Consenso Bitcoin):
 * 1. Seller assina input[0] com SIGHASH_SINGLE|ANYONECANPAY
 * 2. output[0] = payout do seller (IMUTÁVEL: valor + endereço + índice)
 * 3. Qualquer alteração no output[0] invalida assinatura do seller
 * 4. Outputs adicionais (inscrição → buyer, taxa 2%, troco) vêm APÓS output[0]
 * 5. Roteamento ordinal-aware: input do seller → output do buyer (inscription)
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

/**
 * 1️⃣ CRIAR TEMPLATE PSBT PARA SELLER ASSINAR
 * 
 * Cria PSBT com:
 * - input[0] = UTXO do seller (inscription/ativo)
 * - output[0] = payout do seller (price_sats → seller_payout_address)
 * 
 * O seller assina com SIGHASH_SINGLE|ANYONECANPAY, travando:
 * - input[0] (seu UTXO)
 * - output[0] (seu pagamento)
 * 
 * @param {Object} params
 * @param {string} params.seller_txid - TXID do UTXO do seller
 * @param {number} params.seller_vout - vout do UTXO do seller
 * @param {number} params.seller_value - valor do UTXO em sats
 * @param {string} params.seller_script_pubkey - scriptPubKey hex
 * @param {string} params.seller_payout_address - endereço para receber pagamento
 * @param {number} params.price_sats - preço da venda
 * @param {string} params.network - 'mainnet' ou 'testnet'
 * @returns {Object} { psbtBase64, psbtHex }
 */
export function createListingTemplatePSBT(params) {
    const {
        seller_txid,
        seller_vout,
        seller_value,
        seller_script_pubkey,
        seller_payout_address,
        price_sats,
        network = 'mainnet'
    } = params;
    
    console.log('\n🏗️  ═══════════════════════════════════════════════════════');
    console.log('   CREATING LISTING TEMPLATE PSBT');
    console.log('   SIGHASH: SINGLE | ANYONECANPAY (0x83)');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Validações
    if (price_sats < 546) {
        throw new Error('Price must be >= 546 sats (dust limit)');
    }
    
    const btcNetwork = network === 'testnet' 
        ? bitcoin.networks.testnet 
        : bitcoin.networks.bitcoin;
    
    // Criar PSBT
    const psbt = new bitcoin.Psbt({ network: btcNetwork });
    
    // ═══════════════════════════════════════════════════════════════
    // INPUT[0]: UTXO do Seller (inscription ou ativo)
    // ═══════════════════════════════════════════════════════════════
    const txidBuffer = Buffer.from(seller_txid, 'hex').reverse();
    const scriptPubKey = Buffer.from(seller_script_pubkey, 'hex');
    
    psbt.addInput({
        hash: txidBuffer,
        index: seller_vout,
        witnessUtxo: {
            script: scriptPubKey,
            value: seller_value
        },
        // 🔐 SIGHASH_SINGLE|ANYONECANPAY será usado na assinatura
        // Não definimos aqui, o seller wallet define ao assinar
    });
    
    console.log('✅ Input[0] added:');
    console.log(`   TXID: ${seller_txid}`);
    console.log(`   vout: ${seller_vout}`);
    console.log(`   Value: ${seller_value} sats`);
    console.log(`   Script: ${seller_script_pubkey.substring(0, 40)}...`);
    
    // ═══════════════════════════════════════════════════════════════
    // OUTPUT[0]: Payout do Seller (IMUTÁVEL!)
    // ═══════════════════════════════════════════════════════════════
    // Este output[0] será TRAVADO pela assinatura SIGHASH_SINGLE
    // Qualquer alteração (valor, endereço ou índice) invalida a TX!
    
    psbt.addOutput({
        address: seller_payout_address,
        value: price_sats
    });
    
    console.log('\n✅ Output[0] added (SELLER PAYOUT - IMMUTABLE):');
    console.log(`   Address: ${seller_payout_address}`);
    console.log(`   Value: ${price_sats} sats`);
    console.log(`   🔒 This output is LOCKED by seller signature`);
    console.log(`   🔒 Cannot be changed without invalidating TX`);
    
    // ═══════════════════════════════════════════════════════════════
    // OUTPUT[1]: Inscription → Buyer (PLACEHOLDER - será substituído)
    // ═══════════════════════════════════════════════════════════════
    // 🔥 FIX: Adicionar TODOS os outputs ANTES do seller assinar!
    // Isso garante que SIGHASH_SINGLE veja o número correto de outputs!
    
    // ✅ Usar endereço do SELLER como placeholder (será substituído pelo buyer)
    // É apenas um placeholder temporário, vai ser trocado pelo endereço real do buyer!
    
    psbt.addOutput({
        address: seller_payout_address, // Usar endereço do seller como placeholder
        value: seller_value // Mesmo valor do UTXO (preserva inscription)
    });
    
    console.log('\n✅ Output[1] added (INSCRIPTION - PLACEHOLDER):');
    console.log(`   Address: ${seller_payout_address} (seller address as placeholder)`);
    console.log(`   Value: ${seller_value} sats`);
    console.log(`   ⚙️  Will be replaced by buyer address`);
    
    // ═══════════════════════════════════════════════════════════════
    // OUTPUT[2]: Market Fee 2% (FIXO - endereço do marketplace)
    // ═══════════════════════════════════════════════════════════════
    
    const marketFeeAddress = 'bc1pe3nvklfghzyepcjme5tyrv28kkmruypq0tmykgcdatkkreufyrhqaxf9p2';
    const marketFee = Math.max(Math.floor(price_sats * 0.02), 546);
    
    psbt.addOutput({
        address: marketFeeAddress,
        value: marketFee
    });
    
    console.log('\n✅ Output[2] added (MARKET FEE - FIXED):');
    console.log(`   Address: ${marketFeeAddress}`);
    console.log(`   Value: ${marketFee} sats (2% or min 546)`);
    
    // ═══════════════════════════════════════════════════════════════
    // OUTPUT[3]: Change do Buyer (PLACEHOLDER - será ajustado)
    // ═══════════════════════════════════════════════════════════════
    
    psbt.addOutput({
        address: seller_payout_address, // Usar endereço do seller como placeholder
        value: 1000 // Placeholder - será recalculado pelo buyer
    });
    
    console.log('\n✅ Output[3] added (BUYER CHANGE - PLACEHOLDER):');
    console.log(`   Address: ${seller_payout_address} (seller address as placeholder)`);
    console.log(`   Value: 1000 sats (placeholder)`);
    console.log(`   ⚙️  Will be replaced by buyer change address`);
    
    // ═══════════════════════════════════════════════════════════════
    // PRONTO! Template PSBT criado COM 4 OUTPUTS
    // ═══════════════════════════════════════════════════════════════
    
    console.log('\n📋 PSBT Structure (4 OUTPUTS - SIGHASH_SINGLE compatible):');
    console.log(`   Inputs: 1 (seller UTXO)`);
    console.log(`   Outputs: 4 (ALL defined before seller signs!)`);
    console.log(`\n   Seller signs with SIGHASH_SINGLE|ANYONECANPAY:`);
    console.log(`   - Locks output[0] (seller payout) ✅`);
    console.log(`   - Locks number of outputs (4) ✅`);
    console.log(`   - Allows buyer to MODIFY output[1,2,3] ✅`);
    console.log(`\n   Buyer will:`);
    console.log(`   - Add Input[1+]: Buyer UTXOs (payment)`);
    console.log(`   - Output[1]: Inscription → Buyer`);
    console.log(`   - Output[2]: Market Fee (2%)`);
    console.log(`   - Output[3+]: Change → Buyer`);
    
    console.log('\n🔐 Next Step: Seller signs input[0] with SIGHASH_SINGLE|ANYONECANPAY');
    console.log('═══════════════════════════════════════════════════════\n');
    
    return {
        psbtBase64: psbt.toBase64(),
        psbtHex: psbt.toHex()
    };
}

/**
 * 2️⃣ VALIDAR PSBT ASSINADO PELO SELLER
 * 
 * Verifica:
 * - input[0] está assinado
 * - SIGHASH é SINGLE|ANYONECANPAY (0x83)
 * - output[0] existe e tem valor correto
 * - output[0] tem endereço correto
 * 
 * @param {string} psbtBase64 - PSBT assinado pelo seller
 * @param {Object} expected - Valores esperados
 * @returns {Object} { valid, errors[], signature, sighashType }
 */
export function validateSellerSignedPSBT(psbtBase64, expected) {
    console.log('\n🔍 ═══════════════════════════════════════════════════════');
    console.log('   VALIDATING SELLER SIGNED PSBT');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const errors = [];
    
    try {
        const network = expected.network === 'testnet' 
            ? bitcoin.networks.testnet 
            : bitcoin.networks.bitcoin;
        
        const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network });
        
        // ✅ 1. Verificar estrutura básica
        if (psbt.data.inputs.length === 0) {
            errors.push('PSBT has no inputs');
        }
        
        if (psbt.txOutputs.length === 0) {
            errors.push('PSBT has no outputs');
        }
        
        if (errors.length > 0) {
            return { valid: false, errors };
        }
        
        // ✅ 2. Verificar assinatura no input[0]
        const input0 = psbt.data.inputs[0];
        
        if (!input0.tapKeySig && !input0.partialSig) {
            errors.push('Input[0] is not signed (no tapKeySig or partialSig)');
        }
        
        let signature = null;
        let sighashType = null;
        
        if (input0.tapKeySig) {
            // Taproot signature
            signature = input0.tapKeySig;
            
            // Extrair SIGHASH do último byte (se assinatura tem 65 bytes)
            if (signature.length === 65) {
                sighashType = signature[64];
                console.log(`✅ Taproot signature found (65 bytes)`);
                console.log(`   SIGHASH byte: 0x${sighashType.toString(16)}`);
            } else if (signature.length === 64) {
                // 64 bytes = Schnorr pura, checar campo sighashType separado
                // ✅ CRITICAL: bitcoinjs-lib com BIP 341 usa campo separado!
                if (input0.sighashType !== undefined) {
                    sighashType = input0.sighashType;
                    console.log(`✅ Taproot signature found (64 bytes with separate sighashType field)`);
                    console.log(`   sighashType field: 0x${sighashType.toString(16)}`);
                } else {
                    // 64 bytes sem sighashType = SIGHASH_DEFAULT (0x00)
                sighashType = 0x00;
                console.log(`✅ Taproot signature found (64 bytes)`);
                console.log(`   SIGHASH: DEFAULT (0x00)`);
                }
            } else {
                errors.push(`Invalid signature length: ${signature.length} bytes`);
            }
        } else if (input0.partialSig && input0.partialSig.length > 0) {
            // Legacy signature
            signature = input0.partialSig[0].signature;
            // Extrair SIGHASH do último byte
            sighashType = signature[signature.length - 1];
            console.log(`✅ Legacy signature found`);
            console.log(`   SIGHASH byte: 0x${sighashType.toString(16)}`);
        }
        
        // ✅ 3. Validar SIGHASH = SINGLE|ANYONECANPAY (0x83)
        const SIGHASH_SINGLE_ANYONECANPAY = 0x83;
        
        if (sighashType !== SIGHASH_SINGLE_ANYONECANPAY) {
            errors.push(
                `Invalid SIGHASH type: expected 0x83 (SINGLE|ANYONECANPAY), got 0x${sighashType?.toString(16) || '??'}`
            );
        } else {
            console.log(`✅ SIGHASH type is correct: SINGLE|ANYONECANPAY (0x83)`);
        }
        
        // ✅ 4. Validar output[0]
        const output0 = psbt.txOutputs[0];
        
        if (!output0) {
            errors.push('Output[0] is missing');
        } else {
            const output0Address = bitcoin.address.fromOutputScript(output0.script, network);
            const output0Value = output0.value;
            
            console.log(`\n✅ Output[0] verification:`);
            console.log(`   Address: ${output0Address}`);
            console.log(`   Value: ${output0Value} sats`);
            console.log(`   Expected address: ${expected.seller_payout_address}`);
            console.log(`   Expected value: ${expected.price_sats} sats`);
            
            if (output0Address !== expected.seller_payout_address) {
                errors.push(
                    `Output[0] address mismatch: expected ${expected.seller_payout_address}, got ${output0Address}`
                );
            }
            
            if (output0Value !== expected.price_sats) {
                errors.push(
                    `Output[0] value mismatch: expected ${expected.price_sats} sats, got ${output0Value} sats`
                );
            }
            
            if (errors.length === 0) {
                console.log(`✅ Output[0] is correct (seller payout locked)`);
            }
        }
        
        // ✅ 5. Verificar se PSBT tem apenas 1 output (template)
        if (psbt.txOutputs.length !== 1) {
            console.warn(`⚠️  PSBT has ${psbt.txOutputs.length} outputs (expected 1 for template)`);
            console.warn(`   Additional outputs will be ignored in listing`);
        }
        
        console.log('\n═══════════════════════════════════════════════════════');
        
        if (errors.length > 0) {
            console.error('❌ Validation failed:');
            errors.forEach(e => console.error(`   - ${e}`));
            return { valid: false, errors };
        }
        
        console.log('✅ PSBT validation passed!');
        console.log('═══════════════════════════════════════════════════════\n');
        
        return {
            valid: true,
            errors: [],
            signature: signature.toString('hex'),
            sighashType: sighashType,
            psbtData: {
                inputCount: psbt.data.inputs.length,
                outputCount: psbt.txOutputs.length,
                output0: {
                    address: bitcoin.address.fromOutputScript(output0.script, network),
                    value: output0.value,
                    script: output0.script.toString('hex')
                }
            }
        };
        
    } catch (error) {
        console.error('❌ PSBT validation error:', error);
        return {
            valid: false,
            errors: [`PSBT parsing error: ${error.message}`]
        };
    }
}

export default {
    createListingTemplatePSBT,
    validateSellerSignedPSBT
};

