/**
 * 🔐 ATOMIC SWAP PURCHASE BUILDER
 * 
 * Constrói PSBT final para compra com validações de segurança
 * 
 * ESTRUTURA FINAL:
 * - Input[0]: Seller UTXO (assinado com SIGHASH_SINGLE|ANYONECANPAY)
 * - Input[1+]: Buyer UTXOs (pagamento)
 * - Output[0]: Seller payout (IMUTÁVEL - já travado pela assinatura)
 * - Output[1]: Inscription → Buyer (ordinal-aware routing)
 * - Output[2]: Market fee (2% mínimo 546 sats) → Marketplace
 * - Output[3+]: Change → Buyer
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

const MARKET_FEE_PERCENTAGE = 2.0; // 2%
const DUST_LIMIT = 546; // sats

/**
 * 3️⃣ PREPARAR PSBT PARA BUYER ASSINAR
 * 
 * Monta PSBT completo com:
 * - Seller inputs/outputs (da listing PSBT)
 * - Buyer inputs (para pagamento)
 * - Outputs adicionais (inscription, fee, change)
 * 
 * ⚠️ CRÍTICO: output[0] NÃO PODE SER ALTERADO (invalidaria seller signature)
 */
export function prepareBuyerPSBT(params) {
    const {
        listing_psbt_base64,
        seller_value,
        price_sats,
        buyer_address,
        buyer_change_address,
        buyer_inputs,  // [{ txid, vout, value, scriptPubKey }]
        miner_fee_rate = 2,  // sat/vB
        market_fee_address,
        network = 'mainnet'
    } = params;
    
    console.log('\n🛒 ═══════════════════════════════════════════════════════');
    console.log('   PREPARING BUYER PSBT');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const btcNetwork = network === 'testnet' 
        ? bitcoin.networks.testnet 
        : bitcoin.networks.bitcoin;
    
    // ═══════════════════════════════════════════════════════════════
    // 1. CARREGAR LISTING PSBT (com assinatura do seller)
    // ═══════════════════════════════════════════════════════════════
    const sellerPsbt = bitcoin.Psbt.fromBase64(listing_psbt_base64, { network: btcNetwork });
    
    console.log('📥 Seller PSBT loaded:');
    console.log(`   Inputs: ${sellerPsbt.data.inputs.length}`);
    console.log(`   Outputs: ${sellerPsbt.txOutputs.length}`);
    
    // Verificar que tem input[0] assinado
    const sellerInput = sellerPsbt.data.inputs[0];
    if (!sellerInput.tapKeySig && !sellerInput.partialSig) {
        throw new Error('Seller input[0] is not signed');
    }
    
    // Verificar que tem output[0] (seller payout)
    const sellerOutput = sellerPsbt.txOutputs[0];
    if (!sellerOutput) {
        throw new Error('Seller output[0] is missing');
    }
    
    console.log('✅ Seller signature found in input[0]');
    console.log(`✅ Output[0] (seller payout): ${sellerOutput.value} sats`);
    
    // ═══════════════════════════════════════════════════════════════
    // 2. CRIAR NOVO PSBT COM ESTRUTURA COMPLETA
    // ═══════════════════════════════════════════════════════════════
    const buyerPsbt = new bitcoin.Psbt({ network: btcNetwork });
    
    // ═══════════════════════════════════════════════════════════════
    // INPUT[0]: Seller UTXO (copiar do listing PSBT, SEM assinatura ainda)
    // ═══════════════════════════════════════════════════════════════
    // ⚠️ CRÍTICO: Não podemos adicionar input com assinatura já presente
    // A assinatura será adicionada no final, antes do broadcast
    
    buyerPsbt.addInput({
        hash: sellerPsbt.txInputs[0].hash,
        index: sellerPsbt.txInputs[0].index,
        witnessUtxo: sellerInput.witnessUtxo,
        tapInternalKey: sellerInput.tapInternalKey,
        // NÃO copiar tapKeySig aqui!
    });
    
    console.log('\n✅ Input[0] added (seller UTXO - signature pending)');
    
    // ═══════════════════════════════════════════════════════════════
    // INPUT[1+]: Buyer UTXOs (para pagamento)
    // ═══════════════════════════════════════════════════════════════
    let totalBuyerInput = 0;
    
    for (const utxo of buyer_inputs) {
        const txidBuffer = Buffer.from(utxo.txid, 'hex').reverse();
        const scriptPubKey = Buffer.from(utxo.script_pubkey, 'hex'); // ✅ Corrigido: script_pubkey (com underscore)
        
        buyerPsbt.addInput({
            hash: txidBuffer,
            index: utxo.vout,
            witnessUtxo: {
                script: scriptPubKey,
                value: utxo.value
            }
        });
        
        totalBuyerInput += utxo.value;
    }
    
    console.log(`✅ Added ${buyer_inputs.length} buyer input(s)`);
    console.log(`   Total buyer input: ${totalBuyerInput} sats`);
    
    // ═══════════════════════════════════════════════════════════════
    // COPIAR TODOS OS 4 OUTPUTS DO SELLER PSBT
    // ═══════════════════════════════════════════════════════════════
    // 🔥 MUDANÇA CRÍTICA: Seller PSBT agora tem 4 outputs!
    // Vamos copiar TODOS e depois MODIFICAR os que precisam (output[1,2,3])
    
    console.log('\n📋 Adding outputs (modifying placeholders as needed)...');
    
    // 🔥 MUDANÇA: Ao invés de copiar TODOS e depois atualizar,
    // vamos adicionar cada output JÁ com o valor/endereço correto!
    
    // OUTPUT[0]: Copiar exato do seller (IMUTÁVEL)
    const sellerOutput0 = sellerPsbt.txOutputs[0];
    buyerPsbt.addOutput({
        script: sellerOutput0.script,
        value: sellerOutput0.value
    });
    console.log(`   ✅ Output[0] copied (SELLER PAYOUT): ${sellerOutput0.value} sats - IMMUTABLE`);
    
    // OUTPUT[1]: Inscription → BUYER (substituir placeholder)
    const inscriptionOutputValue = seller_value;
    const buyerInscriptionScript = bitcoin.address.toOutputScript(buyer_address, btcNetwork);
    
    buyerPsbt.addOutput({
        script: buyerInscriptionScript,
        value: inscriptionOutputValue
    });
    
    console.log(`   ✅ Output[1] added (INSCRIPTION → BUYER): ${inscriptionOutputValue} sats`);
    console.log(`      Address: ${buyer_address}`);
    console.log(`      🎨 Ordinal-aware: inscription routes here`);
    
    // OUTPUT[2]: Market Fee - Copiar do seller PSBT
    const sellerOutput2 = sellerPsbt.txOutputs[2];
    let marketFeeSats = Math.floor(price_sats * (MARKET_FEE_PERCENTAGE / 100));
    if (marketFeeSats < DUST_LIMIT) {
        marketFeeSats = DUST_LIMIT;
    }
    
    buyerPsbt.addOutput({
        script: sellerOutput2.script,
        value: marketFeeSats
    });
    
    console.log(`   ✅ Output[2] added (MARKET FEE): ${marketFeeSats} sats`);
    
    // ═══════════════════════════════════════════════════════════════
    // CALCULAR FEE DE REDE E CHANGE
    // ═══════════════════════════════════════════════════════════════
    // Estimar tamanho da TX (aproximado)
    // 1 input Taproot ≈ 58 vBytes
    // 1 output P2TR ≈ 43 vBytes
    const inputCount = 1 + buyer_inputs.length;
    const outputCountBeforeChange = 3; // seller payout + inscription + market fee
    
    const estimatedSize = (inputCount * 58) + (outputCountBeforeChange * 43) + 10; // +10 overhead
    const minerFee = Math.ceil(estimatedSize * miner_fee_rate);
    
    console.log(`\n📊 Fee calculation:`);
    console.log(`   Estimated TX size: ${estimatedSize} vBytes`);
    console.log(`   Fee rate: ${miner_fee_rate} sat/vB`);
    console.log(`   Miner fee: ${minerFee} sats`);
    
    // Total output = seller payout + inscription + market fee + miner fee
    const totalOutput = sellerOutput.value + inscriptionOutputValue + marketFeeSats;
    const totalNeeded = totalOutput + minerFee;
    
    console.log(`\n💰 Balance calculation:`);
    console.log(`   Total input: ${totalBuyerInput} sats`);
    console.log(`   Seller payout: ${sellerOutput.value} sats`);
    console.log(`   Inscription output: ${inscriptionOutputValue} sats`);
    console.log(`   Market fee: ${marketFeeSats} sats`);
    console.log(`   Miner fee: ${minerFee} sats`);
    console.log(`   Total needed: ${totalNeeded} sats`);
    
    if (totalBuyerInput < totalNeeded) {
        throw new Error(
            `Insufficient funds: need ${totalNeeded} sats, have ${totalBuyerInput} sats`
        );
    }
    
    // ═══════════════════════════════════════════════════════════════
    // OUTPUT[3]: Change → Buyer (adicionar com valor/endereço correto)
    // ═══════════════════════════════════════════════════════════════
    const change = totalBuyerInput - totalNeeded;
    
    console.log(`   Change: ${change} sats`);
    
    let changeOutputValue = 0;
    
    // 🔥 ADICIONAR output[3] com endereço e valor corretos
    if (change >= DUST_LIMIT) {
        const changeScript = bitcoin.address.toOutputScript(buyer_change_address || buyer_address, btcNetwork);
        
        buyerPsbt.addOutput({
            script: changeScript,
            value: change
        });
        
        changeOutputValue = change;
        
        console.log(`   ✅ Output[3] added (CHANGE → BUYER): ${change} sats`);
        console.log(`      Address: ${buyer_change_address || buyer_address}`);
    } else {
        // Change < dust, ainda precisamos adicionar output[3] (seller PSBT tem 4 outputs!)
        // Usar dust limit mínimo
        const changeScript = bitcoin.address.toOutputScript(buyer_change_address || buyer_address, btcNetwork);
        
        buyerPsbt.addOutput({
            script: changeScript,
            value: DUST_LIMIT
        });
        
        changeOutputValue = DUST_LIMIT;
        
        console.log(`   ⚠️  Change (${change} sats) < dust limit`);
        console.log(`   ✅ Output[3] added with minimum: ${DUST_LIMIT} sats`);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n📋 PSBT STRUCTURE:');
    console.log(`   Inputs: ${buyerPsbt.inputCount}`);
    console.log(`     - Input[0]: Seller UTXO (${seller_value} sats)`);
    console.log(`     - Input[1+]: Buyer UTXOs (${totalBuyerInput} sats)`);
    console.log(`   Outputs: ${buyerPsbt.txOutputs.length}`);
    console.log(`     - Output[0]: Seller payout (${sellerOutput.value} sats) 🔒`);
    console.log(`     - Output[1]: Inscription → Buyer (${inscriptionOutputValue} sats)`);
    console.log(`     - Output[2]: Market fee (${marketFeeSats} sats)`);
    if (changeOutputValue > 0) {
        console.log(`     - Output[3]: Change → Buyer (${changeOutputValue} sats)`);
    }
    
    console.log('\n✅ PSBT ready for buyer to sign inputs 1+');
    console.log('═══════════════════════════════════════════════════════\n');
    
    return {
        psbtBase64: buyerPsbt.toBase64(),
        summary: {
            totalBuyerInput,
            sellerPayout: sellerOutput.value,
            inscriptionOutput: inscriptionOutputValue,
            marketFee: marketFeeSats,
            minerFee,
            change: changeOutputValue,
            totalOutput: totalOutput + changeOutputValue,
            buyerInputIndices: Array.from({ length: buyer_inputs.length }, (_, i) => i + 1)
        }
    };
}

/**
 * VALIDAR OUTPUT[0] IMUTÁVEL
 * 
 * Verifica que output[0] no PSBT do buyer é idêntico ao da listing
 */
export function validateOutput0Immutable(buyerPsbtBase64, listingPsbtBase64, network = 'mainnet') {
    const btcNetwork = network === 'testnet' 
        ? bitcoin.networks.testnet 
        : bitcoin.networks.bitcoin;
    
    const buyerPsbt = bitcoin.Psbt.fromBase64(buyerPsbtBase64, { network: btcNetwork });
    const listingPsbt = bitcoin.Psbt.fromBase64(listingPsbtBase64, { network: btcNetwork });
    
    const buyerOutput0 = buyerPsbt.txOutputs[0];
    const listingOutput0 = listingPsbt.txOutputs[0];
    
    if (!buyerOutput0 || !listingOutput0) {
        return {
            valid: false,
            error: 'Output[0] is missing'
        };
    }
    
    // Comparar script (endereço)
    if (!buyerOutput0.script.equals(listingOutput0.script)) {
        return {
            valid: false,
            error: 'Output[0] script has been changed (address mismatch)'
        };
    }
    
    // Comparar valor
    if (buyerOutput0.value !== listingOutput0.value) {
        return {
            valid: false,
            error: `Output[0] value has been changed (expected ${listingOutput0.value}, got ${buyerOutput0.value})`
        };
    }
    
    return {
        valid: true,
        output0: {
            address: bitcoin.address.fromOutputScript(buyerOutput0.script, btcNetwork),
            value: buyerOutput0.value,
            script: buyerOutput0.script.toString('hex')
        }
    };
}

export default {
    prepareBuyerPSBT,
    validateOutput0Immutable
};

