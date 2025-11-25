import * as bitcoin from 'bitcoinjs-lib';

// Transação RUNE BEM-SUCEDIDA (da blockchain)
const successTxHex = '02000000000102521570f9959b1f74fca362cc783bcd3ee64ced1b98fae608773851ec770cd5bb0100000000ffffffff2d87c7df4bf95f2f4a1f2a1ffafaa3e4633fb94610261163485d03d5e11134ff0100000000ffffffff0400000000000000000d6a5d0a00c0a2330380c2d72f0222020000000000002251201b8cafdbee3a83629290dc80cf5a27381a52f6a1ff03929a45408227318b8ab52202000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a7bcf0000000000002251201b8cafdbee3a83629290dc80cf5a27381a52f6a1ff03929a45408227318b8ab5014012be5864036cf5a0c96fdba21d430a3aa22fa9831eefd91c322fb74d111b1cd94858765d826191942700ebacc299808adb80e836678f372a31a1002da51173b701407851e87f4f7c867a5ce2512dbe86dae11a47c203c39c25ffb4b29f3d7eb5844d3558a0383899d74e22b0d2824ee2c70f9d84984e9e5b7b404e171d7cd891c27700000000';

// Nossa transação FALHADA
const ourTxHex = '02000000000102211b44209e9b41ca05739160184ae436dd677e6ede6b19129df12cf4202b95b10000000000ffffffff59c623677a88bd5d101c889c97083b903c0ec9174ac7086f2f4284260f897e790000000000ffffffff0300000000000000000a6a5d00c0a23303e8070122020000000000002251204231fc471ae54ddaf1ef941f7c92a9d83573d8c58fd7d0b9009be3613c368cce7823000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a01405436ac7f53b95aee58233b9ce63d8ae3448fea8caec27a7f8f781a58bece5d006ae89d3f6a9c70b374ee135a58f0177beda9f9b8be79fbc88b4e4260cc7542a40140081b7f9dce9498ff645bc71669c8e5e82a3d18fedec7ac0f5c2953e8d7ee4c696921703c1ffa3a6bdae1ba7b81c24a8b8ad9f5feb9dbfda1975cb7cf9536223b00000000';

console.log('🔍 ========== COMPARANDO TRANSAÇÕES RUNE ==========\n');

const successTx = bitcoin.Transaction.fromHex(successTxHex);
const ourTx = bitcoin.Transaction.fromHex(ourTxHex);

console.log('📊 ESTRUTURA GERAL:');
console.log('\n  Transação BEM-SUCEDIDA:');
console.log('    Version:', successTx.version);
console.log('    Locktime:', successTx.locktime);
console.log('    Inputs:', successTx.ins.length);
console.log('    Outputs:', successTx.outs.length);
console.log('    Witnesses:', successTx.ins.map(i => i.witness.length));

console.log('\n  NOSSA Transação:');
console.log('    Version:', ourTx.version);
console.log('    Locktime:', ourTx.locktime);
console.log('    Inputs:', ourTx.ins.length);
console.log('    Outputs:', ourTx.outs.length);
console.log('    Witnesses:', ourTx.ins.map(i => i.witness.length));

console.log('\n\n🔐 ANÁLISE DOS WITNESS (ASSINATURAS):');

console.log('\n  ✅ Transação BEM-SUCEDIDA:');
successTx.ins.forEach((input, i) => {
    console.log(`\n    Input ${i}:`);
    console.log('      Witness items:', input.witness.length);
    if (input.witness.length > 0) {
        const sig = input.witness[0];
        console.log('      Signature length:', sig.length, 'bytes');
        console.log('      Signature:', sig.toString('hex').substring(0, 32) + '...');
        
        if (sig.length === 64) {
            console.log('      ✅ 64 bytes = SIGHASH_DEFAULT (correto para Taproot)');
        } else if (sig.length === 65) {
            console.log('      ⚠️  65 bytes = SIGHASH_ALL explícito (0x01 no final)');
            console.log('      Last byte:', sig[64].toString(16));
        }
    }
});

