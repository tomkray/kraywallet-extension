import * as bitcoin from 'bitcoinjs-lib';

// Hex da transação atual (do log: "Hex length: 894")
// Vou decodificar o PSBT para ver os outputs

const psbtBase64 = 'cHNidP8BAPQCAAAAAz509mEhTDhMMLqwJinu5oW1NJQDDfcZ8i+jyqt3FeZCAAAAAAD/////7aKd8+yXLCoF8T/jCznQlugAdXG9HPA2MA46P9X1yLECAAAAAP////9ZxiNneoi9XRAciJyXCDuQPA7JF0rHCG8vQoQmD4l+eQAAAAAA/////wMAAAAAAAAAABBqXcCiMwP0AwHAojMD9AMCIgIAAAAAAAAiUSBCMfxHGuVN2vHvlB98kqnYNXPYxY/X0LkAm+NhPDaMzmElAAAAAAAAIlEgYJ6mnFrFW+GrdRMMeIqTRRCDeDa5vF1dq2l7lJ6X/YoAAAAAAAEBK1gCAAAAAAAAIlEgYJ6mnFrFW+GrdRMMeIqTRRCDeDa5vF1dq2l7lJ6X/YoBFyBgnqacWsVb4at1Ewx4ipNFEIN4Nrm8XV2raXuUnpf9igABASt9AgAAAAAAACJRIGCeppxaxVvhq3UTDHiKk0UQg3g2ubxdXatpe5Sel/2KARcgYJ6mnFrFW+GrdRMMeIqTRRCDeDa5vF1dq2l7lJ6X/YoAAQErECcAAAAAAAAiUSBgnqacWsVb4at1Ewx4ipNFEIN4Nrm8XV2raXuUnpf9igEXIGCeppxaxVvhq3UTDHiKk0UQg3g2ubxdXatpe5Sel/2KAAAAAA==';

console.log('📦 Decodificando PSBT da transação atual...\n');

try {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    
    console.log('✅ PSBT decodificado com sucesso!\n');
    
    console.log('📊 Informações do PSBT:');
    console.log('  Inputs:', psbt.inputCount);
    console.log('  Outputs:', psbt.txOutputs.length);
    console.log('');
    
    console.log('📤 OUTPUTS:');
    psbt.txOutputs.forEach((output, i) => {
        console.log(`\n  Output ${i}:`);
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
                console.log(`    Rune Data (length): ${runeData.length} bytes`);
                
                // Decodificar LEB128
                console.log('\n    🔍 Decoding LEB128:');
                const values = [];
                let offset = 0;
                
                while (offset < runeData.length) {
                    let value = 0;
                    let shift = 0;
                    let byte;
                    
                    do {
                        if (offset >= runeData.length) break;
                        byte = runeData[offset++];
                        value |= (byte & 0x7f) << shift;
                        shift += 7;
                    } while (byte & 0x80);
                    
                    values.push(value);
                }
                
                console.log(`    Values: [${values.join(', ')}]`);
                
                // Interpretar edicts
                console.log('\n    📝 Edicts:');
                for (let i = 0; i < values.length; i += 4) {
                    if (i + 3 < values.length) {
                        console.log(`      Edict ${Math.floor(i/4) + 1}:`);
                        console.log(`        Rune ID: ${values[i]}:${values[i+1]}`);
                        console.log(`        Amount: ${values[i+2]}`);
                        console.log(`        Output: ${values[i+3]}`);
                    }
                }
            }
        } else if (output.script[0] === 0x51 && output.script[1] === 0x20) {
            console.log(`    Type: P2TR (Taproot)`);
            const pubkey = output.script.slice(2);
            console.log(`    Pubkey: ${pubkey.toString('hex')}`);
        } else {
            console.log(`    Type: Unknown`);
        }
    });
    
    // Verificar problemas
    console.log('\n\n🔍 DIAGNÓSTICO:');
    
    let hasIssues = false;
    
    // Verificar outputs com valor 0 que não sejam OP_RETURN
    psbt.txOutputs.forEach((output, i) => {
        if (output.value === 0 && output.script[0] !== 0x6a) {
            console.log(`  ❌ Output ${i}: Valor 0 mas NÃO é OP_RETURN!`);
            hasIssues = true;
        }
    });
    
    // Verificar outputs com valor < dust limit
    psbt.txOutputs.forEach((output, i) => {
        if (output.value > 0 && output.value < 546 && output.script[0] !== 0x6a) {
            console.log(`  ⚠️  Output ${i}: Valor ${output.value} abaixo do dust limit (546 sats)!`);
            hasIssues = true;
        }
    });
    
    // Verificar outputs duplicados
    const scriptHashes = {};
    psbt.txOutputs.forEach((output, i) => {
        const hash = output.script.toString('hex');
        if (scriptHashes[hash]) {
            console.log(`  ❌ Output ${i}: DUPLICADO com Output ${scriptHashes[hash]}!`);
            console.log(`     ScriptPubKey: ${hash}`);
            hasIssues = true;
        } else {
            scriptHashes[hash] = i;
        }
    });
    
    if (!hasIssues) {
        console.log('  ✅ Nenhum problema óbvio detectado nos outputs');
    }
    
    console.log('\n📝 ESTRUTURA DA TRANSAÇÃO:');
    console.log(`  ${psbt.inputCount} inputs → ${psbt.txOutputs.length} outputs`);
    
    const totalOut = psbt.txOutputs.reduce((sum, out) => sum + out.value, 0);
    console.log(`  Total output: ${totalOut} sats`);
    
} catch (error) {
    console.error('❌ Erro ao decodificar:', error.message);
    console.error(error.stack);
}




