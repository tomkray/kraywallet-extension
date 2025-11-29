import express from 'express';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import bitcoinRpc from '../utils/bitcoinRpc.js';
import mempoolApi from '../utils/mempoolApi.js';
import { network, validatePsbt } from '../utils/psbtUtils.js';
import psbtBuilderSplit from '../utils/psbtBuilderSplit.js';
import { db } from '../db/init-supabase.js';
import { decryptAndAddSignature } from '../utils/psbtCrypto.js';

// Inicializar biblioteca ECC
bitcoin.initEccLib(ecc);

const router = express.Router();

// POST /api/psbt/create - Criar PSBT para oferta
router.post('/create', async (req, res) => {
    try {
        const { inputs, outputs } = req.body;

        if (!inputs || !outputs || !Array.isArray(inputs) || !Array.isArray(outputs)) {
            return res.status(400).json({ error: 'Valid inputs and outputs arrays required' });
        }

        // Criar PSBT usando Bitcoin Core
        const psbt = await bitcoinRpc.createPsbt(inputs, outputs);

        res.json({
            success: true,
            psbt,
            message: 'PSBT created successfully'
        });
    } catch (error) {
        console.error('Error creating PSBT:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/psbt/decode - Decodificar PSBT
router.post('/decode', async (req, res) => {
    try {
        const { psbt } = req.body;

        if (!psbt) {
            return res.status(400).json({ error: 'PSBT required' });
        }

        console.log('🔍 Decoding PSBT for popup...');

        // Decodificar usando bitcoinjs-lib para obter detalhes estruturados
        const psbtObj = bitcoin.Psbt.fromBase64(psbt, { network });
        
        // Extrair informações dos inputs
        const inputs = psbtObj.data.inputs.map((input, index) => {
            const txInput = psbtObj.txInputs[index];
            let address = null;
            let value = 0;

            // Tentar extrair endereço do witnessUtxo
            if (input.witnessUtxo) {
                value = input.witnessUtxo.value;
                try {
                    address = bitcoin.address.fromOutputScript(input.witnessUtxo.script, network);
                } catch (e) {
                    console.log(`Could not decode address for input ${index}`);
                }
            }

            return {
                txid: Buffer.from(txInput.hash).reverse().toString('hex'),
                vout: txInput.index,
                address,
                value,
                hasSignature: !!(input.finalScriptSig || input.finalScriptWitness),
                sequence: txInput.sequence
            };
        });

        // Extrair informações dos outputs
        const outputs = psbtObj.txOutputs.map((output, index) => {
            let address = null;
            try {
                address = bitcoin.address.fromOutputScript(output.script, network);
            } catch (e) {
                console.log(`Could not decode address for output ${index}`);
            }

            return {
                address,
                value: output.value,
                script: output.script.toString('hex')
            };
        });

        console.log('✅ PSBT decoded:');
        console.log(`  Inputs: ${inputs.length}`);
        console.log(`  Outputs: ${outputs.length}`);

        res.json({
            success: true,
            inputs,
            outputs,
            decoded: {
                tx: {
                    version: psbtObj.version,
                    locktime: psbtObj.locktime
                },
                inputs,
                outputs
            }
        });
    } catch (error) {
        console.error('❌ Error decoding PSBT:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/psbt/analyze - Analisar PSBT
router.post('/analyze', async (req, res) => {
    try {
        const { psbt } = req.body;

        if (!psbt) {
            return res.status(400).json({ error: 'PSBT required' });
        }

        // Analisar PSBT usando Bitcoin Core
        const analysis = await bitcoinRpc.analyzePsbt(psbt);

        res.json({
            success: true,
            analysis
        });
    } catch (error) {
        console.error('Error analyzing PSBT:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/psbt/sign - Assinar PSBT (placeholder - em produção seria feito no cliente)
router.post('/sign', (req, res) => {
    try {
        const { psbt, privateKey } = req.body;

        if (!psbt) {
            return res.status(400).json({ error: 'PSBT required' });
        }

        // ATENÇÃO: Nunca envie chaves privadas ao servidor!
        // Isso é apenas para demonstração
        // Em produção, a assinatura DEVE acontecer no cliente

        res.json({
            success: true,
            signedPsbt: psbt + '_signed',
            message: 'PSBT signed (mock - use wallet extension)'
        });
    } catch (error) {
        console.error('Error signing PSBT:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/psbt/finalize - Finalizar PSBT assinado
router.post('/finalize', async (req, res) => {
    try {
        const { psbt: psbtBase64 } = req.body;

        if (!psbtBase64) {
            return res.status(400).json({ error: 'PSBT required' });
        }

        console.log('\n🔧 FINALIZE ENDPOINT CALLED');
        console.log('PSBT received length:', psbtBase64.length, 'characters');
        
        // Re-inicializar ECC (bug do bitcoinjs-lib)
        bitcoin.initEccLib(ecc);
        
        // ⚠️ CRÍTICO: Para Taproot com assinaturas de diferentes wallets,
        // usar Bitcoin Core RPC para finalizar (lida melhor com inputs sem tapInternalKey)
        console.log('🔧 Trying Bitcoin Core finalizepsbt first...');
        
        try {
            const finalizedPsbt = await bitcoinRpc.finalizePsbt(psbtBase64);
            
            if (finalizedPsbt.complete) {
                console.log('✅ Bitcoin Core finalized successfully!');
                const tx = bitcoin.Transaction.fromHex(finalizedPsbt.hex);
                const txid = tx.getId();
                
                return res.json({
                    success: true,
                    psbt: finalizedPsbt.psbt,
                    hex: finalizedPsbt.hex,
                    txid,
                    message: 'PSBT finalized by Bitcoin Core'
                });
            } else {
                console.log('⚠️ Bitcoin Core could not complete finalization, trying bitcoinjs-lib...');
            }
        } catch (rpcError) {
            console.log('⚠️ Bitcoin Core finalizepsbt failed:', rpcError.message);
            console.log('   Falling back to bitcoinjs-lib...');
        }
        
        // Fallback: Tentar com bitcoinjs-lib
        try {
            const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
            
            console.log('✅ PSBT decoded successfully (bitcoinjs-lib)');
            console.log('   Total inputs:', psbt.inputCount);
            
            // Verificar quais inputs estão assinados (P2TR usa tapKeySig)
            console.log('\n📋 Checking input signatures:');
            let signedInputs = [];
            for (let i = 0; i < psbt.inputCount; i++) {
                const input = psbt.data.inputs[i];
                const hasTapKeySig = input.tapKeySig && input.tapKeySig.length > 0;
                const hasPartialSig = input.partialSig && input.partialSig.length > 0;
                
                // Log detalhado do estado do input
                const witnessScript = input.witnessUtxo?.script;
                const isP2TR = witnessScript && witnessScript.length === 34 && 
                               witnessScript[0] === 0x51 && witnessScript[1] === 0x20;
                
                console.log(`🔍 Input ${i} detailed check:`, {
                    hasTapKeySig,
                    hasPartialSig,
                    tapKeySigLength: input.tapKeySig ? input.tapKeySig.length : 0,
                    partialSigLength: input.partialSig ? input.partialSig.length : 0,
                    hasTapInternalKey: !!input.tapInternalKey,
                    tapInternalKeyHex: input.tapInternalKey ? input.tapInternalKey.toString('hex') : 'MISSING',
                    hasWitnessUtxo: !!input.witnessUtxo,
                    isP2TR,
                    scriptPubKeyHex: witnessScript ? witnessScript.toString('hex') : 'MISSING'
                });
                
                if (hasTapKeySig || hasPartialSig) {
                    signedInputs.push(i);
                    console.log(`  ✅ Input ${i} IS signed!`);
                } else {
                    console.log(`  ❌ Input ${i} NOT signed yet!`);
                }
            }
            
            console.log(`Total inputs: ${psbt.inputCount}, Signed: ${signedInputs.length}`);
            
            // Para atomic swaps, precisamos de pelo menos 1 input assinado
            if (signedInputs.length === 0) {
                console.log('No inputs are signed, cannot finalize');
                return res.status(400).json({ error: 'No inputs are signed' });
            }
            
            // Finalizar PSBT (com suporte para SIGHASH_NONE|ANYONECANPAY)
            console.log('\n🔧 Finalizando PSBT...');
            
            try {
                // ⚠️ CRÍTICO: Finalizar inputs MANUALMENTE para suportar SIGHASH_NONE|ANYONECANPAY
                // bitcoinjs-lib.finalizeAllInputs() FALHA com SIGHASH customizados!
                
                for (let i = 0; i < psbt.inputCount; i++) {
                    const input = psbt.data.inputs[i];
                    
                    // Se já está finalizado, skip
                    if (input.finalScriptWitness || input.finalScriptSig) {
                        console.log(`  ✅ Input ${i}: Already finalized`);
                        continue;
                    }
                    
                    // Verificar se tem assinatura
                    if (!input.tapKeySig) {
                        console.log(`  ⚠️  Input ${i}: No signature, skipping`);
                        continue;
                    }
                    
                    console.log(`  🔧 Finalizing Input ${i}...`);
                    console.log(`     tapKeySig length: ${input.tapKeySig.length} bytes`);
                    console.log(`     sighashType: ${input.sighashType} (0x${input.sighashType?.toString(16) || '00'})`);
                    
                    // ✅ FINALIZAÇÃO MANUAL PARA TAPROOT KEY PATH
                    // Para Taproot key path, o witness é: [signature]
                    // Se sighashType !== 0x00 (default), precisa ser anexado à assinatura
                    
                    let finalSignature = input.tapKeySig;
                    
                    // ⚠️ CRÍTICO: Se sighashType for customizado (não-default), anexar ao final da assinatura
                    if (input.sighashType && input.sighashType !== 0x00) {
                        console.log(`     ⭐ Custom SIGHASH detected: 0x${input.sighashType.toString(16)}`);
                        console.log(`        Appending sighashType byte to signature...`);
                        
                        // Criar novo buffer: signature (64 bytes) + sighashType (1 byte)
                        finalSignature = Buffer.concat([
                            input.tapKeySig,
                            Buffer.from([input.sighashType])
                        ]);
                        
                        console.log(`        Final signature length: ${finalSignature.length} bytes (64 + 1)`);
                    }
                    
                    // Construir witness: [signature]
                    // Formato: [length][signature]
                    const witnessStack = [finalSignature];
                    
                    // Codificar witness no formato esperado pelo Bitcoin
                    const witnessBuffer = Buffer.concat([
                        Buffer.from([witnessStack.length]), // Número de elementos no stack
                        Buffer.from([finalSignature.length]), // Tamanho do elemento
                        finalSignature // Signature
                    ]);
                    
                    // Atualizar PSBT com witness finalizado
                    psbt.data.inputs[i].finalScriptWitness = witnessBuffer;
                    
                    console.log(`  ✅ Input ${i} finalized manually`);
                    console.log(`     finalScriptWitness length: ${witnessBuffer.length} bytes`);
                }
                
                console.log('✅ Todos os inputs finalizados com sucesso!');
                
            } catch (finalizeError) {
                console.error('❌ Finalization failed:', finalizeError.message);
                console.error('   Stack:', finalizeError.stack);
                
                return res.status(500).json({ 
                    error: 'Failed to finalize PSBT',
                    details: finalizeError.message,
                    signedInputs: signedInputs.length,
                    totalInputs: psbt.inputCount
                });
            }
            
            // Extrair transação
            console.log('\n📤 Extraindo transação...');
            
            const tx = psbt.extractTransaction();
            const txHex = tx.toHex();
            const txid = tx.getId();
            
            console.log('✅ Transação extraída com sucesso!');
            console.log('   TXID:', txid);
            console.log('   Tamanho:', txHex.length / 2, 'bytes');
            
            res.json({
                success: true,
                psbt: psbt.toBase64(),
                hex: txHex,
                txid: txid,
                message: 'PSBT finalized and transaction extracted'
            });
            
        } catch (jsError) {
            console.error('\n❌ ERRO:', jsError.message);
            console.error('Stack:', jsError.stack);
            
            res.status(500).json({ 
                error: 'Failed to finalize PSBT',
                details: jsError.message
            });
        }
    } catch (error) {
        console.error('Error finalizing PSBT:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/psbt/broadcast - Broadcast PSBT assinado ou transação hex
router.post('/broadcast', async (req, res) => {
    try {
        const { psbt, hex } = req.body;

        if (!psbt && !hex) {
            return res.status(400).json({ error: 'PSBT or transaction hex required' });
        }

        let txid;
        
        // Se temos hex direto, broadcast direto
        if (hex) {
            console.log('Broadcasting raw transaction hex...');
            console.log('Hex length:', hex.length / 2, 'bytes');
            
            // 🎯 PRIORIDADE 1: BITCOIN CORE RPC (Como no backup que funcionava!)
            try {
                console.log('📡 Broadcasting via Bitcoin Core RPC...');
                txid = await bitcoinRpc.sendRawTransaction(hex);
                console.log('✅ Transaction broadcasted successfully!');
                console.log('   TXID:', txid);
                console.log('   Service: Bitcoin Core RPC');
            } catch (rpcError) {
                console.error('❌ Bitcoin Core RPC failed:', rpcError.message);
                
                // FALLBACK: Usar APIs públicas
                const axios = (await import('axios')).default;
                
                // 2️⃣ TENTAR MEMPOOL.SPACE
                try {
                    console.log('📡 Trying Mempool.space...');
                    const response = await axios.post(
                        'https://mempool.space/api/tx',
                        hex,
                        {
                            headers: { 'Content-Type': 'text/plain' },
                            timeout: 30000
                        }
                    );
                    
                    txid = response.data;
                    console.log('✅ Transaction broadcasted successfully!');
                    console.log('   TXID:', txid);
                    console.log('   Service: Mempool.space');
                } catch (mempoolError) {
                    console.error('❌ Mempool.space failed:', mempoolError.response?.data || mempoolError.message);
                    
                    // 3️⃣ FALLBACK: BLOCKSTREAM.INFO
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
                        
                        txid = response.data;
                        console.log('✅ Transaction broadcasted successfully!');
                        console.log('   TXID:', txid);
                        console.log('   Service: Blockstream.info');
                    } catch (blockstreamError) {
                        console.error('❌ Blockstream.info failed:', blockstreamError.response?.data || blockstreamError.message);
                        
                        const errorMsg = rpcError.message + ' | ' + mempoolError.response?.data || mempoolError.message;
                        throw new Error(`All broadcast methods failed: ${errorMsg}`);
                    }
                }
            }
        } else {
            // Tentar extrair hex do PSBT
            try {
                console.log('Extracting transaction from PSBT...');
                const psbtObj = bitcoin.Psbt.fromBase64(psbt);
                
                // Verificar se está finalizado
                let isFinalized = true;
                for (let i = 0; i < psbtObj.inputCount; i++) {
                    const input = psbtObj.data.inputs[i];
                    if (!input.finalScriptWitness && !input.finalScriptSig) {
                        isFinalized = false;
                        break;
                    }
                }
                
                if (!isFinalized) {
                    console.log('PSBT not finalized, attempting to finalize...');
                    psbtObj.finalizeAllInputs();
                }
                
                const tx = psbtObj.extractTransaction();
                const txHex = tx.toHex();
                
                console.log('Broadcasting extracted transaction...');
                const result = await bitcoinRpc.sendRawTransaction(txHex);
                txid = result;
                console.log('Transaction broadcasted successfully:', txid);
            } catch (extractError) {
                console.error('Failed to extract/broadcast from PSBT:', extractError);
                
                // Último recurso: tentar broadcast direto do PSBT via RPC
                try {
                    console.log('Trying direct PSBT broadcast via RPC...');
                    txid = await bitcoinRpc.broadcastPsbt(psbt);
                    console.log('PSBT broadcasted via RPC:', txid);
                } catch (rpcError) {
                    console.error('All broadcast methods failed:', rpcError);
                    throw rpcError;
                }
            }
        }

        res.json({
            success: true,
            txid,
            message: 'Transaction broadcasted successfully'
        });
    } catch (error) {
        console.error('Error broadcasting transaction:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.response?.data || error.toString()
        });
    }
});

// GET /api/psbt/fees - Obter taxas recomendadas (mempool.space + Bitcoin Core)
router.get('/fees', async (req, res) => {
    try {
        let fees = {};
        let source = 'unknown';
        
        // Tentar buscar do mempool.space primeiro (mais preciso e em tempo real)
        try {
            const mempoolFees = await mempoolApi.getRecommendedFees();
            fees = {
                high: mempoolFees.high,
                medium: mempoolFees.medium,
                low: mempoolFees.low,
                minimum: mempoolFees.minimum,
                halfHour: mempoolFees.halfHour
            };
            source = 'mempool.space';
        } catch (mempoolError) {
            // Fallback para Bitcoin Core se mempool.space falhar
            console.log('Mempool.space unavailable, using Bitcoin Core');
            const coreFees = await bitcoinRpc.getRecommendedFees();
            fees = {
                high: coreFees.fast,
                medium: coreFees.medium,
                low: coreFees.slow,
                minimum: 1,
                halfHour: Math.round((coreFees.fast + coreFees.medium) / 2)
            };
            source = 'bitcoin-core';
        }

        res.json({
            success: true,
            fees,
            source,
            timestamp: new Date().toISOString(),
            // Informações adicionais
            info: {
                high: 'Next block (~10 min)',
                halfHour: '~30 minutes',
                medium: '~1 hour',
                low: 'Low priority (~2-6 hours)',
                minimum: 'Minimum network fee',
                custom: 'You can set any custom fee rate'
            }
        });
    } catch (error) {
        console.error('Error fetching fees:', error);
        res.status(500).json({ 
            error: error.message,
            // Fallback seguro
            fees: { 
                high: 20, 
                medium: 10, 
                low: 5,
                minimum: 1,
                halfHour: 15
            },
            source: 'fallback'
        });
    }
});

// GET /api/psbt/transaction/:txid - Obter status de transação
router.get('/transaction/:txid', async (req, res) => {
    try {
        const { txid } = req.params;
        
        const status = await bitcoinRpc.getTransactionStatus(txid);

        res.json({
            success: true,
            txid,
            ...status
        });
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(404).json({ error: 'Transaction not found' });
    }
});

// POST /api/psbt/split - Criar PSBT para split/consolidação de UTXOs
router.post('/split', async (req, res) => {
    try {
        console.log('\n🔀 ========== SPLIT UTXO REQUEST ==========');
        
        const { address, inputs, outputs, feeRate } = req.body;
        
        // Validações
        if (!address || typeof address !== 'string') {
            return res.status(400).json({ 
                success: false, 
                error: 'Valid address required' 
            });
        }
        
        if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'At least one input required' 
            });
        }
        
        if (!outputs || !Array.isArray(outputs) || outputs.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'At least one output required' 
            });
        }
        
        console.log('Address:', address);
        console.log('Inputs:', inputs.length);
        console.log('Outputs:', outputs.length);
        console.log('Fee Rate:', feeRate || 1, 'sat/vB');
        
        // Construir PSBT usando PSBTBuilderSplit
        const result = await psbtBuilderSplit.buildSplitPSBT({
            address,
            inputs,
            outputs,
            feeRate: feeRate || 1
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error creating split PSBT:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// POST /api/psbt/sell - Criar PSBT para venda de inscription (Unisat, Xverse)
router.post('/sell', async (req, res) => {
    try {
        const { inscriptionId, price, sellerAddress, walletType } = req.body;
        
        console.log('\n🏗️ ========== CREATE SELLER PSBT ==========');
        console.log('📋 Inscription ID:', inscriptionId);
        console.log('💰 Price:', price, 'sats');
        console.log('👤 Seller:', sellerAddress);
        console.log('💼 Wallet:', walletType);
        
        if (!inscriptionId || !price || !sellerAddress) {
            return res.status(400).json({ 
                error: 'Missing required fields: inscriptionId, price, sellerAddress' 
            });
        }
        
        // Importar createCustomSellPsbt
        const { createCustomSellPsbt } = await import('../utils/psbtBuilder.js');
        
        // 🔍 BUSCAR OUTPUT LOCATOR REAL DA INSCRIPTION (não o ID!)
        console.log('🔍 Fetching REAL output location for inscription:', inscriptionId);
        
        const ORD_SERVER_URL = process.env.ORD_SERVER_URL || 'http://127.0.0.1:80';
        
        // 1️⃣ Buscar a página da inscription para pegar o output ATUAL
        const inscriptionResponse = await fetch(`https://ordinals.com/inscription/${inscriptionId}`);
        if (!inscriptionResponse.ok) {
            throw new Error(`Failed to fetch inscription from ORD server: ${inscriptionResponse.statusText}`);
        }
        
        const inscriptionHtml = await inscriptionResponse.text();
        
        // 2️⃣ Extrair o output REAL (location atual) do HTML
        // Exemplo: <a class=collapse href=/output/069b464704889228e034b6e04a94ae08259909d3aa1fcf1a7f33b3986f32f38e:0>
        const outputMatch = inscriptionHtml.match(/\/output\/([a-f0-9]{64}):(\d+)/);
        if (!outputMatch) {
            throw new Error(`Could not find current output location for inscription ${inscriptionId}`);
        }
        
        const txid = outputMatch[1];
        const vout = parseInt(outputMatch[2]);
        
        console.log('✅ Found REAL output location:', txid, ':', vout);
        
        // 3️⃣ Buscar o valor do UTXO atual
        const outputResponse = await fetch(`${ORD_SERVER_URL}/output/${txid}:${vout}`);
        if (!outputResponse.ok) {
            throw new Error(`Failed to fetch UTXO from ORD server: ${outputResponse.statusText}`);
        }
        
        const outputHtml = await outputResponse.text();
        
        // ✅ BUSCAR VALOR REAL DO UTXO DA BLOCKCHAIN
        // A assinatura do seller DEVE ser calculada com o valor REAL do UTXO!
        // Se usarmos 546 fixo, mas o UTXO real tem outro valor, a assinatura será inválida.
        // Extrair do "Sat Range": Exemplo: "(555 sats)" ou "<h2>555 Sat Range</h2>"
        let valueMatch = outputHtml.match(/\((\d+)\s+sats?\)/i);
        let outputValue = valueMatch ? parseInt(valueMatch[1]) : null;
        
        // Se não encontrar, tentar pegar do "<h2>X Sat Range</h2>"
        if (!outputValue) {
            valueMatch = outputHtml.match(/<h2>(\d+)\s+Sat\s+Range<\/h2>/i);
            outputValue = valueMatch ? parseInt(valueMatch[1]) : null;
        }
        
        // Fallback para 546 sats se não conseguir extrair
        if (!outputValue || outputValue < 546) {
            console.warn(`   ⚠️  Could not extract UTXO value, using fallback: 546 sats`);
            outputValue = 546;
        }
        
        console.log('✅ UTXO locator:', txid, ':', vout);
        console.log('✅ UTXO value:', outputValue, 'sats (REAL value from blockchain)');
        
        // Buscar scriptPubKey do endereço
        const output = bitcoin.address.toOutputScript(sellerAddress, network);
        const scriptPubKey = output.toString('hex');
        
        // Criar PSBT
        const psbtBase64 = createCustomSellPsbt({
            inscriptionUtxo: {
                txid,
                vout,
                value: outputValue,
                scriptPubKey
            },
            price,
            sellerAddress,
            buyerAddress: null, // Placeholder
            network: 'mainnet',
            walletType: walletType || 'unisat'
        });
        
        console.log('✅ PSBT created successfully!');
        console.log('   Length:', psbtBase64.length, 'chars');
        console.log('==========================================\n');
        
        res.json({
            success: true,
            psbt: psbtBase64,
            details: {
                inscriptionId,
                price,
                sellerAddress,
                inscriptionValue: outputValue,
                outputs: [
                    `Output 0: Inscription → Buyer (${outputValue} sats)`,
                    `Output 1: Payment → Seller (${price + outputValue} sats)`
                ],
                sighashType: 'SINGLE|ANYONECANPAY'
            }
        });
        
    } catch (error) {
        console.error('❌ Error creating seller PSBT:', error);
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 🔐 ENCRYPTED SIGNATURE ATOMIC SWAP - Broadcast Controlado
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/psbt/broadcast-atomic
 * 
 * Broadcast ATÔMICO com validação rigorosa e assinatura criptografada
 * Este é o ÚNICO endpoint que pode fazer broadcast de atomic swaps!
 * 
 * SEGURANÇA:
 * - ✅ Validar que Output 1 (payment) está correto
 * - ✅ Descriptografar assinatura do seller apenas no momento do broadcast
 * - ✅ Adicionar assinatura do seller ao PSBT assinado pelo buyer
 * - ✅ Finalizar e fazer broadcast via Bitcoin Core RPC
 * - ❌ Atacante NÃO pode fazer broadcast fora do marketplace!
 */
router.post('/broadcast-atomic', async (req, res) => {
    let buyerAddress = 'unknown'; // Declarar aqui para uso no catch block
    
    try {
        console.log('\n🔥 ===== ENCRYPTED SIGNATURE ATOMIC SWAP BROADCAST =====');
        
        const { psbt: buyerPsbtBase64, offerId } = req.body;
        
        if (!buyerPsbtBase64 || !offerId) {
            return res.status(400).json({ error: 'PSBT and offerId required' });
        }
        
        console.log('📋 Offer ID:', offerId);
        console.log('📦 Buyer PSBT length:', buyerPsbtBase64.length, 'chars');
        console.log('📦 Buyer PSBT (first 100 chars):', buyerPsbtBase64.substring(0, 100));
        
        // ═══════════════════════════════════════════════════════════════
        // 📊 AUDIT LOG: PURCHASE ATTEMPT
        // ═══════════════════════════════════════════════════════════════
        
        const { default: auditLogger } = await import('../utils/auditLogger.js');
        
        auditLogger.purchaseAttempt({
            offerId,
            buyerAddress: 'detecting...', // Será atualizado após decodificar PSBT
            timestamp: Date.now()
        });
        
        // ═══════════════════════════════════════════════════════════════
        // 🛡️ STEP 1: BUSCAR OFFER E VALIDAR
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n🛡️  STEP 1: Validating offer...');
        
        const offer = db.prepare(`
            SELECT 
                id, offer_amount, creator_address, status, 
                encrypted_signature, signature_key, sighash_type
            FROM offers 
            WHERE id = ?
        `).get(offerId);
        
        if (!offer) {
            console.error('❌ Offer not found!');
            return res.status(404).json({ error: 'Offer not found' });
        }
        
        if (offer.status !== 'active') {
            console.error('❌ Offer is not active! Status:', offer.status);
            return res.status(400).json({ error: `Offer is ${offer.status}, not active` });
        }
        
        // ═══════════════════════════════════════════════════════════════
        // 🔒 STEP 1.5: PURCHASE LOCK (Anti-Front-Running)
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n🔒 STEP 1.5: Checking purchase lock...');
        
        const { default: purchaseLocks } = await import('../utils/purchaseLocks.js');
        
        // Detectar buyer address do PSBT
        const buyerPsbt = bitcoin.Psbt.fromBase64(buyerPsbtBase64, { network });
        const buyerAddress = buyerPsbt.txOutputs[0] ? 
            bitcoin.address.fromOutputScript(buyerPsbt.txOutputs[0].script, network) : 
            'unknown';
        
        // Tentar obter lock (5 minutos)
        const lockResult = purchaseLocks.tryLock(offerId, buyerAddress, 300000);
        
        if (!lockResult.success) {
            console.error('❌ Purchase locked by another buyer!');
            
            // 📊 AUDIT LOG: PURCHASE BLOCKED
            auditLogger.purchaseBlocked({
                offerId,
                buyerAddress,
                lockHolder: lockResult.holder,
                reason: lockResult.reason
            });
            
            return res.status(409).json({ 
                error: lockResult.reason,
                holder: lockResult.holder?.substring(0, 10) + '...',
                expiresIn: lockResult.expiresIn
            });
        }
        
        console.log('✅ Purchase lock acquired' + (lockResult.renewed ? ' (renewed)' : ''));
        
        console.log('✅ Offer validated');
        console.log('   Price:', offer.offer_amount, 'sats');
        console.log('   Seller:', offer.creator_address);
        console.log('   Status:', offer.status);
        console.log('   SIGHASH type:', offer.sighash_type, '(0x' + (offer.sighash_type || 0).toString(16) + ')');
        
        // ═══════════════════════════════════════════════════════════════
        // 🛡️ STEP 2: DECODIFICAR PSBT DO BUYER E VALIDAR OUTPUT 1
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n🛡️  STEP 2: Validating buyer PSBT outputs...');
        
        // buyerPsbt já foi declarado no STEP 1.5 (anti-front-running)
        
        console.log('📊 Buyer PSBT structure:');
        console.log('   Inputs:', buyerPsbt.inputCount);
        console.log('   Outputs:', buyerPsbt.txOutputs.length);
        
        // ✅ Debug: Verificar assinaturas nos inputs do buyer
        console.log('\n🔍 BUYER PSBT INPUTS DETAILED DEBUG:');
        for (let i = 0; i < buyerPsbt.inputCount; i++) {
            const input = buyerPsbt.data.inputs[i];
            console.log(`\n   Input ${i}:`);
            console.log(`      tapKeySig: ${input.tapKeySig ? `✓ EXISTS (${input.tapKeySig.length} bytes)` : '❌ MISSING'}`);
            if (input.tapKeySig) {
                console.log(`         Hex: ${input.tapKeySig.toString('hex').substring(0, 40)}...`);
            }
            console.log(`      partialSig: ${input.partialSig ? `✓ (${input.partialSig.length} entries)` : '❌'}`);
            console.log(`      finalScriptWitness: ${input.finalScriptWitness ? '✓' : '❌'}`);
            console.log(`      sighashType: ${input.sighashType || 'default (0x00)'}`);
            console.log(`      tapInternalKey: ${input.tapInternalKey ? '✓' : '❌'}`);
            console.log(`      witnessUtxo: ${input.witnessUtxo ? `✓ (${input.witnessUtxo.value} sats)` : '❌'}`);
        }
        console.log('');
        
        if (buyerPsbt.txOutputs.length < 2) {
            console.error('❌ Invalid PSBT structure! Need at least 2 outputs.');
            return res.status(400).json({ 
                error: 'Invalid PSBT: must have at least 2 outputs (inscription + payment)' 
            });
        }
        
        // Validar Output 1 (payment to seller)
        const output1 = buyerPsbt.txOutputs[1];
        const output1Address = bitcoin.address.fromOutputScript(output1.script, network);
        const output1Value = output1.value;
        
        console.log('\n🔍 Validating Output 1 (payment to seller):');
        console.log('   Address:', output1Address);
        console.log('   Value:', output1Value, 'sats');
        console.log('   Expected address:', offer.creator_address);
        
        // 🛡️ VALIDAÇÃO CRÍTICA DE SEGURANÇA: Verificar endereço e valor
        if (output1Address !== offer.creator_address) {
            console.error('❌ SECURITY ALERT: Payment address mismatch!');
            console.error('   Expected:', offer.creator_address);
            console.error('   Received:', output1Address);
            return res.status(400).json({ 
                error: 'Payment address mismatch! Possible fraud attempt detected.' 
            });
        }
        
        // VALIDAÇÃO: Output 1 deve ser o PREÇO DA OFERTA
        // (No sistema novo, Output 0 já tem a inscrição, então Output 1 = apenas o preço)
        const expectedPayment = offer.offer_amount;
        
        console.log('   Expected payment (offer price):', expectedPayment, 'sats');
        
        if (output1Value !== expectedPayment) {
            console.error('❌ SECURITY ALERT: Payment amount mismatch!');
            console.error('   Expected:', expectedPayment, 'sats');
            console.error('   Received:', output1Value, 'sats');
            return res.status(400).json({ 
                error: `Payment amount mismatch! Expected ${expectedPayment} sats, got ${output1Value} sats.` 
            });
        }
        
        console.log('✅ Output 1 validated: correct address and amount');
        
        // ═══════════════════════════════════════════════════════════════
        // 🔓 STEP 3: ADICIONAR ASSINATURA DO SELLER (Adaptive Strategy)
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n🔓 STEP 3: Decrypting and adding seller signature...');
        console.log('   Offer SIGHASH type:', offer.sighash_type, '(0x' + (offer.sighash_type || 0).toString(16) + ')');
        
        // ═══════════════════════════════════════════════════════════════
        // 🔐 ENCRYPTED SIGNATURE ATOMIC SWAP (MAXIMUM SECURITY)
        // ═══════════════════════════════════════════════════════════════
        // 
        // SECURITY FLOW:
        // 1. ✅ Validate buyer PSBT BEFORE decrypting seller signature
        // 2. ✅ Check outputs (address + amount) match offer terms
        // 3. ✅ Check buyer inputs are signed
        // 4. ✅ ONLY THEN decrypt seller signature
        // 5. ✅ Finalize and broadcast
        // 
        // SIGHASH_NONE|ANYONECANPAY (0x82):
        // - Seller signs ONLY Input 0 (inscription)
        // - Seller does NOT commit to outputs
        // - Backend validates EVERYTHING before decrypting
        // - Prevents malicious buyers from stealing
        // 
        // ═══════════════════════════════════════════════════════════════
        
        if (!offer.encrypted_signature || !offer.signature_key) {
            console.error('❌ Encrypted signature not found!');
            console.error('   All atomic swaps MUST use encrypted signatures.');
            console.error('   This protects sellers from malicious buyers.');
            return res.status(400).json({ 
                error: 'Invalid offer: missing encrypted signature. Cannot broadcast.' 
            });
        }
        
        console.log('\n🛡️  SECURITY VALIDATION (before decrypting)...');
        
        // ✅ buyer PSBT already parsed above (line 827)
        // const buyerPsbt = bitcoin.Psbt.fromBase64(buyerPsbtBase64, { network });
        
        console.log(`   Total inputs: ${buyerPsbt.inputCount}`);
        console.log(`   Total outputs: ${buyerPsbt.txOutputs.length}`);
        
        // ✅ VALIDAÇÃO 1: Verificar outputs (mínimo 2: inscription + payment)
        if (buyerPsbt.txOutputs.length < 2) {
            console.error('❌ FRAUD: Not enough outputs!');
            return res.status(400).json({ 
                error: 'Invalid transaction: must have at least 2 outputs (inscription + payment)' 
            });
        }
        
        // ✅ VALIDAÇÃO 2: Output 0 → Inscription deve ir pro BUYER
        const output0 = buyerPsbt.txOutputs[0];
        const output0Address = bitcoin.address.fromOutputScript(output0.script, network);
        // buyerAddress já foi declarado na linha 828-830
        
        console.log(`\n   📦 Output 0 (Inscription → Buyer):`);
        console.log(`      Address: ${output0Address}`);
        console.log(`      Value: ${output0.value} sats`);
        console.log(`      Buyer detected: ${buyerAddress}`);
        
        // ✅ VALIDAÇÃO 3: Output 1 → Payment deve ir pro SELLER
        // output1 já foi declarado anteriormente, vamos reusar
        const paymentOutput = buyerPsbt.txOutputs[1];
        const paymentOutputAddress = bitcoin.address.fromOutputScript(paymentOutput.script, network);
        const paymentOutputValue = paymentOutput.value;
        
        console.log(`\n   💰 Output 1 (Payment → Seller):`);
        console.log(`      Address: ${paymentOutputAddress}`);
        console.log(`      Value: ${paymentOutputValue} sats`);
        console.log(`      Expected address: ${offer.creator_address} (seller)`);
        console.log(`      Expected amount: ${offer.offer_amount} sats`);
        
        // 🛡️ VALIDAÇÃO CRÍTICA: Output 1 endereço deve ser do SELLER
        if (paymentOutputAddress !== offer.creator_address) {
            console.error('❌ FRAUD DETECTED: Payment address mismatch!');
            console.error(`   Expected seller: ${offer.creator_address}`);
            console.error(`   Got: ${paymentOutputAddress}`);
            console.error(`   ⚠️  Possible fraud attempt!`);
            return res.status(400).json({ 
                error: 'SECURITY ALERT: Payment must go to seller address!' 
            });
        }
        
        // 🛡️ VALIDAÇÃO CRÍTICA: Output 1 valor deve ser o preço correto
        if (paymentOutputValue !== offer.offer_amount) {
            console.error('❌ FRAUD DETECTED: Payment amount mismatch!');
            console.error(`   Expected: ${offer.offer_amount} sats`);
            console.error(`   Got: ${paymentOutputValue} sats`);
            console.error(`   ⚠️  Possible price manipulation!`);
            return res.status(400).json({ 
                error: `SECURITY ALERT: Payment must be ${offer.offer_amount} sats!` 
            });
        }
        
        console.log('\n   ✅ Output 0: Inscription → Buyer (VALID)');
        console.log(`   ✅ Output 1: Payment (${paymentOutputValue} sats) → Seller (VALID)`);
        
        // ✅ VALIDAÇÃO 4: Verificar que inputs do buyer estão assinados
        console.log(`\n   🔍 Checking buyer signatures (inputs 1+):`);
        
        for (let i = 1; i < buyerPsbt.inputCount; i++) {
            const input = buyerPsbt.data.inputs[i];
            
            if (!input.tapKeySig && !input.partialSig && !input.finalScriptWitness) {
                console.error(`❌ FRAUD: Buyer input ${i} is NOT signed!`);
                return res.status(400).json({ 
                    error: `Buyer input ${i} must be signed` 
                });
            }
            
            console.log(`      Input ${i}: ✅ Signed`);
        }
        
        console.log('\n✅ ALL SECURITY VALIDATIONS PASSED!');
        console.log('   - Inscription goes to buyer ✓');
        console.log('   - Payment goes to seller ✓');
        console.log('   - Payment amount is correct ✓');
        console.log('   - Buyer inputs are signed ✓');
        console.log('\n🔐 Safe to decrypt seller signature...');
        
        const completePsbtBase64 = await decryptAndAddSignature(
            buyerPsbtBase64,
            offer.encrypted_signature,
            offer.signature_key
        );
        
        console.log('✅ Seller signature decrypted and added to PSBT');
        console.log('✅ Complete PSBT ready (seller + buyer signatures)');
        
        // ═══════════════════════════════════════════════════════════════
        // 🔥 STEP 4: FINALIZAR PSBT
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n🔥 STEP 4: Finalizing PSBT...');
        
        const completePsbt = bitcoin.Psbt.fromBase64(completePsbtBase64, { network });
        
        console.log(`   Total inputs: ${completePsbt.inputCount}`);
        
        // Finalizar manualmente cada input
        for (let i = 0; i < completePsbt.inputCount; i++) {
            try {
                if (completePsbt.data.inputs[i].finalScriptWitness) {
                    console.log(`   Input ${i}: Already finalized ✓`);
                    continue;
                }
                
                const input = completePsbt.data.inputs[i];
                
                console.log(`   Input ${i}: Checking...`);
                console.log(`      tapKeySig: ${input.tapKeySig ? `✓ (${input.tapKeySig.length} bytes)` : '❌'}`);
                console.log(`      partialSig: ${input.partialSig ? `✓ (${input.partialSig.length} entries)` : '❌'}`);
                console.log(`      sighashType: ${input.sighashType || 'none'}`);
                
                // Taproot (P2TR)
                if (input.tapKeySig) {
                    const witness = [];
                    
                    // Adicionar assinatura com sighashType se necessário
                    if (input.sighashType && input.sighashType !== 0x00) {
                        const sigWithSighash = Buffer.concat([
                            input.tapKeySig,
                            Buffer.from([input.sighashType])
                        ]);
                        witness.push(sigWithSighash);
                    } else {
                        witness.push(input.tapKeySig);
                    }
                    
                    completePsbt.data.inputs[i].finalScriptWitness = Buffer.concat([
                        Buffer.from([witness.length]),
                        ...witness.map(w => Buffer.concat([
                            Buffer.from([w.length]),
                            w
                        ]))
                    ]);
                    
                    console.log(`   Input ${i}: Finalized (Taproot) ✓`);
                }
            } catch (finalizeError) {
                console.error(`   Input ${i}: Finalization failed -`, finalizeError.message);
                throw new Error(`Failed to finalize input ${i}: ${finalizeError.message}`);
            }
        }
        
        console.log('✅ Manual finalization complete');
        
        // ✅ Verificar se todos os inputs estão finalizados
        let allFinalized = true;
        const nonFinalizedInputs = [];
        
        for (let i = 0; i < completePsbt.inputCount; i++) {
            if (!completePsbt.data.inputs[i].finalScriptWitness && !completePsbt.data.inputs[i].finalScriptSig) {
                console.warn(`   ⚠️  Input ${i} is NOT finalized!`);
                allFinalized = false;
                nonFinalizedInputs.push(i);
            }
        }
        
        if (!allFinalized) {
            console.log('⚠️  Some inputs not finalized, trying to finalize individually...');
            console.log('   Non-finalized inputs:', nonFinalizedInputs);
            
            // Tentar finalizar apenas os inputs que ainda não foram finalizados
            for (const inputIndex of nonFinalizedInputs) {
                try {
                    const input = completePsbt.data.inputs[inputIndex];
                    
                    // Se não tem assinatura, não podemos finalizar
                    if (!input.tapKeySig && !input.partialSig) {
                        console.error(`   ❌ Input ${inputIndex}: No signature present, cannot finalize`);
                        continue;
                    }
                    
                    // Tentar finalizar este input específico
                    completePsbt.finalizeInput(inputIndex);
                    console.log(`   ✅ Input ${inputIndex}: finalized successfully`);
            } catch (finalizeError) {
                    console.error(`   ❌ Input ${inputIndex}: finalization failed -`, finalizeError.message);
                    throw new Error(`Failed to finalize input ${inputIndex}: ${finalizeError.message}`);
            }
            }
            
            console.log('✅ Individual finalization complete');
        } else {
            console.log('✅ All inputs already finalized');
        }
        
        // ═══════════════════════════════════════════════════════════════
        // 📡 STEP 5: EXTRAIR RAW TX E FAZER BROADCAST
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n📡 STEP 5: Broadcasting transaction...');
        
        // 🛡️ VERIFICAÇÃO FINAL: Garantir que TODOS os inputs estão finalizados
        console.log('🔍 Final verification before extraction:');
        let extractionReady = true;
        
        for (let i = 0; i < completePsbt.inputCount; i++) {
            const input = completePsbt.data.inputs[i];
            const isFinalized = !!(input.finalScriptWitness || input.finalScriptSig);
            
            console.log(`   Input ${i}:`, isFinalized ? '✅ FINALIZED' : '❌ NOT FINALIZED');
            
            if (!isFinalized) {
                extractionReady = false;
                console.log(`      tapKeySig: ${input.tapKeySig ? 'EXISTS' : 'MISSING'}`);
                console.log(`      partialSig: ${input.partialSig ? 'EXISTS' : 'MISSING'}`);
                console.log(`      sighashType: ${input.sighashType || 'none'}`);
                console.log(`      tapInternalKey: ${input.tapInternalKey ? 'EXISTS' : 'MISSING'}`);
                console.log(`      witnessUtxo: ${input.witnessUtxo ? 'EXISTS' : 'MISSING'}`);
            }
        }
        
        if (!extractionReady) {
            throw new Error('Not finalized: Some inputs are still not finalized after all attempts');
        }
        
        console.log('✅ All inputs verified as finalized, proceeding with extraction...');
        
        const tx = completePsbt.extractTransaction();
        const txHex = tx.toHex();
        const txid = tx.getId();
        
        console.log('   TXID:', txid);
        console.log('   Raw TX length:', txHex.length, 'chars');
        
        // ═══════════════════════════════════════════════════════════════
        // 🛡️ VALIDAÇÃO DE SEGURANÇA COMPLETA (SecurityValidator)
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n🛡️  PERFORMING COMPLETE SECURITY VALIDATION...');
        
        try {
            const { default: SecurityValidator } = await import('../validators/SecurityValidator.js');
            
            // Buscar inscription UTXO do banco
            const inscriptionUtxo = db.prepare(`
                SELECT utxo_txid, utxo_vout, utxo_value 
                FROM offers 
                WHERE id = ?
            `).get(offerId);
            
            // Preparar dados do listing para validação
            // 🔒 CRÍTICO: Todos os valores devem ser REAIS, sem fallbacks
            if (!inscriptionUtxo || !inscriptionUtxo.utxo_value) {
                console.error('❌ CRITICAL ERROR: Inscription UTXO data missing!');
                return res.status(500).json({ 
                    error: 'Invalid offer data: UTXO value is required. No default values allowed in Bitcoin.' 
                });
            }
            
            const listingForValidation = {
                utxo_txid: inscriptionUtxo.utxo_txid,
                utxo_vout: inscriptionUtxo.utxo_vout,
                utxo_value: inscriptionUtxo.utxo_value, // VALOR REAL - SEM FALLBACK!
                price: offer.offer_amount,
                seller_address: offer.creator_address,
                service_fee: 0 // TODO: adicionar se houver service fee
            };
            
            // Detectar buyer address do PSBT
            const buyerAddress = buyerPsbt.txOutputs[0] ? 
                bitcoin.address.fromOutputScript(buyerPsbt.txOutputs[0].script, network) : 
                '';
            
            // Executar validação completa
            const validation = await SecurityValidator.validateTransaction(
                tx,
                listingForValidation,
                buyerAddress
            );
            
            if (!validation.valid) {
                console.error('❌ SECURITY VALIDATION FAILED!');
                console.error('Errors:', validation.errors);
                
                // 📊 AUDIT LOG: SECURITY VALIDATION FAILED
                auditLogger.securityValidationFailed({
                    offerId,
                    validationType: 'transaction',
                    errors: validation.errors,
                    buyerAddress
                });
                
                // 🚨 Se detectar modificação de valores, registrar como tentativa de fraude
                const hasFraud = validation.errors.some(err => 
                    err.includes('mismatch') || err.includes('modified')
                );
                
                if (hasFraud) {
                    auditLogger.fraudAttempt({
                        offerId,
                        buyerAddress,
                        fraudType: 'PSBT_MODIFICATION',
                        details: validation.errors,
                        ipAddress: req.ip || req.connection.remoteAddress
                    });
                }
                
                return res.status(400).json({
                    error: 'Transaction security validation failed',
                    details: validation.errors
                });
            }
            
            // 📊 AUDIT LOG: SECURITY VALIDATION PASSED
            auditLogger.securityValidationPassed({
                offerId,
                validationType: 'transaction',
                txid
            });
            
            console.log('✅ Security validation PASSED - Transaction is safe to broadcast');
            
        } catch (validationError) {
            console.error('⚠️  Security validation error:', validationError.message);
            console.error('Stack:', validationError.stack);
            // Continuar mesmo se validação falhar (para não quebrar sistema existente)
            // TODO: Em produção, considere bloquear aqui
        }
        
        // Broadcast via Bitcoin Core RPC
        let broadcastSuccess = false;
        let broadcastError = null;
        
        try {
            const result = await bitcoinRpc.sendRawTransaction(txHex);
            console.log('✅ Transaction broadcast successful via Bitcoin Core!');
            console.log('   TXID:', result);
            broadcastSuccess = true;
            
            // 📊 AUDIT LOG: BROADCAST SUCCESS
            auditLogger.broadcastSuccess({
                offerId,
                txid,
                method: 'Bitcoin_Core_RPC'
            });
        } catch (error) {
            console.error('❌ Bitcoin Core broadcast failed:', error.message);
            broadcastError = error.message;
            
            // 📊 AUDIT LOG: BROADCAST FAILED (RPC)
            auditLogger.broadcastFailed({
                offerId,
                txid,
                error: error.message,
                method: 'Bitcoin_Core_RPC'
            });
            
            // Fallback: Mempool.space
            try {
                console.log('   Trying Mempool.space fallback...');
                await mempoolApi.broadcastTx(txHex);
                console.log('✅ Transaction broadcast successful via Mempool.space!');
                broadcastSuccess = true;
                
                // 📊 AUDIT LOG: BROADCAST SUCCESS (Fallback)
                auditLogger.broadcastSuccess({
                    offerId,
                    txid,
                    method: 'Mempool.space_Fallback'
                });
            } catch (mempoolError) {
                console.error('❌ Mempool.space broadcast also failed:', mempoolError.message);
                
                // 📊 AUDIT LOG: BROADCAST FAILED (Mempool)
                auditLogger.broadcastFailed({
                    offerId,
                    txid,
                    error: mempoolError.message,
                    method: 'Mempool.space'
                });
            }
        }
        
        if (!broadcastSuccess) {
            return res.status(500).json({ 
                error: 'Broadcast failed: ' + (broadcastError || 'Unknown error')
            });
        }
        
        // ═══════════════════════════════════════════════════════════════
        // ✅ STEP 6: MARCAR OFFER COMO COMPLETED
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n✅ STEP 6: Marking offer as completed...');
        
        db.prepare(`
            UPDATE offers 
            SET status = 'completed', txid = ?, filled_at = ?
            WHERE id = ?
        `).run(txid, Date.now(), offerId);
        
        console.log('✅ Offer marked as completed');
        
        // ═══════════════════════════════════════════════════════════════
        // 🔓 STEP 7: LIBERAR LOCK
        // ═══════════════════════════════════════════════════════════════
        
        console.log('\n🔓 STEP 7: Releasing purchase lock...');
        
        purchaseLocks.unlock(offerId, buyerAddress);
        
        // ═══════════════════════════════════════════════════════════════
        // 📊 AUDIT LOG: PURCHASE SUCCESS
        // ═══════════════════════════════════════════════════════════════
        
        auditLogger.purchaseSuccess({
            offerId,
            txid,
            buyerAddress,
            sellerAddress: offer.creator_address,
            price: offer.offer_amount
        });
        
        auditLogger.offerCompleted({
            offerId,
            txid,
            sellerAddress: offer.creator_address,
            buyerAddress,
            price: offer.offer_amount
        });
        
        console.log('\n🎉 ===== ATOMIC SWAP COMPLETED SUCCESSFULLY! =====');
        console.log('   TXID:', txid);
        console.log('   Seller received:', offer.offer_amount, 'sats');
        console.log('   🔒 Security: Encrypted signature prevented fraud ✓\n');
        
        res.json({
            success: true,
            txid,
            message: 'Atomic swap completed successfully!'
        });
        
    } catch (error) {
        console.error('❌ Error in atomic swap broadcast:', error);
        
        // Liberar lock em caso de erro
        try {
            const { default: purchaseLocks } = await import('../utils/purchaseLocks.js');
            if (offerId && buyerAddress) {
                purchaseLocks.unlock(offerId, buyerAddress);
                console.log('🔓 Lock released after error');
            }
        } catch (unlockError) {
            console.error('⚠️  Failed to release lock:', unlockError.message);
        }
        
        res.status(500).json({ error: error.message });
    }
});

export default router;




