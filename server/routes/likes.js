import express from 'express';
import { db } from '../db/init-supabase.js';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

const router = express.Router();

/**
 * 💝 POST /api/likes/:offerId
 * 
 * Adiciona um like em uma offer
 * Requer assinatura para validar (anti-bot)
 */
router.post('/:offerId', async (req, res) => {
    try {
        const { offerId } = req.params;
        const { address, signature, message } = req.body;
        
        console.log('💝 Tentando adicionar like:', { offerId, address });
        
        // Validação
        if (!address || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: address, signature, message'
            });
        }
        
        // Verificar se a offer existe
        const offer = db.prepare('SELECT id, likes_count FROM offers WHERE id = ?').get(offerId);
        if (!offer) {
            return res.status(404).json({
                success: false,
                error: 'Offer not found'
            });
        }
        
        // Verificar a assinatura (anti-bot)
        const isValid = await verifySignature(address, message, signature);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }
        
        // Verificar se o usuário já deu like
        const existingLike = db.prepare(`
            SELECT id FROM offer_likes 
            WHERE offer_id = ? AND address = ?
        `).get(offerId, address);
        
        if (existingLike) {
            return res.status(400).json({
                success: false,
                error: 'You already liked this offer'
            });
        }
        
        // Adicionar like
        const now = Date.now();
        db.prepare(`
            INSERT INTO offer_likes (offer_id, address, signature, message, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(offerId, address, signature, message, now);
        
        // Atualizar contador de likes na offer
        db.prepare(`
            UPDATE offers 
            SET likes_count = likes_count + 1 
            WHERE id = ?
        `).run(offerId);
        
        // Buscar novo total
        const updatedOffer = db.prepare('SELECT likes_count FROM offers WHERE id = ?').get(offerId);
        
        // 📊 Track analytics (like action)
        try {
            await fetch('http://localhost:4000/api/analytics/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: address,
                    action_type: 'like',
                    action_data: { offer_id: offerId },
                    offer_id: offerId
                })
            });
        } catch (analyticsError) {
            // Não bloquear se analytics falhar
            console.warn('⚠️  Analytics tracking failed:', analyticsError.message);
        }
        
        console.log(`✅ Like adicionado! Total: ${updatedOffer.likes_count}`);
        
        res.json({
            success: true,
            likes_count: updatedOffer.likes_count,
            message: 'Like added successfully'
        });
        
    } catch (error) {
        console.error('❌ Error adding like:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💔 DELETE /api/likes/:offerId
 * 
 * Remove um like de uma offer
 */
router.delete('/:offerId', async (req, res) => {
    try {
        const { offerId } = req.params;
        const { address, signature, message } = req.body;
        
        console.log('💔 Tentando remover like:', { offerId, address });
        
        // Validação
        if (!address || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // Verificar assinatura
        const isValid = await verifySignature(address, message, signature);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }
        
        // Verificar se o like existe
        const existingLike = db.prepare(`
            SELECT id FROM offer_likes 
            WHERE offer_id = ? AND address = ?
        `).get(offerId, address);
        
        if (!existingLike) {
            return res.status(404).json({
                success: false,
                error: 'Like not found'
            });
        }
        
        // Remover like
        db.prepare('DELETE FROM offer_likes WHERE offer_id = ? AND address = ?')
            .run(offerId, address);
        
        // Atualizar contador
        db.prepare(`
            UPDATE offers 
            SET likes_count = MAX(0, likes_count - 1) 
            WHERE id = ?
        `).run(offerId);
        
        // Buscar novo total
        const updatedOffer = db.prepare('SELECT likes_count FROM offers WHERE id = ?').get(offerId);
        
        console.log(`✅ Like removido! Total: ${updatedOffer.likes_count}`);
        
        res.json({
            success: true,
            likes_count: updatedOffer.likes_count,
            message: 'Like removed successfully'
        });
        
    } catch (error) {
        console.error('❌ Error removing like:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 📊 GET /api/likes/:offerId
 * 
 * Retorna informações sobre likes de uma offer
 */
router.get('/:offerId', (req, res) => {
    try {
        const { offerId } = req.params;
        const { address } = req.query;
        
        // Buscar total de likes
        const offer = db.prepare('SELECT likes_count FROM offers WHERE id = ?').get(offerId);
        if (!offer) {
            return res.status(404).json({
                success: false,
                error: 'Offer not found'
            });
        }
        
        // Verificar se o usuário deu like (se address foi fornecido)
        let userLiked = false;
        if (address) {
            const like = db.prepare(`
                SELECT id FROM offer_likes 
                WHERE offer_id = ? AND address = ?
            `).get(offerId, address);
            userLiked = !!like;
        }
        
        res.json({
            success: true,
            offer_id: offerId,
            likes_count: offer.likes_count || 0,
            user_liked: userLiked
        });
        
    } catch (error) {
        console.error('❌ Error getting likes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Verificar assinatura Bitcoin (anti-bot)
 */
async function verifySignature(address, message, signature) {
    try {
        // Mensagem esperada: "I like this offer: {timestamp}"
        // Isso garante que cada like tem uma mensagem única
        
        // Aqui vamos implementar verificação básica
        // Em produção, usar bitcoinjs-message ou similar
        
        // Por enquanto, validação simples:
        // - Message deve conter "I like this offer"
        // - Signature deve ter tamanho válido
        // - Address deve ser válido
        
        if (!message.includes('I like this offer')) {
            return false;
        }
        
        if (!signature || signature.length < 50) {
            return false;
        }
        
        // Validar formato do address
        if (!address.startsWith('bc1') && !address.startsWith('tb1') && !address.match(/^[13]/)) {
            return false;
        }
        
        // TODO: Implementar verificação real de assinatura Bitcoin
        // usando bitcoinjs-message ou similar
        
        return true;
        
    } catch (error) {
        console.error('Error verifying signature:', error);
        return false;
    }
}

export default router;

