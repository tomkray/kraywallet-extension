import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import Database from 'better-sqlite3';

bitcoin.initEccLib(ecc);

const db = new Database('./server/db/ordinals.db');
const network = bitcoin.networks.bitcoin;

console.log('\n🔍 VERIFICANDO ÚLTIMO PSBT DO SELLER...\n');

// Pegar última oferta
const offer = db.prepare('SELECT * FROM offers ORDER BY created_at DESC LIMIT 1').get();

if (!offer) {
    console.log('❌ Nenhuma oferta encontrada!');
    process.exit(1);
}

console.log('📋 OFERTA ENCONTRADA:');
console.log('   ID:', offer.id);
console.log('   Preço:', offer.offer_amount, 'sats');
console.log('   Seller:', offer.creator_address);
console.log('   SIGHASH type (DB):', offer.sighash_type);
console.log('');

// Decodificar PSBT
try {
    const psbt = bitcoin.Psbt.fromBase64(offer.psbt, { network });
    
    console.log('✅ PSBT DECODIFICADO COM SUCESSO!\n');
    
    console.log('📊 ESTRUTURA DO PSBT:');
    console.log('   Inputs:', psbt.inputCount);
    console.log('   Outputs:', psbt.txOutputs.length);
    console.log('');
    
    console.log('📥 INPUTS:');
    for (let i = 0; i < psbt.inputCount; i++) {
        const input = psbt.data.inputs[i];
        const txInput = psbt.txInputs[i];
        const txid = Buffer.from(txInput.hash).reverse().toString('hex');
        
        console.log(`   Input ${i}:`);
        console.log(`      TXID: ${txid.substring(0, 16)}...`);
        console.log(`      VOUT: ${txInput.index}`);
        console.log(`      Value: ${input.witnessUtxo?.value || 'N/A'} sats`);
        console.log(`      tapKeySig: ${input.tapKeySig ? '✅ SIGNED (' + input.tapKeySig.length + ' bytes)' : '❌ NOT SIGNED'}`);
        console.log(`      sighashType: ${input.sighashType ? input.sighashType + ' (0x' + input.sighashType.toString(16) + ')' : 'default (0x00)'}`);
        
        // Decodificar sighashType
        if (input.sighashType) {
            const SIGHASH_ALL = 0x01;
            const SIGHASH_NONE = 0x02;
            const SIGHASH_SINGLE = 0x03;
            const SIGHASH_ANYONECANPAY = 0x80;
            
            const base = input.sighashType & 0x1f;
            const anyoneCanPay = (input.sighashType & SIGHASH_ANYONECANPAY) !== 0;
            
            let typeName = 'UNKNOWN';
            if (base === SIGHASH_ALL) typeName = 'ALL';
            else if (base === SIGHASH_NONE) typeName = 'NONE';
            else if (base === SIGHASH_SINGLE) typeName = 'SINGLE';
            
            if (anyoneCanPay) typeName += '|ANYONECANPAY';
            
            console.log(`      DECODED: ${typeName}`);
        }
        console.log('');
    }
    
    console.log('📤 OUTPUTS:');
    if (psbt.txOutputs.length === 0) {
        console.log('   ✅ NO OUTPUTS (correto para SIGHASH_NONE|ANYONECANPAY)');
    } else {
        for (let i = 0; i < psbt.txOutputs.length; i++) {
            const output = psbt.txOutputs[i];
            const address = bitcoin.address.fromOutputScript(output.script, network);
            console.log(`   Output ${i}: ${output.value} sats → ${address}`);
        }
    }
    console.log('');
    
    // Verificação final
    console.log('🔍 VERIFICAÇÃO:');
    const expectedSighash = 0x82; // NONE|ANYONECANPAY
    const actualSighash = psbt.data.inputs[0]?.sighashType || 0x00;
    
    if (psbt.txOutputs.length === 0 && actualSighash === expectedSighash) {
        console.log('   ✅ SELLER PSBT ESTÁ CORRETO!');
        console.log('   ✅ 0 outputs (buyer vai adicionar todos)');
        console.log('   ✅ SIGHASH_NONE|ANYONECANPAY (0x82)');
    } else {
        console.log('   ❌ SELLER PSBT ESTÁ ERRADO!');
        if (psbt.txOutputs.length > 0) {
            console.log(`   ❌ Tem ${psbt.txOutputs.length} output(s) (deveria ter 0)`);
        }
        if (actualSighash !== expectedSighash) {
            console.log(`   ❌ SIGHASH type: 0x${actualSighash.toString(16)} (deveria ser 0x82)`);
        }
    }
    
} catch (error) {
    console.error('❌ Erro ao decodificar PSBT:', error.message);
}

db.close();

