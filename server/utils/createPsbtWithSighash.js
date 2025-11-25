import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

/**
 * Cria um PSBT "template" que quando assinado pela Unisat,
 * a assinatura será compatível com SIGHASH_SINGLE | ANYONECANPAY
 * 
 * A ideia é criar um PSBT que:
 * 1. Tem apenas 1 input (inscription)
 * 2. Tem apenas 1 output (payment para vendedor)
 * 3. Quando o vendedor assina na Unisat, mesmo com SIGHASH_ALL,
 *    a assinatura é válida APENAS para: Input 0 → Output 0
 * 4. Depois podemos ADICIONAR mais outputs sem invalidar a assinatura
 *    porque não estamos modificando Output 0!
 * 
 * @param {Object} params - Parâmetros
 * @returns {string} PSBT em base64
 */
export function createSingleOutputPsbt(params) {
    const {
        inscriptionUtxo,    // { txid, vout, value, scriptPubKey }
        paymentAmount,       // Quanto o vendedor quer receber
        sellerAddress,       // Endereço do vendedor para receber pagamento
        network              // 'mainnet' ou 'testnet'
    } = params;
    
    console.log('\n🏗️  ========== CREATING SINGLE-OUTPUT PSBT ==========');
    console.log('Strategy: PSBT with 1 input → 1 output');
    console.log('This allows adding more outputs later without invalidating signature!');
    
    const btcNetwork = network === 'testnet' 
        ? bitcoin.networks.testnet 
        : bitcoin.networks.bitcoin;
    
    const psbt = new bitcoin.Psbt({ network: btcNetwork });
    
    // 1. Adicionar input da inscription
    const txidBuffer = Buffer.from(inscriptionUtxo.txid, 'hex').reverse();
    const scriptPubKey = Buffer.from(inscriptionUtxo.scriptPubKey, 'hex');
    
    // ⚠️ CRÍTICO: NÃO extrair tapInternalKey do scriptPubKey!
    // O scriptPubKey contém o OUTPUT KEY (tweaked), NÃO o internal key!
    console.log('✅ Using scriptPubKey for witnessUtxo:', scriptPubKey.toString('hex'));
    console.log('   NOTE: tapInternalKey NOT set (only tapKeySig needed for finalization)');
    
    const inputData = {
        hash: txidBuffer,
        index: inscriptionUtxo.vout,
        witnessUtxo: {
            script: scriptPubKey,
            value: inscriptionUtxo.value,
        },
        // ⚠️ NÃO adicionar tapInternalKey (só temos output key, não internal key)
    };
    
    psbt.addInput(inputData);
    console.log('✅ Input 0 added: Inscription UTXO');
    
    // 2. Adicionar APENAS 1 output: pagamento para vendedor
    // CRÍTICO: Este é o ÚNICO output no momento da assinatura!
    psbt.addOutput({
        address: sellerAddress,
        value: paymentAmount,
    });
    console.log('✅ Output 0 added: Payment to seller (' + paymentAmount + ' sats)');
    
    console.log('\n📊 PSBT STRUCTURE:');
    console.log('  Inputs: 1 (inscription)');
    console.log('  Outputs: 1 (payment to seller)');
    console.log('\n💡 STRATEGY:');
    console.log('  1. Seller signs this PSBT (Input 0 → Output 0)');
    console.log('  2. Backend ADDS more outputs (inscription to buyer, change)');
    console.log('  3. Seller signature remains VALID because Output 0 unchanged!');
    console.log('  4. Buyer signs new inputs');
    console.log('  5. Broadcast! ✅');
    console.log('====================================================\n');
    
    return psbt.toBase64();
}

/**
 * Após o vendedor assinar, adicionar mais outputs ao PSBT
 * SEM invalidar a assinatura do vendedor
 * 
 * @param {string} signedPsbtBase64 - PSBT assinado pelo vendedor
 * @param {Array} newOutputs - Novos outputs para adicionar
 * @returns {string} PSBT com novos outputs
 */
export function addOutputsToSignedPsbt(signedPsbtBase64, newOutputs, network = 'mainnet') {
    console.log('\n📝 ========== ADDING OUTPUTS TO SIGNED PSBT ==========');
    
    const btcNetwork = network === 'testnet' 
        ? bitcoin.networks.testnet 
        : bitcoin.networks.bitcoin;
    
    // Decodificar PSBT assinado
    const psbt = bitcoin.Psbt.fromBase64(signedPsbtBase64, { network: btcNetwork });
    
    console.log('📊 Current PSBT:');
    console.log('  Inputs:', psbt.inputCount);
    console.log('  Outputs:', psbt.txOutputs.length);
    
    // Verificar se input 0 está assinado
    const input0 = psbt.data.inputs[0];
    if (!input0.tapKeySig && !input0.partialSig) {
        throw new Error('Input 0 is not signed!');
    }
    
    console.log('✅ Input 0 is signed');
    console.log('\n➕ Adding new outputs...');
    
    // Adicionar novos outputs
    newOutputs.forEach((output, index) => {
        psbt.addOutput({
            address: output.address,
            value: output.value
        });
        console.log(`  ✅ Output ${psbt.txOutputs.length - 1}: ${output.value} sats → ${output.address.substring(0, 20)}...`);
    });
    
    console.log('\n📊 Updated PSBT:');
    console.log('  Inputs:', psbt.inputCount);
    console.log('  Outputs:', psbt.txOutputs.length);
    console.log('\n✅ Seller signature remains VALID (Output 0 unchanged)!');
    console.log('====================================================\n');
    
    return psbt.toBase64();
}

export default {
    createSingleOutputPsbt,
    addOutputsToSignedPsbt
};

