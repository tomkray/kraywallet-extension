// Comparar nosso Runestone com o de sucesso

// Nossa TX (ainda falha)
const ourOpReturn = '6a5d0a00c0a2330300010000e80702';

// Success TX (funciona)
const successOpReturn = '6a5d0a00c0a2330380c2d72f02';

console.log('🔬 ANÁLISE DOS RUNESTONES\n');

console.log('Nossa TX:');
console.log('  Hex:', ourOpReturn);
console.log('  Length:', ourOpReturn.length / 2, 'bytes');

console.log('\nSuccess TX:');
console.log('  Hex:', successOpReturn);
console.log('  Length:', successOpReturn.length / 2, 'bytes');

console.log('\n\n📊 BYTE-A-BYTE:');
console.log('Nossa:    6a 5d 0a 00 c0a23303 00 01 00 00 e807 02');
console.log('Success:  6a 5d 0a 00 c0a23303 80c2d72f 02');

console.log('\n\n🔍 DECODIFICAÇÃO LEB128:');

function decodeLeb128(hex) {
    const bytes = Buffer.from(hex, 'hex');
    const values = [];
    let i = 0;
    
    while (i < bytes.length) {
        let value = 0;
        let shift = 0;
        
        while (i < bytes.length) {
            const byte = bytes[i++];
            value |= (byte & 0x7f) << shift;
            
            if ((byte & 0x80) === 0) {
                break;
            }
            shift += 7;
        }
        
        values.push(value);
    }
    
    return values;
}

const ourData = ourOpReturn.substring(4); // Remove 6a5d
const successData = successOpReturn.substring(4);

console.log('\nNossa TX (sem 6a5d):');
console.log('  Data:', ourData);
const ourValues = decodeLeb128(ourData);
console.log('  Decoded:', ourValues);
console.log('  Interpretation:');
console.log('    [0]  10 = Tag (Body)');
console.log('    [1]  0 = Delimiter');
console.log('    [2]  840000 = blockHeight (edict 1)');
console.log('    [3]  3 = txIndex (edict 1)');
console.log('    [4]  0 = amount (edict 1) ← CHANGE AMOUNT');
console.log('    [5]  1 = output (edict 1) ← CHANGE OUTPUT');
console.log('    [6]  0 = blockDelta (edict 2)');
console.log('    [7]  0 = txDelta (edict 2)');
console.log('    [8]  1000 = amount (edict 2) ← SEND AMOUNT');
console.log('    [9]  2 = output (edict 2) ← SEND OUTPUT');

console.log('\nSuccess TX (sem 6a5d):');
console.log('  Data:', successData);
const successValues = decodeLeb128(successData);
console.log('  Decoded:', successValues);
console.log('  Interpretation:');
console.log('    [0]  10 = Tag (Body)');
console.log('    [1]  0 = Delimiter');
console.log('    [2]  840000 = blockHeight');
console.log('    [3]  3 = txIndex');
console.log('    [4]  100000000 = amount ← GRANDE QUANTIDADE!');
console.log('    [5]  2 = output');

console.log('\n\n💡 DESCOBERTA:');
console.log('  ❌ Nossa TX: 2 edicts (change + send)');
console.log('  ✅ Success TX: 1 edict (send only)');
console.log('  ');
console.log('  O PROBLEMA: Estamos criando 2 edicts quando deveria ser 1!');
console.log('  ');
console.log('  SOLUÇÃO: Enviar TODA a quantidade em 1 edict para o destinatário');
console.log('           e deixar o protocolo criar o change automaticamente!');

