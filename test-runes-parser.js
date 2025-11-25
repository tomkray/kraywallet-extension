import axios from 'axios';

const ORD_SERVER_URL = 'http://localhost:80';
const address = 'bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx';

console.log(`🔍 Fetching from: ${ORD_SERVER_URL}/address/${address}`);
console.log('');

try {
    const response = await axios.get(`${ORD_SERVER_URL}/address/${address}`, { timeout: 30000 });
    const html = response.data;
    
    console.log(`✅ HTML received (${html.length} chars)`);
    console.log('');
    
    // Procurar "rune balances" (case-insensitive)
    const runesBalanceMatch = html.match(/rune balances\s*(.*?)(?=outputs|inscriptions|$)/is);
    
    if (runesBalanceMatch) {
        console.log('✅ Found "rune balances" section!');
        console.log('📋 Content:', runesBalanceMatch[1].substring(0, 200));
        console.log('');
        
        // Tentar extrair runes
        const runesSection = runesBalanceMatch[1];
        const runePattern = /([A-Z•]+):\s*([\d,]+)([^\n]*)/gi;
        
        let match;
        let foundRunes = 0;
        while ((match = runePattern.exec(runesSection)) !== null) {
            foundRunes++;
            console.log(`  ✅ Rune ${foundRunes}:`);
            console.log(`     Name: ${match[1].trim()}`);
            console.log(`     Amount: ${match[2].replace(/,/g, '')}`);
            console.log(`     Extra: ${match[3].trim()}`);
            console.log('');
        }
        
        if (foundRunes === 0) {
            console.log('⚠️  Regex não encontrou runes!');
            console.log('📋 Seção completa:', runesSection);
        }
    } else {
        console.log('❌ "rune balances" section NOT found!');
        console.log('');
        console.log('📋 HTML preview (first 500 chars):');
        console.log(html.substring(0, 500));
    }
} catch (error) {
    console.error('❌ Error:', error.message);
}

