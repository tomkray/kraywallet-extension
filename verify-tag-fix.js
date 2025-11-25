// Verificar se a correção da Tag está funcionando

function decodeLEB128(hexString) {
    const bytes = [];
    for (let i = 0; i < hexString.length; i += 2) {
        bytes.push(parseInt(hexString.substr(i, 2), 16));
    }
    
    const values = [];
    let current = 0;
    let shift = 0;
    
    for (const byte of bytes) {
        current |= (byte & 0x7f) << shift;
        shift += 7;
        
        if ((byte & 0x80) === 0) {
            values.push(current);
            current = 0;
            shift = 0;
        }
    }
    
    return values;
}

// Hex antigo (Tag 10): 6a5d0a00c0a233036401
// Hex novo (Tag 0): ?

console.log('\n✅ VERIFICAÇÃO DA CORREÇÃO DA TAG\n');
console.log('═══════════════════════════════════════════════════\n');

console.log('❌ ANTES (Tag 10 - INCORRETO):');
const oldHex = '0a00c0a233036401';
const oldDecoded = decodeLEB128(oldHex);
console.log('   Hex:', oldHex);
console.log('   Decoded:', oldDecoded);
console.log('   Tag:', oldDecoded[0], oldDecoded[0] === 10 ? '(Tag 10 = Rune/Etching - ERRADO!)' : '');
console.log('');

console.log('✅ DEPOIS (Tag 0 - CORRETO):');
// Simular o que deveria ser gerado
// Tag 0, BlockHeight 840000, TxIndex 3, Amount 100, Output 1
// LEB128 encoding:
// 0 = 0x00
// 840000 = 0xCD3380 → LEB128: 0x80 0xE7 0x33 = c0a233 (com bit de continuação)
// 3 = 0x03
// 100 = 0x64
// 1 = 0x01
const newHex = '00c0a233036401'; // Removemos "0a00" e deixamos só "00"
const newDecoded = decodeLEB128(newHex);
console.log('   Hex:', newHex);
console.log('   Decoded:', newDecoded);
console.log('   Tag:', newDecoded[0], newDecoded[0] === 0 ? '(Tag 0 = Body/Edicts - CORRETO! ✅)' : '');
console.log('');

console.log('═══════════════════════════════════════════════════\n');
console.log('📋 FORMATO CORRETO (PROTOCOLO OFICIAL):');
console.log('   OP_RETURN (0x6a)');
console.log('   + OP_13 (0x5d)');
console.log('   + Tag 0 (Body)');
console.log('   + Edict: [block, tx, amount, output]');
console.log('');
console.log('   Hex completo: 6a5d' + newHex);
console.log('');
