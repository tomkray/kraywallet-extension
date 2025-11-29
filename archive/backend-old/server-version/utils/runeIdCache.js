/**
 * 🪙 Cache de Rune IDs
 * Mapeia nome da rune para ID (blockHeight:txIndex)
 */

import quicknode from './quicknode.js';

// Cache global
let runeIdMap = null;
let lastUpdate = 0;
const CACHE_TTL = 3600000; // 1 hora

/**
 * Buscar ID de uma rune pelo nome
 */
export async function getRuneId(runeName) {
    // Verificar cache
    if (!runeIdMap || Date.now() - lastUpdate > CACHE_TTL) {
        await buildRuneIdMap();
    }
    
    return runeIdMap[runeName] || null;
}

/**
 * Construir mapa de Nome → ID de todas as runes
 */
async function buildRuneIdMap() {
    try {
        console.log('📡 Building rune ID map DYNAMICALLY from QuickNode...');
        
        // Iniciar com mapa vazio
        runeIdMap = {};
        
        // MÉTODO 1: Usar cache de runes conhecidas (rápido)
        const knownRunes = {
            'BILLION•DOLLAR•CAT': '845764:84',
            'DOG•GO•TO•THE•MOON': '840000:3',
            'MOONVEMBER•TRUMP': '867415:2014',
            'THE•WOJAK•RUNE': '866114:2737',  // https://ordinals.com/rune/THE%E2%80%A2WOJAK%E2%80%A2RUNE
            'PUPS•WORLD•PEACE': '840002:126',
            'MAGIC•INTERNET•MONEY': '841533:21',
            'SATOSHI•NAKAMOTO': '840004:120',
            'GIZMO•IMAGINARY•KITTEN': '844915:110',
            'BAMK•OF•NAKAMOTO•DOLLAR': '840005:2',
        };
        
        runeIdMap = { ...knownRunes };
        
        // MÉTODO 2: Buscar dinamicamente se a rune não estiver no cache
        // Será feito sob demanda em getRuneWithParent()
        
        lastUpdate = Date.now();
        
        console.log(`   ✅ Rune ID map ready (${Object.keys(runeIdMap).length} cached, will fetch others dynamically)`);
        
        
    } catch (error) {
        console.error('Error building rune ID map:', error.message);
    }
}

/**
 * Get rune details with parent
 */
export async function getRuneWithParent(runeName) {
    try {
        let runeId = await getRuneId(runeName);
        
        // Se não está no cache, buscar DINAMICAMENTE via ordinals.com
        if (!runeId) {
            console.log(`   ⚠️  ${runeName} not in cache, fetching dynamically from ordinals.com...`);
            
            try {
                const axios = (await import('axios')).default;
                const encodedName = encodeURIComponent(runeName);
                const url = `https://ordinals.com/rune/${encodedName}`;
                
                console.log(`      🔗 URL: ${url}`);
                
                const response = await axios.get(url, { 
                    timeout: 20000,
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml'
                    }
                });
                
                // Extrair ID e parent do HTML (padrão do ordinals.com)
                const html = response.data;
                
                // Pattern para ID: <dt>id</dt><dd>866114:2737</dd>
                const idMatch = html.match(/<dt>id<\/dt>\s*<dd[^>]*>(\d+:\d+)<\/dd>/i);
                
                if (idMatch) {
                    runeId = idMatch[1];
                    console.log(`      ✅ Found ID: ${runeId}`);
                    
                    // Adicionar ao cache permanentemente
                    if (!runeIdMap) runeIdMap = {};
                    runeIdMap[runeName] = runeId;
                    
                    console.log(`      ✅ Added to cache for future use`);
                } else {
                    console.log(`      ⚠️  ID not found in ordinals.com response`);
                }
            } catch (e) {
                console.log(`      ⚠️  Could not fetch from ordinals.com: ${e.message}`);
            }
        }
        
        if (!runeId) {
            console.log(`   ⚠️  Could not find ID for ${runeName}, using emoji fallback`);
            return {
                name: runeName,
                parent: null,
                thumbnail: null
            };
        }
        
        // Buscar detalhes com parent
        const details = await quicknode.getRune(runeId);
        
        return {
            name: details.entry.spaced_rune,
            symbol: details.entry.symbol,
            divisibility: details.entry.divisibility,
            parent: details.parent,
            thumbnail: details.parent ? `http://localhost:4000/api/rune-thumbnail/${details.parent}` : null,
            runeId
        };
        
    } catch (error) {
        console.error(`Error getting rune ${runeName}:`, error.message);
        return {
            name: runeName,
            parent: null,
            thumbnail: null
        };
    }
}

export default { getRuneId, getRuneWithParent };

