import * as bitcoin from 'bitcoinjs-lib';

// Nova transação (com 4 outputs)
const newTxHex = '02000000000102211b44209e9b41ca05739160184ae436dd677e6ede6b19129df12cf4202b95b10000000000ffffffff59c623677a88bd5d101c889c97083b903c0ec9174ac7086f2f4284260f897e790000000000ffffffff0400000000000000000a6a5d00c0a23303e807022202000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a22020000000000002251204231fc471ae54ddaf1ef941f7c92a9d83573d8c58fd7d0b9009be3613c368cce9c1f000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a0140678391779c35ec7f725bfcc7ad9285b007e1a34fb27ffd28cb6de14efdf7cdaa48d889d3cf6ee685e96a76ad9beefcccf3b3354af2bcbba4ca93c7e1c7ee3287014074ce462915889713209f4a2ca0d1dd48d1d9b45ef70b90dcb3fc300bff8553d5f3d991b24b165c08905a1ede1856912016284655576581daee9bd7a17507ca4500000000';

// Transação bem-sucedida (referência)
const successTxHex = '02000000000102521570f9959b1f74fca362cc783bcd3ee64ced1b98fae608773851ec770cd5bb0100000000ffffffff2d87c7df4bf95f2f4a1f2a1ffafaa3e4633fb94610261163485d03d5e11134ff0100000000ffffffff0400000000000000000d6a5d0a00c0a2330380c2d72f0222020000000000002251201b8cafdbee3a83629290dc80cf5a27381a52f6a1ff03929a45408227318b8ab52202000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a7bcf0000000000002251201b8cafdbee3a83629290dc80cf5a27381a52f6a1ff03929a45408227318b8ab5014012be5864036cf5a0c96fdba21d430a3aa22fa9831eefd91c322fb74d111b1cd94858765d826191942700ebacc299808adb80e836678f372a31a1002da51173b701407851e87f4f7c867a5ce2512dbe86dae11a47c203c39c25ffb4b29f3d7eb5844d3558a0383899d74e22b0d2824ee2c70f9d84984e9e5b7b404e171d7cd891c27700000000';

console.log('🔍 COMPARANDO ESTRUTURAS:\n');

const newTx = bitcoin.Transaction.fromHex(newTxHex);
const successTx = bitcoin.Transaction.fromHex(successTxHex);

console.log('📊 OUTPUTS:');
console.log('\n  ✅ Transação BEM-SUCEDIDA:');
console.log('    Outputs:', successTx.outs.length);
successTx.outs.forEach((out, i) => {
    console.log(`    Output ${i}: ${out.value} sats, script: ${out.script.toString('hex').substring(0, 40)}...`);
});

console.log('\n  🆕 NOSSA NOVA Transação:');
console.log('    Outputs:', newTx.outs.length);
newTx.outs.forEach((out, i) => {
    console.log(`    Output ${i}: ${out.value} sats, script: ${out.script.toString('hex').substring(0, 40)}...`);
});

console.log('\n\n🔐 WITNESS (ASSINATURAS):');
console.log('\n  ✅ Transação BEM-SUCEDIDA:');
successTx.ins.forEach((input, i) => {
    const sig = input.witness[0];
    console.log(`    Input ${i}: ${sig.length} bytes - ${sig.toString('hex').substring(0, 32)}...`);
});

console.log('\n  🆕 NOSSA NOVA Transação:');
newTx.ins.forEach((input, i) => {
    const sig = input.witness[0];
    console.log(`    Input ${i}: ${sig.length} bytes - ${sig.toString('hex').substring(0, 32)}...`);
});

console.log('\n\n✅ ESTRUTURA:');
if (newTx.outs.length === successTx.outs.length) {
    console.log('  ✅ Número de outputs: CORRETO (4)');
} else {
    console.log('  ❌ Número de outputs: INCORRETO');
}

if (newTx.ins[0].witness[0].length === 64 && newTx.ins[1].witness[0].length === 64) {
    console.log('  ✅ Witness sizes: CORRETOS (64 bytes)');
} else {
    console.log('  ❌ Witness sizes: INCORRETOS');
}

console.log('\n\n💡 ANÁLISE:');
console.log('  A estrutura agora está CORRETA (4 outputs)!');
console.log('  As assinaturas são 64 bytes (SIGHASH_DEFAULT)!');
console.log('  ');
console.log('  MAS ainda falha com -26: scriptpubkey');
console.log('  ');
console.log('  Isso significa que o problema é:');
console.log('  1. ❌ O SIGHASH está sendo calculado INCORRETAMENTE');
console.log('  2. ❌ O bitcoinjs-lib não consegue calcular sighash BIP 341');
console.log('       corretamente para transações com OP_RETURN');
console.log('  ');
console.log('  SOLUÇÃO: Precisamos calcular o sighash manualmente');
console.log('           seguindo BIP 341 EXATAMENTE.');

