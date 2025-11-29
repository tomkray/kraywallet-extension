/**
 * 🖼️ Rune Thumbnail Proxy
 * Serve parent inscription content via QuickNode
 */

import express from 'express';
import quicknode from '../utils/quicknode.js';

const router = express.Router();

// Cache de thumbnails
const thumbnailCache = new Map();
const CACHE_TTL = 3600000; // 1 hora

/**
 * GET /api/rune-thumbnail/:inscriptionId
 * Serve o conteúdo da inscription (parent) como imagem
 */
router.get('/:inscriptionId', async (req, res) => {
    try {
        const { inscriptionId } = req.params;
        
        console.log(`🖼️  Serving thumbnail for inscription: ${inscriptionId}`);
        
        // Check cache
        const cached = thumbnailCache.get(inscriptionId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            res.set('Content-Type', cached.contentType);
            res.set('Cache-Control', 'public, max-age=3600');
            return res.send(cached.data);
        }
        
        // Tentar buscar via QuickNode primeiro
        console.log('   📡 Trying QuickNode ord_getContent...');
        let contentBuffer = null;
        let contentType = 'image/png';
        
        try {
            const contentHex = await quicknode.call('ord_getContent', [inscriptionId]);
            
            if (contentHex && typeof contentHex === 'string' && contentHex.length > 0) {
                contentBuffer = Buffer.from(contentHex, 'hex');
                console.log(`   ✅ QuickNode content: ${contentBuffer.length} bytes`);
            } else {
                throw new Error('QuickNode returned empty content');
            }
        } catch (qnError) {
            console.log(`   ⚠️  QuickNode failed: ${qnError.message}`);
            console.log('   📡 Fallback: Fetching from ordinals.com...');
            
            // Fallback: buscar de ordinals.com
            const axios = (await import('axios')).default;
            const response = await axios.get(`https://ordinals.com/content/${inscriptionId}`, {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            
            contentBuffer = Buffer.from(response.data);
            contentType = response.headers['content-type'] || 'image/png';
            
            console.log(`   ✅ Ordinals.com content: ${contentBuffer.length} bytes (${contentType})`);
        }
        
        // Detectar content type pelos magic bytes se não tiver
        if (!contentType || contentType === 'application/octet-stream') {
            const magic = contentBuffer.slice(0, 4).toString('hex');
            if (magic.startsWith('89504e47')) contentType = 'image/png';
            else if (magic.startsWith('ffd8')) contentType = 'image/jpeg';
            else if (contentBuffer.slice(0, 4).toString() === 'RIFF') contentType = 'image/webp';
            else if (magic.startsWith('47494638')) contentType = 'image/gif';
        }
        
        console.log(`   ✅ Content ready (${contentBuffer.length} bytes, ${contentType})`);
        
        // Save to cache
        thumbnailCache.set(inscriptionId, {
            data: contentBuffer,
            contentType,
            timestamp: Date.now()
        });
        
        // Serve image
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('Access-Control-Allow-Origin', '*'); // Permitir CORS
        res.send(contentBuffer);
        
    } catch (error) {
        console.error(`❌ Error serving thumbnail:`, error.message);
        
        // Retornar placeholder SVG
        const placeholderSvg = `
            <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="200" fill="#1a1a1a"/>
                <text x="100" y="100" text-anchor="middle" dominant-baseline="middle" 
                      font-size="64" fill="#666">⧈</text>
            </svg>
        `;
        
        res.set('Content-Type', 'image/svg+xml');
        res.send(placeholderSvg);
    }
});

export default router;

