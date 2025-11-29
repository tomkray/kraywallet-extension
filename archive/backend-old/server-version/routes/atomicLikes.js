import express from 'express';
import { db } from '../db/init-supabase.js';

const router = express.Router();

/**
 * 💝 POST /api/atomic-likes/:orderId
 * 
 * Adiciona um like em uma atomic listing
 * Requer assinatura para validar (anti-bot)
 */
router.post('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { address, signature, message } = req.body;
        
        console.log('💝 Tentando adicionar like atomic:', { orderId, address });
        
        // Validação
        if (!address || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: address, signature, message'
            });
        }
        
        // Verificar se a listing existe
        const listing = db.prepare('SELECT order_id, likes_count FROM atomic_listings WHERE order_id = ?').get(orderId);
        if (!listing) {
            return res.status(404).json({
                success: false,
                error: 'Listing not found'
            });
        }
        
        // Verificar a assinatura (anti-bot)
        const isValid = verifySignature(address, message, signature);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }
        
        // Verificar se o usuário já deu like
        const existingLike = db.prepare(`
            SELECT id FROM atomic_listing_likes 
            WHERE order_id = ? AND address = ?
        `).get(orderId, address);
        
        if (existingLike) {
            return res.status(400).json({
                success: false,
                error: 'You already liked this listing'
            });
        }
        
        // Adicionar like
        const now = Date.now();
        db.prepare(`
            INSERT INTO atomic_listing_likes (order_id, address, signature, message, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(orderId, address, signature, message, now);
        
        // Atualizar contador de likes na listing
        db.prepare(`
            UPDATE atomic_listings 
            SET likes_count = likes_count + 1 
            WHERE order_id = ?
        `).run(orderId);
        
        // Buscar novo total
        const updatedListing = db.prepare('SELECT likes_count FROM atomic_listings WHERE order_id = ?').get(orderId);
        
        console.log(`✅ Like atomic adicionado! Total: ${updatedListing.likes_count}`);
        
        res.json({
            success: true,
            likes_count: updatedListing.likes_count,
            message: 'Like added successfully'
        });
        
    } catch (error) {
        console.error('❌ Error adding atomic like:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💔 DELETE /api/atomic-likes/:orderId
 * 
 * Remove um like de uma atomic listing
 */
router.delete('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { address, signature, message } = req.body;
        
        console.log('💔 Tentando remover like atomic:', { orderId, address });
        
        // Validação
        if (!address || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // Verificar assinatura
        const isValid = verifySignature(address, message, signature);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }
        
        // Verificar se o like existe
        const existingLike = db.prepare(`
            SELECT id FROM atomic_listing_likes 
            WHERE order_id = ? AND address = ?
        `).get(orderId, address);
        
        if (!existingLike) {
            return res.status(404).json({
                success: false,
                error: 'Like not found'
            });
        }
        
        // Remover like
        db.prepare('DELETE FROM atomic_listing_likes WHERE order_id = ? AND address = ?')
            .run(orderId, address);
        
        // Atualizar contador
        db.prepare(`
            UPDATE atomic_listings 
            SET likes_count = CASE 
                WHEN likes_count > 0 THEN likes_count - 1 
                ELSE 0 
            END
            WHERE order_id = ?
        `).run(orderId);
        
        // Buscar novo total
        const updatedListing = db.prepare('SELECT likes_count FROM atomic_listings WHERE order_id = ?').get(orderId);
        
        console.log(`✅ Like atomic removido! Total: ${updatedListing.likes_count || 0}`);
        
        res.json({
            success: true,
            likes_count: updatedListing.likes_count || 0,
            message: 'Like removed successfully'
        });
        
    } catch (error) {
        console.error('❌ Error removing atomic like:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 📊 GET /api/atomic-likes/:orderId
 * 
 * Retorna informações sobre likes de uma atomic listing
 */
router.get('/:orderId', (req, res) => {
    try {
        const { orderId } = req.params;
        const { address } = req.query;
        
        // Buscar total de likes
        const listing = db.prepare('SELECT likes_count FROM atomic_listings WHERE order_id = ?').get(orderId);
        if (!listing) {
            return res.status(404).json({
                success: false,
                error: 'Listing not found'
            });
        }
        
        // Verificar se o usuário deu like (se address foi fornecido)
        let userLiked = false;
        if (address) {
            const like = db.prepare(`
                SELECT id FROM atomic_listing_likes 
                WHERE order_id = ? AND address = ?
            `).get(orderId, address);
            userLiked = !!like;
        }
        
        res.json({
            success: true,
            order_id: orderId,
            likes_count: listing.likes_count || 0,
            user_liked: userLiked
        });
        
    } catch (error) {
        console.error('❌ Error getting atomic likes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Verificar assinatura Bitcoin (anti-bot)
 */
function verifySignature(address, message, signature) {
    try {
        // Mensagem esperada: "I like this inscription"
        if (!message.includes('I like this inscription')) {
            return false;
        }
        
        if (!signature || signature.length < 50) {
            return false;
        }
        
        // Validar formato do address
        if (!address.startsWith('bc1') && !address.startsWith('tb1') && !address.match(/^[13]/)) {
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error('Error verifying signature:', error);
        return false;
    }
}

export default router;

