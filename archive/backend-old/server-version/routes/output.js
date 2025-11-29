/**
 * 🔍 Output Routes - Check UTXOs for inscriptions/runes via QuickNode
 */

import express from 'express';
import quicknode from '../utils/quicknode.js';

const router = express.Router();

// Cache para outputs (evitar rate limit)
const outputCache = new Map();
const CACHE_TTL = 300000; // 5 minutos

// Rate limiting
let requestQueue = [];
let processing = false;

async function processQueue() {
    if (processing || requestQueue.length === 0) return;
    
    processing = true;
    
    while (requestQueue.length > 0) {
        const { outpoint, resolve, reject } = requestQueue.shift();
        
        try {
            // Verificar cache
            const cached = outputCache.get(outpoint);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                resolve(cached.data);
                continue;
            }
            
            // Buscar do QuickNode
            const outputData = await quicknode.getOutput(outpoint);
            
            const result = {
                success: true,
                outpoint,
                inscriptions: outputData.inscriptions || [],
                runes: outputData.runes || {},
                sat_ranges: outputData.sat_ranges || [],
                script_pubkey: outputData.script_pubkey,
                value: outputData.value
            };
            
            // Salvar no cache
            outputCache.set(outpoint, {
                data: result,
                timestamp: Date.now()
            });
            
            resolve(result);
            
            // Delay REMOVIDO (desenvolvimento)
            // await new Promise(r => setTimeout(r, 100));
            
        } catch (error) {
            reject(error);
        }
    }
    
    processing = false;
}

/**
 * GET /api/output/:outpoint
 * Check if a UTXO has inscriptions or runes (com cache e rate limiting)
 */
router.get('/:outpoint', async (req, res) => {
    try {
        const { outpoint } = req.params;
        
        // Verificar cache primeiro
        const cached = outputCache.get(outpoint);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return res.json(cached.data);
        }
        
        // Adicionar à fila
        const result = await new Promise((resolve, reject) => {
            requestQueue.push({ outpoint, resolve, reject });
            processQueue();
            
            // Timeout de 30s
            setTimeout(() => reject(new Error('Request timeout')), 30000);
        });
        
        res.json(result);
        
    } catch (error) {
        console.error(`❌ Error checking output:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            inscriptions: [],
            runes: {}
        });
    }
});

export default router;

