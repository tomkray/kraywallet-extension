/**
 * 🌟 Sat Rarity Detection (Browser Version)
 * Based on Casey Rodarmor's Ordinal Theory
 */

const SatRarity = (function() {
    // Bitcoin constants
    const SATS_PER_BLOCK_INITIAL = 5000000000n;
    const BLOCKS_PER_HALVING = 210000n;
    const BLOCKS_PER_DIFFICULTY_ADJUSTMENT = 2016n;
    const BLOCKS_PER_CYCLE = BLOCKS_PER_HALVING * 6n;

    // Epic sats (first sat of each halving)
    const EPIC_SATS = [
        0n,
        1050000000000000n,
        1575000000000000n,
        1837500000000000n,
        1968750000000000n,
    ];

    const MYTHIC_SAT = 0n;
    const VINTAGE_END = 50000000000n;
    const NAKAMOTO_END = 1000000000000n;
    const BLOCK_9_START = 450000000n;
    const BLOCK_9_END = 500000000n;
    
    // Pizza Sats - Block 57043 (May 22, 2010 - 10,000 BTC for 2 pizzas)
    // First sat of block 57043: 57043 * 5,000,000,000 = 285,215,000,000,000
    const PIZZA_START = 285215000000000n;
    const PIZZA_END = 285220000000000n;  // 50 BTC block reward

    function getBlockFromSat(satNumber) {
        const sat = BigInt(satNumber);
        let totalSats = 0n;
        let block = 0n;
        let reward = SATS_PER_BLOCK_INITIAL;
        
        for (let epoch = 0; epoch < 64; epoch++) {
            const blocksInEpoch = BLOCKS_PER_HALVING;
            const satsInEpoch = blocksInEpoch * reward;
            
            if (totalSats + satsInEpoch > sat) {
                const satsIntoEpoch = sat - totalSats;
                const blocksIntoEpoch = satsIntoEpoch / reward;
                return block + blocksIntoEpoch;
            }
            
            totalSats += satsInEpoch;
            block += blocksInEpoch;
            reward = reward / 2n;
            
            if (reward === 0n) break;
        }
        
        return block;
    }

    function isFirstSatInBlock(satNumber) {
        const sat = BigInt(satNumber);
        let totalSats = 0n;
        let reward = SATS_PER_BLOCK_INITIAL;
        
        for (let epoch = 0; epoch < 64; epoch++) {
            const blocksInEpoch = BLOCKS_PER_HALVING;
            const satsInEpoch = blocksInEpoch * reward;
            
            if (totalSats + satsInEpoch > sat) {
                const satsIntoEpoch = sat - totalSats;
                return satsIntoEpoch % reward === 0n;
            }
            
            totalSats += satsInEpoch;
            reward = reward / 2n;
            
            if (reward === 0n) break;
        }
        
        return false;
    }

    function detect(satNumber) {
        if (!satNumber && satNumber !== 0) return null;
        
        const sat = BigInt(satNumber);
        const block = getBlockFromSat(sat);
        const isFirstInBlock = isFirstSatInBlock(sat);
        
        const rarities = [];
        let primaryRarity = 'common';
        let emoji = '';
        let color = '#888888';
        
        // Mythic
        if (sat === MYTHIC_SAT) {
            rarities.push({ name: 'Mythic', emoji: '🌌', color: '#ff00ff', tier: 6 });
            primaryRarity = 'mythic';
            emoji = '🌌';
            color = '#ff00ff';
        }
        
        // Legendary
        if (block > 0n && block % BLOCKS_PER_CYCLE === 0n && isFirstInBlock) {
            rarities.push({ name: 'Legendary', emoji: '🏆', color: '#ffd700', tier: 5 });
            if (primaryRarity === 'common') {
                primaryRarity = 'legendary';
                emoji = '🏆';
                color = '#ffd700';
            }
        }
        
        // Epic
        if (EPIC_SATS.includes(sat) && sat !== MYTHIC_SAT) {
            rarities.push({ name: 'Epic', emoji: '🔮', color: '#9333ea', tier: 4 });
            if (primaryRarity === 'common') {
                primaryRarity = 'epic';
                emoji = '🔮';
                color = '#9333ea';
            }
        }
        
        // Rare
        if (block > 0n && block % BLOCKS_PER_DIFFICULTY_ADJUSTMENT === 0n && isFirstInBlock && !EPIC_SATS.includes(sat)) {
            rarities.push({ name: 'Rare', emoji: '🔹', color: '#3b82f6', tier: 3 });
            if (primaryRarity === 'common') {
                primaryRarity = 'rare';
                emoji = '🔹';
                color = '#3b82f6';
            }
        }
        
        // Uncommon
        if (isFirstInBlock && primaryRarity === 'common') {
            rarities.push({ name: 'Uncommon', emoji: '💎', color: '#ec4899', tier: 2 });
            primaryRarity = 'uncommon';
            emoji = '💎';
            color = '#ec4899';
        }
        
        // Palindrome
        const satStr = sat.toString();
        if (satStr === satStr.split('').reverse().join('')) {
            rarities.push({ name: 'Palindrome', emoji: '🦋', color: '#ec4899', tier: 1 });
        }
        
        // Vintage
        if (sat < VINTAGE_END) {
            rarities.push({ name: 'Vintage', emoji: '🏛️', color: '#a855f7', tier: 1 });
        }
        
        // Block 9
        if (sat >= BLOCK_9_START && sat < BLOCK_9_END) {
            rarities.push({ name: 'Block 9', emoji: '9️⃣', color: '#f59e0b', tier: 2 });
        }
        
        // Nakamoto
        if (sat < NAKAMOTO_END) {
            rarities.push({ name: 'Nakamoto', emoji: '👤', color: '#f97316', tier: 2 });
        }
        
        // Pizza Sats - Block 57043 (Bitcoin Pizza Day - May 22, 2010)
        if (sat >= PIZZA_START && sat < PIZZA_END) {
            rarities.push({ name: 'Pizza', emoji: '🍕', color: '#f59e0b', tier: 3 });
            if (primaryRarity === 'common') {
                primaryRarity = 'pizza';
                emoji = '🍕';
                color = '#f59e0b';
            }
        }
        
        rarities.sort((a, b) => b.tier - a.tier);
        
        return {
            satNumber: sat.toString(),
            primaryRarity,
            primaryEmoji: emoji || (rarities[0]?.emoji || ''),
            primaryColor: color || (rarities[0]?.color || '#888888'),
            rarities,
            isRare: rarities.length > 0,
            description: rarities.length > 0 
                ? rarities.map(r => `${r.emoji} ${r.name}`).join(' • ')
                : 'Common sat'
        };
    }

    function getBadgeHtml(satNumber, compact = false) {
        const rarity = detect(satNumber);
        if (!rarity || !rarity.isRare) return '';
        
        if (compact) {
            // Just show primary emoji for compact mode
            return `<span class="sat-rarity-compact" title="${rarity.description}" style="cursor: help;">${rarity.primaryEmoji}</span>`;
        }
        
        return rarity.rarities.map(r => 
            `<span class="sat-rarity-badge" style="background: ${r.color}20; color: ${r.color}; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: 600; border: 1px solid ${r.color}40; white-space: nowrap;">${r.emoji} ${r.name}</span>`
        ).join(' ');
    }

    function getCompactBadge(satNumber) {
        const rarity = detect(satNumber);
        if (!rarity || !rarity.isRare) return '';
        return rarity.primaryEmoji;
    }

    return {
        detect,
        getBadgeHtml,
        getCompactBadge
    };
})();

// Export for Node.js if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SatRarity;
}
