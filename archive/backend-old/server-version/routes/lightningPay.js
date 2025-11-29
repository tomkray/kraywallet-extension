/**
 * ⚡ LIGHTNING PAYMENT API
 * 
 * Endpoint para pagar invoices Lightning via LND
 */

import express from 'express';
import lndClient from '../lightning/lndClient.js';

const router = express.Router();

/**
 * POST /api/lightning/pay
 * Pagar invoice Lightning
 */
router.post('/pay', async (req, res) => {
    console.log('\n⚡ ===== LIGHTNING PAYMENT REQUEST =====');
    
    try {
        const { invoice } = req.body;
        
        if (!invoice) {
            return res.status(400).json({
                success: false,
                error: 'Invoice is required'
            });
        }
        
        console.log('  Invoice:', invoice.substring(0, 50) + '...');
        
        // Decode invoice (usando bolt11 library ou LND)
        let decoded;
        try {
            // Tentar decodificar localmente primeiro
            const bolt11 = await import('bolt11');
            decoded = bolt11.decode(invoice);
            console.log('✅ Invoice decoded:');
            console.log('   Amount:', decoded.satoshis || decoded.millisatoshis / 1000, 'sats');
            console.log('   Payment Hash:', decoded.tagsObject?.payment_hash);
            console.log('   Description:', decoded.tagsObject?.description || decoded.tagsObject?.purpose);
        } catch (decodeError) {
            console.warn('⚠️  bolt11 decode failed, will try via LND:', decodeError.message);
            // Se falhar, continuar e deixar LND decodificar
        }
        
        // Pagar via LND
        console.log('💰 Sending payment via LND...');
        
        const paymentResponse = await lndClient.sendPaymentSync({
            payment_request: invoice,
            timeout_seconds: 60,
            allow_self_payment: true  // Permitir self-payment para testes
        });
        
        console.log('  LND Response:', {
            payment_error: paymentResponse.payment_error,
            payment_preimage: paymentResponse.payment_preimage?.toString('hex')?.substring(0, 16) + '...',
            payment_hash: paymentResponse.payment_hash?.toString('hex')?.substring(0, 16) + '...'
        });
        
        // Verificar se pagamento foi bem-sucedido
        if (paymentResponse.payment_error) {
            console.error('❌ Payment failed:', paymentResponse.payment_error);
            return res.status(400).json({
                success: false,
                error: paymentResponse.payment_error
            });
        }
        
        if (!paymentResponse.payment_preimage) {
            console.error('❌ Payment failed: No preimage returned');
            return res.status(400).json({
                success: false,
                error: 'Payment failed: No preimage returned'
            });
        }
        
        // Extrair dados do pagamento
        const preimage = paymentResponse.payment_preimage.toString('hex');
        const paymentHash = paymentResponse.payment_hash.toString('hex');
        const amountSats = decoded?.satoshis || 
                          decoded?.millisatoshis / 1000 || 
                          paymentResponse.payment_route?.total_amt || 
                          0;
        
        console.log('✅ Payment successful!');
        console.log('   Preimage:', preimage);
        console.log('   Payment Hash:', paymentHash);
        console.log('   Amount:', amountSats, 'sats');
        
        res.json({
            success: true,
            preimage,
            paymentHash,
            amountSats,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('❌ Error processing Lightning payment:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process Lightning payment'
        });
    }
});

/**
 * POST /api/lightning/decode
 * Decodificar invoice Lightning (sem pagar)
 */
router.post('/decode', async (req, res) => {
    try {
        const { invoice } = req.body;
        
        if (!invoice) {
            return res.status(400).json({
                success: false,
                error: 'Invoice is required'
            });
        }
        
        console.log('🔍 Decoding invoice:', invoice.substring(0, 50) + '...');
        
        // Tentar decodificar com bolt11
        try {
            const bolt11 = await import('bolt11');
            const decoded = bolt11.decode(invoice);
            
            const result = {
                success: true,
                amount: decoded.satoshis || decoded.millisatoshis / 1000,
                paymentHash: decoded.tagsObject?.payment_hash,
                description: decoded.tagsObject?.description || decoded.tagsObject?.purpose,
                expiry: decoded.timeExpireDate,
                destination: decoded.payeeNodeKey,
                timestamp: decoded.timestamp
            };
            
            console.log('✅ Invoice decoded:', result);
            
            res.json(result);
            
        } catch (decodeError) {
            console.error('❌ Failed to decode invoice:', decodeError);
            res.status(400).json({
                success: false,
                error: 'Invalid Lightning invoice'
            });
        }
        
    } catch (error) {
        console.error('❌ Error decoding invoice:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;


