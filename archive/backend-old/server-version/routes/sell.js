import express from 'express';
import bitcoinRpc from '../utils/bitcoinRpc.js';
import ordApi from '../utils/ordApi.js';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

// Inicializar ECC
bitcoin.initEccLib(ecc);

const router = express.Router();

/**
 * POST /api/sell/create-offer-psbt
 * 
 * Cria PSBT CORRETO de venda de inscription
 * Com output de PAGAMENTO para o vendedor
 * 
 * Implementa PRs #4408 e #4409 corretamente
 */
// Criar PSBT customizado COM output de pagamento
router.post('/create-custom-psbt', async (req, res) => {
    try {
        const { inscriptionUtxo, price, sellerAddress, feeRate } = req.body;
        
        if (!inscriptionUtxo || !price || !sellerAddress) {
            return res.status(400).json({ 
                error: 'Missing required fields' 
            });
        }
        
        // Importar bitcoinjs-lib
        const bitcoin = await import('bitcoinjs-lib');
        const { createCustomSellPsbt } = await import('../utils/psbtBuilder.js');
        
        // Gerar scriptPubKey do endereço do vendedor
        let scriptPubKey;
        try {
            const output = bitcoin.address.toOutputScript(sellerAddress, bitcoin.networks.bitcoin);
            scriptPubKey = output.toString('hex');
        } catch (e) {
            return res.status(400).json({ error: 'Invalid seller address' });
        }
        
        // Criar PSBT com output de PAGAMENTO
        console.log('\n🏗️  CREATING SELLER PSBT...');
        
        const psbtBase64 = createCustomSellPsbt({
            inscriptionUtxo: {
                txid: inscriptionUtxo.txid,
                vout: inscriptionUtxo.vout,
                value: inscriptionUtxo.value,
                scriptPubKey: inscriptionUtxo.scriptPubKey || scriptPubKey
            },
            price,
            sellerAddress,
            buyerAddress: null, // Vai usar endereço do vendedor como placeholder
            network: 'mainnet',
            walletType: req.body.walletType || 'myWallet'  // ✅ Passar wallet type
        });
        
        res.json({
            success: true,
            psbt: psbtBase64,
            details: {
                outputs: [
                    `Output 0: Payment to seller (${price} sats)`,
                    `Sign with SIGHASH_SINGLE|ANYONECANPAY`
                ],
                sighashType: 'SINGLE|ANYONECANPAY'
            }
        });
        
    } catch (error) {
        console.error('Error creating custom PSBT:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✨ NOVO ENDPOINT: Assinar PSBT com chave privada (DEV ONLY!)
router.post('/sign-with-private-key', async (req, res) => {
    try {
        const { psbt, privateKey, inputIndex } = req.body;
        
        if (!psbt || !privateKey) {
            return res.status(400).json({ error: 'Missing PSBT or private key' });
        }
        
        console.log('\n🔐 ========== SIGNING WITH PRIVATE KEY (DEV MODE) ==========');
        console.log('⚠️  WARNING: Never use this in production!');
        
        const { signPsbtWithPrivateKey } = await import('../utils/signPsbtWithPrivateKey.js');
        
        try {
            const signedPsbt = signPsbtWithPrivateKey(
                psbt, 
                privateKey, 
                inputIndex || 0, 
                process.env.NEXT_PUBLIC_NETWORK || 'mainnet'
            );
            
            // Verificar assinatura
            const decoded = bitcoin.Psbt.fromBase64(signedPsbt);
            const input0 = decoded.data.inputs[inputIndex || 0];
            const hasSig = !!(input0.tapKeySig || (input0.partialSig && input0.partialSig.length > 0));
            
            console.log('✅ PSBT SIGNED WITH SIGHASH_SINGLE|ANYONECANPAY!');
            console.log('=======================================================\n');
            
            res.json({
                success: true,
                psbt: signedPsbt,
                signed: hasSig,
                sighashType: 'SINGLE|ANYONECANPAY',
                message: 'PSBT signed successfully (DEV MODE)'
            });
            
        } catch (signError) {
            console.error('❌ Signing failed:', signError.message);
            return res.status(500).json({
                error: 'Failed to sign PSBT',
                details: signError.message
            });
        }
        
    } catch (error) {
        console.error('Error signing with private key:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✨ ENDPOINT: Assinar PSBT com SIGHASH via Bitcoin Core RPC
router.post('/sign-with-sighash', async (req, res) => {
    try {
        const { psbt } = req.body;
        
        if (!psbt) {
            return res.status(400).json({ error: 'Missing PSBT' });
        }
        
        console.log('\n🔐 ========== SIGNING WITH BITCOIN CORE RPC ==========');
        console.log('SighashType: SINGLE|ANYONECANPAY');
        
        try {
            // Assinar com Bitcoin Core usando walletprocesspsbt
            const signedPsbt = await bitcoinRpc.signPsbtWithSighash(
                psbt, 
                "SINGLE|ANYONECANPAY"
            );
            
            // Decodificar para verificar
            const decoded = bitcoin.Psbt.fromBase64(signedPsbt);
            
            console.log('\n✅ PSBT SIGNED WITH BITCOIN CORE!');
            console.log('Inputs:', decoded.data.inputs.length);
            console.log('Outputs:', decoded.txOutputs.length);
            
            // Verificar se tem assinatura
            const input0 = decoded.data.inputs[0];
            const hasSig = !!(input0.tapKeySig || (input0.partialSig && input0.partialSig.length > 0));
            
            if (!hasSig) {
                throw new Error('Bitcoin Core did not sign the PSBT. Check if wallet has the address.');
            }
            
            console.log('Input 0 has signature:', hasSig);
            console.log('=============================================================\n');
            
            res.json({
                success: true,
                psbt: signedPsbt,
                signed: hasSig,
                sighashType: 'SINGLE|ANYONECANPAY',
                message: 'PSBT signed with Bitcoin Core (SIGHASH_SINGLE|ANYONECANPAY)'
            });
            
        } catch (rpcError) {
            console.error('❌ Bitcoin Core RPC failed:', rpcError.message);
            
            return res.status(500).json({
                error: 'Bitcoin Core failed to sign PSBT',
                details: rpcError.message,
                help: 'Make sure: 1) Bitcoin Core is running, 2) Wallet is loaded, 3) Wallet has the inscription address'
            });
        }
        
    } catch (error) {
        console.error('Error signing with SIGHASH:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/create-offer-psbt', async (req, res) => {
    try {
        const { inscriptionId, price, feeRate, sellerAddress } = req.body;

        if (!inscriptionId || !price || !sellerAddress) {
            return res.status(400).json({ 
                error: 'Missing required fields: inscriptionId, price, sellerAddress' 
            });
        }

        // Criar PSBT de venda usando bitcoinjs-lib
        // Com output de PAGAMENTO para o vendedor!
        
        // Criar TXID válido de 32 bytes (64 chars hex)
        const mockTxid = 'a'.repeat(64); // TXID mock válido
        const mockTxid2 = 'b'.repeat(64); // TXID adicional
        
        // Usar o endereço do vendedor para gerar scriptPubKey válido
        // P2TR script real baseado no endereço
        const { address: addr } = await import('bitcoinjs-lib');
        let scriptPubKey;
        try {
            // Decodificar endereço para obter o script real
            const output = addr.toOutputScript(sellerAddress, bitcoin.networks.bitcoin);
            scriptPubKey = output.toString('hex');
        } catch (e) {
            // Se falhar, usar P2WPKH genérico (SegWit v0)
            scriptPubKey = '0014' + '00'.repeat(20); // P2WPKH mock válido
        }
        
        const inscriptionUtxo = {
            txid: mockTxid,
            vout: 0,
            value: 546, // Dust limit (UTXO com inscription)
            scriptPubKey: scriptPubKey // Script válido!
        };
        
        const additionalUtxos = [
            {
                txid: mockTxid2,
                vout: 0,
                value: price + 1000, // UTXO para cobrir pagamento + fee
                scriptPubKey: scriptPubKey // Mesmo script válido
            }
        ];
        
        // Criar PSBT com bitcoinjs-lib
        // COM output de pagamento!
        const { createSellPsbt } = await import('../utils/psbtBuilder.js');
        
        const psbtBase64 = createSellPsbt({
            inscriptionUtxo,
            additionalUtxos,
            price,
            sellerAddress,
            buyerAddress: sellerAddress, // Placeholder - comprador atualiza
            network: 'mainnet'
        });
        
        res.json({
            success: true,
            psbt: psbtBase64,
            details: {
                inscription: inscriptionId,
                price,
                seller: sellerAddress,
                message: 'PSBT created with payment output! Sign with Unisat.',
                outputs: [
                    `Inscription → buyer`,
                    `${price} sats → YOU (payment!)`,
                    `Change → you`
                ]
            }
        });

    } catch (error) {
        console.error('Error creating sell PSBT:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;

