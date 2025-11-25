import * as bitcoin from 'bitcoinjs-lib';

// Hex da transação que falhou
const txHex = '02000000000102747e6461214c384c30bab0262deee685b5349403' +
'0df719f22fa3caab77' + '15e64200000000ffffffff59c623677a88bd5d101c889c970' +
'83b903c0ec9174ac7086f2f42842' + '60f897e790000000000ffffffff040000000000' +
'000000096a5dc0a23303f403012202' + '000000000000225120423' +
'1fc471ae54ddaf1ef941f7c92a9d83573d8c58fd7d0b' + '9009be3613c368ce220200000000000022512060' +
'9ea69c5ac55be1ab75130c788a' + '9345108378' +
'36b9bc5d5dab697b949e97fd8a342100000000000022512060' +
'9ea69c5ac55be1ab75130c788a9345108378' +
'36b9bc5d5dab697b949e97fd8a00000000';

console.log('📦 Decodificando transação que falhou...\n');

try {
    const tx = bitcoin.Transaction.fromHex(txHex);
    
    console.log('✅ Transação decodificada com sucesso!\n');
    
    console.log('📊 Informações da Transação:');
    console.log('  Version:', tx.version);
    console.log('  Locktime:', tx.locktime);
    console.log('  Inputs:', tx.ins.length);
    console.log('  Outputs:', tx.outs.length);
    console.log('');
    
    console.log('📥 INPUTS:');
    tx.ins.forEach((input, i) => {
        console.log(`  Input ${i}:`);
        console.log(`    Txid: ${Buffer.from(input.hash).reverse().toString('hex')}`);
        console.log(`    Vout: ${input.index}`);
        console.log(`    Sequence: ${input.sequence}`);
    });
    console.log('');
    
    console.log('📤 OUTPUTS:');
    tx.outs.forEach((output, i) => {
        console.log(`  Output ${i}:`);
        console.log(`    Value: ${output.value} sats`);
        console.log(`    ScriptPubKey (hex): ${output.script.toString('hex')}`);
        console.log(`    ScriptPubKey (length): ${output.script.length} bytes`);
        
        // Tentar identificar tipo
        if (output.script[0] === 0x6a) {
            console.log(`    Type: OP_RETURN (Runestone)`);
            
            // Decodificar runestone
            if (output.script[1] === 0x5d) {
                console.log(`    Contains: OP_13 (Runes Protocol)`);
                const runeData = output.script.slice(2);
                console.log(`    Rune Data (hex): ${runeData.toString('hex')}`);
            }
        } else if (output.script[0] === 0x51 && output.script[1] === 0x20) {
            console.log(`    Type: P2TR (Taproot)`);
            const pubkey = output.script.slice(2);
            console.log(`    Pubkey: ${pubkey.toString('hex')}`);
        } else if (output.script[0] === 0x00 && output.script[1] === 0x20) {
            console.log(`    Type: P2WSH (SegWit v0)`);
        } else if (output.script[0] === 0x00 && output.script[1] === 0x14) {
            console.log(`    Type: P2WPKH (SegWit v0)`);
        } else {
            console.log(`    Type: Unknown`);
        }
        console.log('');
    });
    
    // Verificar problemas
    console.log('🔍 DIAGNÓSTICO:');
    
    let hasIssues = false;
    
    // Verificar outputs com valor 0 que não sejam OP_RETURN
    tx.outs.forEach((output, i) => {
        if (output.value === 0 && output.script[0] !== 0x6a) {
            console.log(`  ❌ Output ${i}: Valor 0 mas NÃO é OP_RETURN!`);
            hasIssues = true;
        }
    });
    
    // Verificar outputs com valor < dust limit
    tx.outs.forEach((output, i) => {
        if (output.value > 0 && output.value < 546 && output.script[0] !== 0x6a) {
            console.log(`  ⚠️  Output ${i}: Valor ${output.value} abaixo do dust limit (546 sats)!`);
            hasIssues = true;
        }
    });
    
    // Verificar witness data
    const hasWitness = tx.ins.some(input => input.witness && input.witness.length > 0);
    if (!hasWitness) {
        console.log(`  ⚠️  Transação sem witness data (não está assinada?)`);
    } else {
        console.log(`  ✅ Transação tem witness data (assinada)`);
    }
    
    if (!hasIssues) {
        console.log('  ✅ Nenhum problema óbvio detectado nos outputs');
    }
    
    console.log('\n📝 CONCLUSÃO:');
    console.log('  Erro "scriptpubkey" geralmente significa:');
    console.log('    1. Output com valor 0 que não é OP_RETURN');
    console.log('    2. Output com valor abaixo do dust limit');
    console.log('    3. ScriptPubKey malformado');
    console.log('    4. Output duplicado (mesmo script)');
    
} catch (error) {
    console.error('❌ Erro ao decodificar:', error.message);
}




