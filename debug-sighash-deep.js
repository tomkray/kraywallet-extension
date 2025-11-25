import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

// Nossa transação (que falha)
const ourTxHex = '02000000000102211b44209e9b41ca05739160184ae436dd677e6ede6b19129df12cf4202b95b10000000000ffffffff59c623677a88bd5d101c889c97083b903c0ec9174ac7086f2f4284260f897e790000000000ffffffff0400000000000000000a6a5d00c0a23303e807022202000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a22020000000000002251204231fc471ae54ddaf1ef941f7c92a9d83573d8c58fd7d0b9009be3613c368cce3421000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a01402b14be5262bce515c57f064e16a03fd76371446b2708b6a59ce214f084fb14c236b385f818e62d5f19705b9ea027e62b3746bfe4a45861ecd894d9e976566a0b01403342a963263ae011005f52f0f5f811bbfae331f538e13dc7a3262e565de930d66f2e0866d94465509055b6119b5043a3cd2fac784de93fb8032bc50a6734c0d500000000';

// Transação bem-sucedida (referência)
const successTxHex = '02000000000102521570f9959b1f74fca362cc783bcd3ee64ced1b98fae608773851ec770cd5bb0100000000ffffffff2d87c7df4bf95f2f4a1f2a1ffafaa3e4633fb94610261163485d03d5e11134ff0100000000ffffffff0400000000000000000d6a5d0a00c0a2330380c2d72f0222020000000000002251201b8cafdbee3a83629290dc80cf5a27381a52f6a1ff03929a45408227318b8ab52202000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a7bcf0000000000002251201b8cafdbee3a83629290dc80cf5a27381a52f6a1ff03929a45408227318b8ab5014012be5864036cf5a0c96fdba21d430a3aa22fa9831eefd91c322fb74d111b1cd94858765d826191942700ebacc299808adb80e836678f372a31a1002da51173b701407851e87f4f7c867a5ce2512dbe86dae11a47c203c39c25ffb4b29f3d7eb5844d3558a0383899d74e22b0d2824ee2c70f9d84984e9e5b7b404e171d7cd891c27700000000';

const ourTx = bitcoin.Transaction.fromHex(ourTxHex);
const successTx = bitcoin.Transaction.fromHex(successTxHex);

console.log('🔍 DEBUG PROFUNDO DO SIGHASH\n');

console.log('📊 COMPARAÇÃO:');
console.log('\n  Inputs:', ourTx.ins.length, 'vs', successTx.ins.length);
console.log('  Outputs:', ourTx.outs.length, 'vs', successTx.outs.length);
console.log('  Version:', ourTx.version, 'vs', successTx.version);
console.log('  Locktime:', ourTx.locktime, 'vs', successTx.locktime);

console.log('\n\n🔐 WITNESS (ASSINATURAS):');
console.log('\n  Nossa TX:');
ourTx.ins.forEach((input, i) => {
    const sig = input.witness[0];
    console.log(`    Input ${i}: ${sig.length} bytes`);
    console.log(`      Signature: ${sig.toString('hex')}`);
});

console.log('\n  Success TX:');
successTx.ins.forEach((input, i) => {
    const sig = input.witness[0];
    console.log(`    Input ${i}: ${sig.length} bytes`);
    console.log(`      Signature: ${sig.toString('hex')}`);
});

console.log('\n\n📤 OUTPUTS:');
console.log('\n  Nossa TX:');
ourTx.outs.forEach((out, i) => {
    console.log(`    Output ${i}: ${out.value} sats`);
    console.log(`      Script: ${out.script.toString('hex')}`);
});

console.log('\n  Success TX:');
successTx.outs.forEach((out, i) => {
    console.log(`    Output ${i}: ${out.value} sats`);
    console.log(`      Script: ${out.script.toString('hex')}`);
});

console.log('\n\n💡 ANÁLISE:');
console.log('  Estrutura: IDÊNTICA (4 outputs, 2 inputs)');
console.log('  Assinaturas: 64 bytes (SIGHASH_DEFAULT)');
console.log('  ');
console.log('  PROBLEMA: Assinatura não verifica');
console.log('  ');
console.log('  Possíveis causas:');
console.log('  1. Chave privada incorreta (mas verificamos que a chave pública está correta!)');
console.log('  2. Sighash calculado incorretamente');
console.log('  3. Dados dos prevouts (witnessUtxo) incorretos');
console.log('  ');
console.log('  Próxima ação: Verificar se os witnessUtxo têm os scripts corretos');

