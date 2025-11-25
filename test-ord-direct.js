/**
 * Teste direto do ORD server para verificar runes
 */

import axios from 'axios';

const ADDRESS = 'bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx';
const ORD_SERVER_URL = 'http://localhost:80';

console.log('╔═══════════════════════════════════════════════════════════════════════╗');
console.log('║         🧪 TESTE DIRETO DO ORD SERVER                                 ║');
console.log('╚═══════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`📍 Endereço: ${ADDRESS}`);
console.log(`🌐 ORD Server: ${ORD_SERVER_URL}`);
console.log('');

async function testOrdServer() {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('1️⃣  Buscando dados do ORD server...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const response = await axios.get(
            `${ORD_SERVER_URL}/address/${ADDRESS}`,
            { timeout: 30000 }
        );

        console.log(`✅ Resposta recebida (${response.data.length} chars)`);
        console.log('');

        const html = response.data;

        // Procurar seção de Runes Balances
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('2️⃣  Procurando seção "Runes Balances"...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const runesBalanceMatch = html.match(/<h2[^>]*>Runes Balances<\/h2>(.*?)(?=<h2|$)/is);
        
        if (runesBalanceMatch) {
            console.log('✅ Seção "Runes Balances" encontrada!');
            console.log('');
            
            const runesSection = runesBalanceMatch[1];
            console.log('📋 Conteúdo da seção (primeiros 500 chars):');
            console.log(runesSection.substring(0, 500));
            console.log('');

            // Parse runes
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('3️⃣  Parseando runes...');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            const runePattern = /<dt>\s*<a\s+href="\/rune\/([^"]+)">([^<]+)<\/a>\s*<\/dt>\s*<dd>\s*([\d,]+)\s*<\/dd>/gi;
            
            let match;
            let runeCount = 0;
            
            while ((match = runePattern.exec(runesSection)) !== null) {
                const encodedName = match[1];
                const displayName = match[2];
                const amount = match[3];
                const runeName = decodeURIComponent(encodedName);
                
                runeCount++;
                console.log(`✅ Rune #${runeCount}:`);
                console.log(`   Nome: ${displayName}`);
                console.log(`   Nome codificado: ${encodedName}`);
                console.log(`   Nome decodificado: ${runeName}`);
                console.log(`   Amount: ${amount}`);
                console.log('');
            }

            if (runeCount === 0) {
                console.log('⚠️  Nenhuma rune encontrada no parse');
                console.log('');
                console.log('📋 Dump completo da seção:');
                console.log(runesSection);
            } else {
                console.log(`✅ Total de runes encontradas: ${runeCount}`);
            }

        } else {
            console.log('❌ Seção "Runes Balances" NÃO encontrada!');
            console.log('');
            console.log('📋 Procurando por "Runes" ou "runes" no HTML...');
            
            const runesMatches = html.match(/runes/gi);
            if (runesMatches) {
                console.log(`✅ Encontrado "${runesMatches.length}" ocorrências de "runes"`);
            } else {
                console.log('❌ Palavra "runes" não encontrada no HTML');
            }
            
            // Mostrar os primeiros 2000 chars do HTML
            console.log('');
            console.log('📋 Primeiros 2000 chars do HTML:');
            console.log(html.substring(0, 2000));
        }

        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ TESTE COMPLETO!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } catch (error) {
        console.error('');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ ERRO!');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('Erro:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testOrdServer();

