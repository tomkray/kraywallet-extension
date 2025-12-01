/**
 * 🪙 Rune Details via QuickNode
 */

import express from 'express';
import quicknode from '../utils/quicknode.js';

const router = express.Router();

// Cache
const runeCache = new Map();
const CACHE_TTL = 3600000; // 1 hora

/**
 * GET /api/rune/:runeId
 * Get complete rune details
 * runeId format: "840000:3" or rune name
 */
router.get('/:runeId', async (req, res) => {
    try {
        const { runeId } = req.params;
        
        console.log(`🪙 Fetching rune details: ${runeId}`);
        
        // Check cache
        const cached = runeCache.get(runeId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return res.json(cached.data);
        }
        
        // Buscar via QuickNode
        const runeData = await quicknode.getRune(runeId);
        
        const result = {
            success: true,
            runeId: runeId,
            name: runeData.entry.spaced_rune,
            symbol: runeData.entry.symbol || '⧈',
            divisibility: runeData.entry.divisibility || 0,
            supply: runeData.entry.premine + (runeData.entry.terms?.amount * runeData.entry.terms?.cap || 0),
            premine: runeData.entry.premine,
            burned: runeData.entry.burned,
            number: runeData.entry.number,
            block: runeData.entry.block,
            timestamp: runeData.entry.timestamp,
            etching: runeData.entry.etching,
            mintable: runeData.mintable,
            parent: runeData.parent,
            parentPreview: runeData.parent ? `http://localhost:4000/api/rune-thumbnail/${runeData.parent}` : null,
            thumbnail: runeData.parent ? `http://localhost:4000/api/rune-thumbnail/${runeData.parent}` : null
        };
        
        console.log(`   ✅ ${result.name} ${result.symbol} (divisibility: ${result.divisibility})`);
        
        // Save cache
        runeCache.set(runeId, {
            data: result,
            timestamp: Date.now()
        });
        
        res.json(result);
        
    } catch (error) {
        console.error(`❌ Error fetching rune ${req.params.runeId}:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;





