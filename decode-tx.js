import * as bitcoin from 'bitcoinjs-lib';

const txHex = '02000000000102211b44209e9b41ca05739160184ae436dd677e6ede6b19129df12cf4202b95b10000000000ffffffff59c623677a88bd5d101c889c97083b903c0ec9174ac7086f2f4284260f897e790000000000ffffffff0300000000000000000a6a5d00c0a23303e8070122020000000000002251204231fc471ae54ddaf1ef941f7c92a9d83573d8c58fd7d0b9009be3613c368cce7823000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a01405436ac7f53b95aee58233b9ce63d8ae3448fea8caec27a7f8f781a58bece5d006ae89d3f6a9c70b374ee135a58f0177beda9f9b8be79fbc88b4e4260cc7542a40140081b7f9dce9498ff645bc71669c8e5e82a3d18fedec7ac0f5c2953e8d7ee4c696921703c1ffa3a6bdae1ba7b81c24a8b8ad9f5feb9dbfda1975cb7cf9536223b00000000';

console.log('🔍 Decodificando transação Rune...\n');

const tx = bitcoin.Transaction.fromHex(txHex);

console.log('📊 Transaction Info:');
console.log('  Version:', tx.version);
console.log('  Locktime:', tx.locktime);
console.log('  Inputs:', tx.ins.length);
console.log('  Outputs:', tx.outs.length);
console.log('');

console.log('📥 INPUTS:');
tx.ins.forEach((input, i) => {
    console.log(`\n  Input ${i}:`);
    console.log('    TXID:', Buffer.from(input.hash).reverse().toString('hex'));
    console.log('    VOUT:', input.index);
    console.log('    Sequence:', input.sequence.toString(16));
    console.log('    Script:', input.script.toString('hex'));
    console.log('    Witness items:', input.witness.length);
    
    if (input.witness.length > 0) {
        input.witness.forEach((wit, j) => {
            console.log(`      Witness ${j}: ${wit.toString('hex').substring(0, 64)}... (${wit.length} bytes)`);
        });
    }
});

console.log('\n\n📤 OUTPUTS:');
tx.outs.forEach((output, i) => {
    console.log(`\n  Output ${i}:`);
    console.log('    Value:', output.value);
    console.log('    Script:', output.script.toString('hex'));
    
    // Decode script
    if (output.script[0] === 0x6a) {
        console.log('    Type: OP_RETURN (Runestone)');
    } else if (output.script[0] === 0x51 && output.script[1] === 0x20) {
        console.log('    Type: P2TR (Taproot)');
        const pubkey = output.script.slice(2);
        console.log('    Pubkey:', pubkey.toString('hex'));
    }
});

console.log('\n\n🔐 WITNESS ANALYSIS:');
console.log('  Input 0 witness length:', tx.ins[0].witness[0]?.length, 'bytes');
console.log('  Input 1 witness length:', tx.ins[1].witness[0]?.length, 'bytes');
console.log('');
console.log('  ✅ Expected for Taproot key-path: 64 bytes (Schnorr signature)');
console.log('  ✅ SIGHASH_DEFAULT: signature WITHOUT sighash byte');
console.log('  ❌ SIGHASH_ALL: signature WITH 0x01 byte (65 bytes)');
console.log('');

if (tx.ins[0].witness[0]?.length === 64 && tx.ins[1].witness[0]?.length === 64) {
    console.log('  ✅ Both witnesses are 64 bytes - CORRECT for SIGHASH_DEFAULT!');
} else {
    console.log('  ❌ Witness sizes incorrect!');
}

console.log('\n\n💡 DIAGNÓSTICO:');
console.log('  Se as assinaturas são 64 bytes (correto)');
console.log('  E o erro é -26: scriptpubkey');
console.log('  Então o problema pode ser:');
console.log('  ');
console.log('  1. ❌ Assinatura foi feita com a CHAVE ERRADA');
console.log('  2. ❌ Sighash calculado INCORRETAMENTE');
console.log('  3. ❌ Output pubkey no witnessUtxo está ERRADO');
console.log('  ');
console.log('  Próximo passo: Verificar se a chave pública no output');
console.log('  corresponde à chave privada usada para assinar.');
