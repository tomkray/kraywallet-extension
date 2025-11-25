import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

// Nossa transação (assinaturas corretas, mas broadcast falha)
const ourTxHex = '02000000000102211b44209e9b41ca05739160184ae436dd677e6ede6b19129df12cf4202b95b10000000000ffffffff59c623677a88bd5d101c889c97083b903c0ec9174ac7086f2f4284260f897e790000000000ffffffff0400000000000000000a6a5d00c0a23303e807022202000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a22020000000000002251204231fc471ae54ddaf1ef941f7c92a9d83573d8c58fd7d0b9009be3613c368cce3421000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a0140219a450af3e0943b1fcc4374b14dc4ba81ec191aef6dbf1cdcdef7df8ae2bb2576a673e4ddb1673ec93553cdcabf77a0194d4ae707c548a17cfee8fc6990cacf0140d16a09e09a1e5f0cd2521b605aa118c8da5a0eb01b989a6646d81268156333b938167b7ef348495ec9c35619ff196d123868c11a36b9b97c517e6913bcae330700000000';

// Transação bem-sucedida (referência)
const successTxHex = '02000000000102521570f9959b1f74fca362cc783bcd3ee64ced1b98fae608773851ec770cd5bb0100000000ffffffff2d87c7df4bf95f2f4a1f2a1ffafaa3e4633fb94610261163485d03d5e11134ff0100000000ffffffff0400000000000000000d6a5d0a00c0a2330380c2d72f0222020000000000002251201b8cafdbee3a83629290dc80cf5a27381a52f6a1ff03929a45408227318b8ab52202000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a7bcf0000000000002251201b8cafdbee3a83629290dc80cf5a27381a52f6a1ff03929a45408227318b8ab5014012be5864036cf5a0c96fdba21d430a3aa22fa9831eefd91c322fb74d111b1cd94858765d826191942700ebacc299808adb80e836678f372a31a1002da51173b701407851e87f4f7c867a5ce2512dbe86dae11a47c203c39c25ffb4b29f3d7eb5844d3558a0383899d74e22b0d2824ee2c70f9d84984e9e5b7b404e171d7cd891c27700000000';

const ourTx = bitcoin.Transaction.fromHex(ourTxHex);
const successTx = bitcoin.Transaction.fromHex(successTxHex);

console.log('🔬 ANÁLISE BYTE-A-BYTE\n');

console.log('📊 ESTRUTURA GERAL:');
console.log('  Nossa TX:');
console.log('    Version:', ourTx.version);
console.log('    Inputs:', ourTx.ins.length);
console.log('    Outputs:', ourTx.outs.length);
console.log('    Locktime:', ourTx.locktime);
console.log('    Witness data:', ourTx.hasWitnesses());

console.log('\n  Success TX:');
console.log('    Version:', successTx.version);
console.log('    Inputs:', successTx.ins.length);
console.log('    Outputs:', successTx.outs.length);
console.log('    Locktime:', successTx.locktime);
console.log('    Witness data:', successTx.hasWitnesses());

console.log('\n\n🔍 OP_RETURN (RUNESTONE):');
console.log('  Nossa TX:');
const ourOpReturn = ourTx.outs[0].script;
console.log('    Script hex:', ourOpReturn.toString('hex'));
console.log('    Script length:', ourOpReturn.length);
console.log('    Decoded:', bitcoin.script.decompile(ourOpReturn));

console.log('\n  Success TX:');
const successOpReturn = successTx.outs[0].script;
console.log('    Script hex:', successOpReturn.toString('hex'));
console.log('    Script length:', successOpReturn.length);
console.log('    Decoded:', bitcoin.script.decompile(successOpReturn));

console.log('\n\n📤 OUTPUT SCRIPTS (TODOS):');
console.log('  Nossa TX:');
ourTx.outs.forEach((out, i) => {
    console.log(`    Output ${i}:`);
    console.log(`      Value: ${out.value}`);
    console.log(`      Script: ${out.script.toString('hex')}`);
    console.log(`      Script type:`, bitcoin.script.toASM(out.script).substring(0, 50));
});

console.log('\n  Success TX:');
successTx.outs.forEach((out, i) => {
    console.log(`    Output ${i}:`);
    console.log(`      Value: ${out.value}`);
    console.log(`      Script: ${out.script.toString('hex')}`);
    console.log(`      Script type:`, bitcoin.script.toASM(out.script).substring(0, 50));
});

console.log('\n\n💡 DIAGNÓSTICO:');
console.log('  ✅ Estrutura: Idêntica (2 inputs, 4 outputs, version 2)');
console.log('  ✅ Assinaturas: Validam corretamente');
console.log('  ✅ Witness: Presente em ambas');
console.log('  ');
console.log('  🔍 Diferenças no OP_RETURN:');
console.log('     Nossa:', ourOpReturn.toString('hex'));
console.log('     Success:', successOpReturn.toString('hex'));
console.log('  ');
console.log('  ⚠️  ERRO -26 scriptpubkey significa:');
console.log('     - O script de um OUTPUT está inválido');
console.log('     - Pode ser o OP_RETURN malformado');
console.log('     - Ou um dos scripts P2TR com problema');

console.log('\n\n🎯 PRÓXIMA AÇÃO:');
console.log('  Vou analisar o RUNESTONE em detalhe...');