console.log('\n  ❌ NOSSA Transação:');
ourTx.ins.forEach((input, i) => {
    console.log(`\n    Input ${i}:`);
    console.log('      Witness items:', input.witness.length);
    if (input.witness.length > 0) {
        const sig = input.witness[0];
        console.log('      Signature length:', sig.length, 'bytes');
        console.log('      Signature:', sig.toString('hex').substring(0, 32) + '...');
        
        if (sig.length === 64) {
            console.log('      ✅ 64 bytes = SIGHASH_DEFAULT (correto para Taproot)');
        } else if (sig.length === 65) {
            console.log('      ⚠️  65 bytes = SIGHASH_ALL explícito (0x01 no final)');
            console.log('      Last byte:', sig[64].toString(16));
        }
    }
});

console.log('\n\n📤 ANÁLISE DOS OUTPUTS:');

console.log('\n  ✅ Transação BEM-SUCEDIDA:');
successTx.outs.forEach((output, i) => {
    console.log(`\n    Output ${i}:`);
    console.log('      Value:', output.value, 'sats');
    console.log('      Script length:', output.script.length, 'bytes');
    console.log('      Script:', output.script.toString('hex'));
    
    if (output.script[0] === 0x6a) {
        console.log('      Type: OP_RETURN (Runestone)');
        console.log('      OP_RETURN data:', output.script.slice(1).toString('hex'));
    }
});

console.log('\n  ❌ NOSSA Transação:');
ourTx.outs.forEach((output, i) => {
    console.log(`\n    Output ${i}:`);
    console.log('      Value:', output.value, 'sats');
    console.log('      Script length:', output.script.length, 'bytes');
    console.log('      Script:', output.script.toString('hex'));
    
    if (output.script[0] === 0x6a) {
        console.log('      Type: OP_RETURN (Runestone)');
        console.log('      OP_RETURN data:', output.script.slice(1).toString('hex'));
    }
});

console.log('\n\n🎯 DIFERENÇAS CRÍTICAS:');
console.log('');

// Comparar OP_RETURN
const successOpReturn = successTx.outs[0].script.toString('hex');
const ourOpReturn = ourTx.outs[0].script.toString('hex');

console.log('1. OP_RETURN:');
console.log('   ✅ Bem-sucedida:', successOpReturn);
console.log('   ❌ Nossa:', ourOpReturn);

if (successOpReturn.length !== ourOpReturn.length) {
    console.log('   ⚠️  TAMANHOS DIFERENTES!');
    console.log('   ✅ Success length:', successOpReturn.length / 2, 'bytes');
    console.log('   ❌ Ours length:', ourOpReturn.length / 2, 'bytes');
}

// Comparar número de outputs
console.log('\n2. Número de Outputs:');
console.log('   ✅ Bem-sucedida:', successTx.outs.length, 'outputs');
console.log('   ❌ Nossa:', ourTx.outs.length, 'outputs');

if (successTx.outs.length !== ourTx.outs.length) {
    console.log('   ⚠️  NÚMERO DIFERENTE!');
}

// Comparar witness sizes
console.log('\n3. Witness Signatures:');
const successWitSizes = successTx.ins.map(i => i.witness[0]?.length);
const ourWitSizes = ourTx.ins.map(i => i.witness[0]?.length);
console.log('   ✅ Bem-sucedida:', successWitSizes, 'bytes');
console.log('   ❌ Nossa:', ourWitSizes, 'bytes');

if (JSON.stringify(successWitSizes) === JSON.stringify(ourWitSizes)) {
    console.log('   ✅ WITNESS SIZES IGUAIS!');
} else {
    console.log('   ⚠️  WITNESS SIZES DIFERENTES!');
}

console.log('\n\n💡 CONCLUSÃO:');
console.log('');

if (successOpReturn.length === ourOpReturn.length && 
    successTx.outs.length === ourTx.outs.length &&
    JSON.stringify(successWitSizes) === JSON.stringify(ourWitSizes)) {
    console.log('  ✅ ESTRUTURAS IDÊNTICAS!');
    console.log('  ');
    console.log('  O problema NÃO é estrutural.');
    console.log('  O problema deve ser:');
    console.log('  1. Chave privada usada para assinar');
    console.log('  2. Cálculo do sighash');
    console.log('  3. Dados nos prevouts (witnessUtxo)');
} else {
    console.log('  ⚠️  ESTRUTURAS DIFERENTES!');
    console.log('  Ajustar nossa transação para corresponder à bem-sucedida.');
}

