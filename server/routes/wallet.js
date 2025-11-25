import express from 'express';
import bitcoinRpc from '../utils/bitcoinRpc.js';
import runesDecoder from '../utils/runesDecoder.js';
import { broadcastRuneTransaction } from '../utils/runeBroadcast.js';
import axios from 'axios';

const router = express.Router();

/**
 * GET /api/wallet/transactions/:address
 * Retorna todas as transações de um endereço via Bitcoin Core RPC
 */
router.get('/transactions/:address', async (req, res) => {
    try {
        const { address } = req.params;
        console.log(`📊 Fetching transactions for address: ${address}`);

        // Buscar transações do Bitcoin Core RPC
        const transactions = await bitcoinRpc.getAddressTransactions(address);
        
        console.log(`✅ Found ${transactions.length} transactions`);

        res.json({
            success: true,
            address: address,
            transactions: transactions
        });

    } catch (error) {
        console.error('❌ Error fetching transactions:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            transactions: []
        });
    }
});

/**
 * GET /api/wallet/overview/:address
 * Retorna visão completa: balance, UTXOs, transações e runes
 */
router.get('/overview/:address', async (req, res) => {
    try {
        const { address } = req.params;
        console.log(`📊 Fetching complete overview for address: ${address}`);

        // 🔧 USAR A MESMA LÓGICA DO /utxos/:address (ORD server + utxoFilter)
        // Buscar dados em paralelo
        const [balance, utxosResponse, transactions, runes] = await Promise.all([
            bitcoinRpc.getAddressBalance(address),
            // Chamar nosso próprio endpoint que usa ORD + utxoFilter
            axios.get(`http://localhost:4000/api/wallet/utxos/${address}`).then(r => r.data).catch(() => ({ utxos: [] })),
            bitcoinRpc.getAddressTransactions(address),
            runesDecoder.getRunesForAddress(address)
        ]);

        const utxos = utxosResponse.utxos || [];

        console.log(`✅ Overview complete:`);
        console.log(`   Balance: ${balance.total} sats`);
        console.log(`   UTXOs: ${utxos.length}`);
        console.log(`   Transactions: ${transactions.length}`);
        console.log(`   Runes: ${runes.length}`);

        res.json({
            success: true,
            address: address,
            balance: balance,
            utxos: utxos,
            transactions: transactions,
            runes: runes
        });

    } catch (error) {
        console.error('❌ Error fetching overview:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/wallet/sign-transaction
 * Assina uma transação/PSBT (NOVO - para Send Runes)
 */
router.post('/sign-transaction', async (req, res) => {
    try {
        const { psbt, mnemonic } = req.body;
        
        console.log('\n========================================');
        console.log('✍️  SIGN TRANSACTION ENDPOINT CALLED');
        console.log('========================================\n');
        
        if (!psbt || !mnemonic) {
            return res.status(400).json({
                success: false,
                error: 'Missing psbt or mnemonic'
            });
        }
        
        // TODO: Implementar signing real com mnemonic
        // Por enquanto, vamos usar signrawtransactionwithwallet do Bitcoin Core
        
        console.log('⚠️  Using Bitcoin Core wallet for signing (temp solution)');
        
        // Construir raw transaction a partir do PSBT
        const inputs = psbt.inputs.map(inp => ({
            txid: inp.txid,
            vout: inp.vout
        }));
        
        const outputs = {};
        for (const out of psbt.outputs) {
            if (out.scriptPubKey) {
                // OP_RETURN
                outputs.data = out.scriptPubKey.replace('6a', '');
            } else if (out.address) {
                // Address output
                outputs[out.address] = out.value / 100000000; // sats to BTC
            }
        }
        
        console.log('📦 Creating raw transaction...');
        const rawTx = await bitcoinRpc.createRawTransaction(inputs, outputs);
        
        console.log('✍️  Signing with wallet...');
        const signed = await bitcoinRpc.signRawTransactionWithWallet(rawTx);
        
        if (!signed.complete) {
            throw new Error('Transaction signing incomplete');
        }
        
        console.log('✅ Transaction signed successfully');
        
        res.json({
            success: true,
            signedHex: signed.hex
        });
        
    } catch (error) {
        console.error('❌ Error signing transaction:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/wallet/broadcast
 * Faz broadcast de uma transação assinada (OTIMIZADO para Bitcoin Core 30.0)
 * 
 * NOVA ESTRATÉGIA (Bitcoin Core 30.0):
 * 1. SEMPRE tentar Bitcoin Core PRIMEIRO (aceita Runes nativamente!)
 * 2. Se falhar E for Rune: tentar Mining Pools
 * 3. Se falhar E for Rune: tentar APIs públicas
 */
router.post('/broadcast', async (req, res) => {
    try {
        const { hex } = req.body;
        
        console.log('\n========================================');
        console.log('📡 BROADCAST TRANSACTION');
        console.log('========================================\n');
        
        if (!hex) {
            return res.status(400).json({
                success: false,
                error: 'Missing transaction hex'
            });
        }
        
        console.log(`📦 Transaction size: ${hex.length / 2} bytes`);
        
        // Detectar se é transação Rune (contém OP_RETURN OP_13)
        // 6a = OP_RETURN, 5d = OP_13 (marcador Runestone)
        const isRuneTransaction = hex.includes('6a5d');
        
        if (isRuneTransaction) {
            console.log('🔥 Rune transaction detected!');
            console.log('✅ Bitcoin Core v30.0 supports Runes natively!');
            console.log('📡 Trying Bitcoin Core FIRST (recommended)...\n');
        }
        
        const axios = (await import('axios')).default;
        
        // ✅ Broadcast via Bitcoin RPC LOCAL
        try {
            console.log('📡 Broadcasting via LOCAL Bitcoin RPC...');
            const txid = await bitcoinRpc.sendRawTransaction(hex);
            
            console.log('\n✅ ========== BROADCAST SUCCESSFUL! ==========');
            console.log(`📡 Service: Bitcoin RPC (LOCAL)`);
            console.log(`🔗 TXID: ${txid}`);
            console.log(`🌐 View on explorer: http://localhost:3000/krayscan.html?txid=${txid}`);
            console.log('=============================================\n');
            
            return res.json({
                success: true,
                txid: txid,
                service: 'Bitcoin RPC (LOCAL)',
                method: 'public_api'
            });
            
        } catch (mempoolError) {
            console.error('❌ Mempool.space failed:', mempoolError.response?.data || mempoolError.message);
            
            // 2️⃣ FALLBACK: BLOCKSTREAM.INFO
            try {
                console.log('📡 Trying Blockstream.info...');
                const response = await axios.post(
                    'https://blockstream.info/api/tx',
                    hex,
                    {
                        headers: { 'Content-Type': 'text/plain' },
                        timeout: 30000
                    }
                );
                
                const txid = response.data;
                
                console.log('\n✅ ========== BROADCAST SUCCESSFUL! ==========');
                console.log(`🎉 Service: Blockstream.info`);
                console.log(`🔗 TXID: ${txid}`);
                console.log(`🌐 View: https://blockstream.info/tx/${txid}`);
                console.log('=============================================\n');
                
                return res.json({
                    success: true,
                    txid: txid,
                    service: 'Blockstream.info',
                    method: 'public_api'
                });
                
            } catch (blockstreamError) {
                console.error('❌ Blockstream.info failed:', blockstreamError.response?.data || blockstreamError.message);
                
                // Ambos falharam - retornar detalhes
                const mempoolMsg = mempoolError.response?.data || mempoolError.message;
                const blockstreamMsg = blockstreamError.response?.data || blockstreamError.message;
                
                return res.status(500).json({
                    success: false,
                    error: `All broadcast methods failed:\n\n` +
                           `1. Mempool.space: ${mempoolMsg}\n` +
                           `2. Blockstream.info: ${blockstreamMsg}`
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Broadcast error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/wallet/utxos/:address
 * Retorna UTXOs enriquecidos com informações de Inscriptions e Runes
 */
router.get('/utxos/:address', async (req, res) => {
    try {
        const { address } = req.params;
        console.log(`\n📦 ========== FETCHING UTXOs FOR SPLIT ==========`);
        console.log('Address:', address);
        console.log('Address length:', address ? address.length : 0);
        console.log('Full address:', JSON.stringify(address));
        
        // 1. 🚀 Buscar UTXOs do ORD server LOCAL (igual ao KrayScan)
        console.log('📡 [CODE_VERSION_2024_NOV] Fetching UTXOs from LOCAL ORD server...');
        let utxos = [];
        
        try {
            // Usar nova rota de wallet inscriptions via QuickNode
            const ordResponse = await axios.get(`http://localhost:${process.env.PORT || 3000}/api/wallet/${address}/inscriptions`, {
                timeout: 30000
            });
            
            const responseData = ordResponse.data;
            
            // Verificar se retornou JSON válido com inscriptions
            if (responseData && responseData.success && Array.isArray(responseData.inscriptions)) {
                console.log(`   📋 Found ${responseData.inscriptions.length} inscriptions in API response`);
                
                // Mapear inscriptions para o formato de UTXOs
                for (const insc of responseData.inscriptions) {
                    // output format: "txid:vout"
                    const [txid, voutStr] = insc.output.split(':');
                    const vout = parseInt(voutStr);
                    
                    try {
                        // Usar nova rota de output via QuickNode
                        // Nota: Se a rota /api/output retornar JSON, precisamos ajustar aqui também
                        // Mas por enquanto vamos assumir que precisamos buscar dados do output
                        const outResponse = await axios.get(`http://localhost:${process.env.PORT || 3000}/api/output/${insc.output}`, {
                            timeout: 3000
                        });
                        
                        const outData = outResponse.data;
                        
                        // Se outData for JSON (esperado do output.js)
                        if (outData && outData.value) {
                            utxos.push({
                                txid,
                                vout,
                                value: outData.value,
                                script_pubkey: outData.scriptPubKey,
                                scriptPubKey: outData.scriptPubKey,
                                status: { confirmed: true }, // Assumir confirmado se veio do indexador
                                hasInscription: true,
                                inscription: { id: insc.id }
                            });
                        }
                    } catch (outError) {
                        console.warn(`   ⚠️  Failed to fetch output ${insc.output}:`, outError.message);
                    }
                }
            } else {
                console.warn('   ⚠️  Invalid response from inscriptions API');
            }
            
            console.log(`✅ Found ${utxos.length} UTXOs from LOCAL ORD server`);
        } catch (ordError) {
            console.error('❌ ORD server error:', ordError.message);
        }
        
        if (utxos.length === 0) {
            return res.json({
                success: true,
                utxos: [],
                inscriptions: [],
                runes: []
            });
        }
        
        // 2. 🛡️ ENRIQUECER UTXOs com informação de inscriptions e runes usando utxoFilter
        console.log('🛡️  Enriching UTXOs with inscription and rune data...');
        
        const { default: utxoFilter } = await import('../utils/utxoFilter.js');
            
        // Verificar cada UTXO em paralelo
        const enrichedUtxos = await Promise.all(utxos.map(async (utxo) => {
            const hasInscr = await utxoFilter.hasInscription(utxo.txid, utxo.vout);
            const hasRune = await utxoFilter.hasRunes(utxo.txid, utxo.vout);
            
            return {
                ...utxo,
                hasInscription: hasInscr,
                hasRunes: hasRune,
                inscription: hasInscr ? { id: `${utxo.txid}i${utxo.vout}` } : null,
                runes: hasRune ? [] : []
            };
        }));
        
        console.log('✅ UTXOs enriched successfully');
        console.log(`   - ${enrichedUtxos.filter(u => u.hasInscription).length} with inscriptions`);
        console.log(`   - ${enrichedUtxos.filter(u => u.hasRunes).length} with runes`);
        console.log(`   - ${enrichedUtxos.filter(u => !u.hasInscription && !u.hasRunes).length} pure BTC`);
        
        // Log detalhado de cada UTXO enriquecido
        enrichedUtxos.forEach(u => {
            if (u.hasInscription || u.hasRunes) {
                console.log(`   📦 ${u.id}:`);
                if (u.hasInscription) {
                    console.log(`      📜 Inscription: ${u.inscription.id}`);
                }
                if (u.hasRunes) {
                    u.runes.forEach(r => {
                        console.log(`      🪙 Rune: ${r.name} (${r.amount} units)`);
                    });
                }
            }
        });
        
        res.json({
            success: true,
            utxos: enrichedUtxos
        });
        
    } catch (error) {
        console.error('❌ Error fetching UTXOs:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/wallet/fees
 * Retorna taxas de rede recomendadas (low, medium, high)
 */
router.get('/fees', async (req, res) => {
    try {
        console.log('\n💰 Fetching recommended fees from mempool.space...');
        
        const response = await axios.get('https://mempool.space/api/v1/fees/recommended', {
            timeout: 5000
        });
        
        const fees = response.data;
        
        console.log('✅ Fees fetched:');
        console.log(`   Low (1 hour): ${fees.hourFee} sat/vB`);
        console.log(`   Medium (30 min): ${fees.halfHourFee} sat/vB`);
        console.log(`   High (10 min): ${fees.fastestFee} sat/vB`);
        console.log(`   Minimum: ${fees.minimumFee} sat/vB`);
        
        res.json({
            success: true,
            fees: {
                low: fees.hourFee || 1,
                medium: fees.halfHourFee || 2,
                high: fees.fastestFee || 5,
                minimum: fees.minimumFee || 1
            },
            recommended_for_swap: fees.fastestFee || 5, // High por padrão para swaps
            labels: {
                low: '~1 hour',
                medium: '~30 min',
                high: '~10 min'
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching fees:', error.message);
        
        // Fallback fees se mempool.space falhar
        res.json({
            success: true,
            fees: {
                low: 1,
                medium: 2,
                high: 5,
                minimum: 1
            },
            recommended_for_swap: 5,
            labels: {
                low: '~1 hour',
                medium: '~30 min',
                high: '~10 min'
            },
            fallback: true
        });
    }
});

export default router;
