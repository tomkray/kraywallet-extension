#!/usr/bin/env node

/**
 * Decodificar Runestone para verificar conformidade
 */

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

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  🔍 DECODIFICANDO RUNESTONE DO NOSSO TESTE                     ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Nosso hex (dos logs): 6a5d0a00c0a233036401
const ourHex = '6a5d0a00c0a233036401';

console.log('🔍 Hex completo:', ourHex);
console.log('   - 6a     = OP_RETURN');
console.log('   - 5d     = OP_13 (protocol identifier)');
console.log('   - Resto  = Data (LEB128)\n');

const dataHex = ourHex.substring(4); // Remove 6a5d
console.log('📊 Data (LEB128):', dataHex);

const decoded = decodeLEB128(dataHex);
console.log('📋 Decoded values:', decoded);
console.log('\n');

// Interpretar valores
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 INTERPRETAÇÃO:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (decoded.length >= 1) {
    console.log(`   [0] = ${decoded[0]} ${decoded[0] === 0 ? '✅ (Tag 0 = Body/Edicts)' : decoded[0] === 10 ? '⚠️  (Tag 10 = Rune/Etching?)' : '❓'}`);
}
if (decoded.length >= 2) {
    console.log(`   [1] = ${decoded[1]} ${decoded[1] === 0 ? '(Delimiter ou Block?)' : '(Block height?)'}`);
}
if (decoded.length >= 3) {
    console.log(`   [2] = ${decoded[2]} (Block height: ${decoded[2]})`);
}
if (decoded.length >= 4) {
    console.log(`   [3] = ${decoded[3]} (TX index: ${decoded[3]})`);
}
if (decoded.length >= 5) {
    console.log(`   [4] = ${decoded[4]} (Amount: ${decoded[4]})`);
}
if (decoded.length >= 6) {
    console.log(`   [5] = ${decoded[5]} (Output index: ${decoded[5]})`);
}

console.log('\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📚 PROTOCOLO OFICIAL:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('✅ FORMATO CORRETO para Transfer (Edicts):');
console.log('   Tag 0 (Body)');
console.log('   + Edict: [block_height, tx_index, amount, output_index]\n');

console.log('❌ FORMATO INCORRETO:');
console.log('   Tag 10 (Rune name - usado apenas para ETCHING)\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 ANÁLISE DO NOSSO RUNESTONE:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (decoded[0] === 10) {
    console.log('⚠️  ATENÇÃO: Estamos usando Tag 10!');
    console.log('   Tag 10 = Rune name (usado para ETCHING, não transfer)');
    console.log('   Deveria ser Tag 0 = Body (para Edicts/transfers)\n');
    
    console.log('🤔 MAS... pode funcionar se:');
    console.log('   • O protocolo aceita Tag 10 com delimiter 0');
    console.log('   • O parser interpreta corretamente');
    console.log('   • A transação é válida mesmo assim\n');
    
    console.log('✅ SOLUÇÃO RECOMENDADA:');
    console.log('   Mudar para Tag 0 para estar 100% conforme spec oficial\n');
} else if (decoded[0] === 0) {
    console.log('✅ CORRETO: Tag 0 (Body/Edicts)');
    console.log('   Formato oficial do protocolo Runes!\n');
} else {
    console.log(`❓ Tag ${decoded[0]} - não reconhecida\n`);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Verificar se funciona na prática
console.log('🧪 TESTE PRÁTICO:');
console.log('   Se a transação foi aceita pela rede → Funciona!');
console.log('   Se foi rejeitada → Precisa corrigir\n');

console.log('📝 RECOMENDAÇÃO:');
console.log('   1. Testar envio real de Runes');
console.log('   2. Verificar se transação é aceita');
console.log('   3. Se funcionar: manter (mas documentar)');
console.log('   4. Se falhar: corrigir para Tag 0\n');

console.log('╚════════════════════════════════════════════════════════════════╝\n');

