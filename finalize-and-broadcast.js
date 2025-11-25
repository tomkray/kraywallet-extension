#!/usr/bin/env node

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import axios from 'axios';

bitcoin.initEccLib(ecc);

const psbtHex = process.argv[2] || '70736274ff0100dd02000000022fd071240f1fc664622a37e44e97a547e3072d9839284c1ff3178a8c5a0ec823c400000000ffffffffa76baf870a8d4727e03e1304642ea8288bc39157617e1a3ebd5d0c7ddc07fbed0100000000ffffffff032202000000000000225120ffb530e67a3beb6f583b889fcbd7ddd3ce1d3aa5850bd4321c299467b84884ccd0070000000000002251201b8cafdbee3a83629290dc80cf5a27381a52f6a1ff03929a45408227318b8ab56e98000000000000225120ffb530e67a3beb6f583b889fcbd7ddd3ce1d3aa5850bd4321c299467b84884cc000000000001012b22020000000000002251201b8cafdbee3a83629290dc80cf5a27381a52f6a1ff03929a45408227318b8ab5011340ea2d5367dc37f18201148c3579deeca28dc11147e271f2f8cde8964ab15b1683833064e672b6116d54a68dc3fa84f5a8f34786901ab81e6dce402f456afb627e011720ccdb99d575a1e4286e64fb5afea8b50dbad3906a1a09bd61130a79a56772bb310001012b32a2000000000000225120ffb530e67a3beb6f583b889fcbd7ddd3ce1d3aa5850bd4321c299467b84884cc0113404617de5df975c518780a3595e59ae8d2a44ca3c61f089a232df20e24d8642faaaf785038199379d2c654f60c8f19cb11420f79f69c06a3e7030faa9b0825588a0117203e776a445e06cd84b2cbcd133793e9369d73a2b95c2ffc85d543bd3b247a1c1100000000';

console.log('\n🔥 FINALIZE AND BROADCAST SCRIPT\n');

try {
    // Decodificar
    const psbtBase64 = Buffer.from(psbtHex, 'hex').toString('base64');
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    
    console.log('✅ PSBT decodificado');
    console.log('   Inputs:', psbt.inputCount);
    console.log('   Input 0 assinado:', !!psbt.data.inputs[0].tapKeySig);
    console.log('   Input 1 assinado:', !!psbt.data.inputs[1].tapKeySig);
    
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
    console.log('   Hex:', txHex);
    
    // Broadcast via mempool.space
    console.log('\n📤 Broadcasting via mempool.space...');
    
    const response = await axios.post('https://mempool.space/api/tx', txHex, {
        headers: { 'Content-Type': 'text/plain' }
    });
    
    console.log('\n🎉 BROADCAST SUCCESSFUL!');
    console.log('   TXID:', response.data);
    console.log('   View: https://mempool.space/tx/' + response.data);
    
} catch (error) {
    console.log('\n❌ ERRO:', error.message);
    if (error.response) {
        console.log('Response:', error.response.data);
    }
}



