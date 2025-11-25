#!/usr/bin/env node

// Script para testar finalização direta de um PSBT
// Uso: node test-finalize-direct.js <psbt_hex_ou_base64>

const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
bitcoin.initEccLib(ecc);

const psbtInput = process.argv[2];

if (!psbtInput) {
    console.log('❌ Uso: node test-finalize-direct.js <psbt_hex_ou_base64>');
    console.log('\nExemplo:');
    console.log('  node test-finalize-direct.js 70736274ff0100...');
    console.log('  node test-finalize-direct.js cHNidP8BAJ0C...');
    process.exit(1);
}

console.log('\n🔍 TESTE DE FINALIZAÇÃO DIRETA\n');
console.log('Input length:', psbtInput.length, 'chars');
console.log('Format:', psbtInput.startsWith('7073627') ? 'HEX' : 'BASE64');

try {
    // Detectar formato
    let psbtBase64;
    if (psbtInput.startsWith('70736274')) {
        console.log('Converting HEX to BASE64...');
        psbtBase64 = Buffer.from(psbtInput, 'hex').toString('base64');
    } else {
        psbtBase64 = psbtInput;
    }
    
    // Decodificar
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    
    console.log('\n✅ PSBT decodificado');
    console.log('   Inputs:', psbt.inputCount);
    console.log('   Outputs:', psbt.txOutputs.length);
    
    // Verificar assinaturas
    console.log('\n📋 Assinaturas:');
    for (let i = 0; i < psbt.inputCount; i++) {
        const input = psbt.data.inputs[i];
        console.log(`  Input ${i}:`, {
            tapKeySig: input.tapKeySig ? '✅ ' + input.tapKeySig.length + ' bytes' : '❌',
            tapInternalKey: input.tapInternalKey ? '✅' : '❌',
            witnessUtxo: input.witnessUtxo ? '✅' : '❌'
        });
    }
    
    // Finalizar
    console.log('\n🔧 Finalizando...');
    psbt.finalizeAllInputs();
    console.log('✅ Finalizado!');
    
    // Extrair
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    const txid = tx.getId();
    
    console.log('\n✅ Transação extraída:');
    console.log('   TXID:', txid);
    console.log('   Size:', txHex.length / 2, 'bytes');
    console.log('\n📤 Transaction Hex:');
    console.log(txHex);
    console.log('\n🎉 PRONTO PARA BROADCAST!');
    console.log('\nComando para broadcast:');
    console.log(`  bitcoin-cli sendrawtransaction ${txHex}`);
    
} catch (error) {
    console.log('\n❌ ERRO:', error.message);
    console.log('\nStack:', error.stack);
}



