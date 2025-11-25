import express from 'express';
import axios from 'axios';
import bitcoinRpc from '../utils/bitcoinRpc.js';
import quicknode from '../utils/quicknode.js';
import runesDecoder from '../utils/runesDecoder.js';
import { getRuneWithParent } from '../utils/runeIdCache.js';
import { db } from '../db/init-supabase.js';

const router = express.Router();
const USE_QUICKNODE = process.env.QUICKNODE_ENABLED === 'true';

/**
 * GET /api/explorer/tx/:txid
 * Busca informações completas de uma transação
 */
router.get('/tx/:txid', async (req, res) => {
    try {
        const { txid } = req.params;
        console.log(`\n🔍 ========== EXPLORER TX REQUEST ==========`);
        console.log(`📊 TXID: ${txid}`);
        
        // 1. Buscar TX do Bitcoin Node (dados brutos da blockchain)
        console.log('   📡 Fetching from Bitcoin RPC...');
        let txData = null;
        let blockData = null;
        
        try {
            txData = await bitcoinRpc.getRawTransaction(txid, true);
            console.log(`   ✅ Got TX data: ${txData.vin.length} inputs, ${txData.vout.length} outputs`);
            
            // Se estiver confirmada, buscar dados do bloco
            if (txData.blockhash) {
                try {
                    blockData = await bitcoinRpc.getBlock(txData.blockhash);
                    console.log(`   ✅ Got block data: height ${blockData.height}`);
                } catch (blockError) {
                    console.warn(`   ⚠️  Could not fetch block data:`, blockError.message);
                }
            }
        } catch (rpcError) {
            console.error(`   ❌ Bitcoin RPC error:`, rpcError.message);
            // Se falhar, tentar buscar do mempool.space
            console.log('   📡 Fallback to mempool.space API...');
            const mempoolResponse = await axios.get(`https://mempool.space/api/tx/${txid}`);
            txData = mempoolResponse.data;
            console.log(`   ✅ Got TX data from mempool.space`);
            
            // Se estiver confirmada, criar blockData a partir do status
            if (txData.status && txData.status.confirmed) {
                blockData = {
                    height: txData.status.block_height,
                    hash: txData.status.block_hash,
                    time: txData.status.block_time,
                    nTx: 0 // Não disponível no mempool.space
                };
                txData.blockhash = txData.status.block_hash;
                txData.confirmations = await getConfirmations(txData.status.block_height);
                console.log(`   ✅ Block data from mempool: height ${blockData.height}, ${txData.confirmations} confirmations`);
            } else {
                txData.confirmations = 0;
            }
        }
        
        // 2. Buscar Inscriptions E Runes verificando cada output via QuickNode
        console.log(`   📡 Fetching inscriptions/runes via QuickNode ord_getOutput...`);
        let inscriptions = [];
        let runesFromOutputsData = []; // Runes detectadas nos outputs
        let runes = null;
        
        if (USE_QUICKNODE && txData && txData.vout) {
            try {
                // Verificar cada output para inscriptions E runes
                for (let i = 0; i < txData.vout.length; i++) {
                    try {
                        const outpoint = `${txid}:${i}`;
                        const outputData = await quicknode.getOutput(outpoint);
                        
                        // Inscriptions
                        if (outputData.inscriptions && outputData.inscriptions.length > 0) {
                            for (const inscId of outputData.inscriptions) {
                                console.log(`      ✅ Found inscription in output ${i}: ${inscId}`);
                                
                                const inscData = await quicknode.getInscription(inscId);
                                
                                inscriptions.push({
                                    inscriptionId: inscId,
                                    inscriptionNumber: inscData.number,
                                    contentUrl: `http://localhost:4000/api/rune-thumbnail/${inscId}`,
                                    inscriptionUrl: `https://ordinals.com/inscription/${inscId}`,
                                    preview: `https://ordinals.com/preview/${inscId}`,
                                    output: i
                                });
                            }
                        }
                        
                        // Runes (QuickNode retorna diretamente!)
                        if (outputData.runes && Object.keys(outputData.runes).length > 0) {
                            for (const [runeName, runeInfo] of Object.entries(outputData.runes)) {
                                console.log(`      ✅ Found rune in output ${i}: ${runeName}`);
                                
                                runesFromOutputsData.push({
                                    output: i,
                                    name: runeName,
                                    amount: runeInfo.amount,
                                    divisibility: runeInfo.divisibility,
                                    symbol: runeInfo.symbol
                                });
                            }
                        }
                    } catch (outputError) {
                        // Output vazio, continuar
                    }
                }
                
                console.log(`   🖼️  Found ${inscriptions.length} inscription(s) total`);
                console.log(`   🪙 Found ${runesFromOutputsData.length} rune(s) in outputs`);
                
            } catch (qnError) {
                console.warn(`   ⚠️  QuickNode failed:`, qnError.message);
            }
        }
        
        // 3. Se não encontrou Runes no Ord Server, tentar decodificar do OP_RETURN
        if (!runes && txData && txData.vout) {
            console.log('   🔍 Trying to decode Runestone from OP_RETURN...');
            runes = decodeRunestoneFromOutputs(txData.vout);
            if (runes) {
                console.log(`   ✅ Decoded Runestone: ${runes.edicts?.length || 0} edict(s)`);
            }
        }
        
        // Inscriptions já foram buscadas via ord_getOutput acima (linhas 68-101)
        // Não precisa buscar novamente
        
        // 4. Calcular análises da transação
        const analysis = analyzeTx(txData, blockData);
        console.log(`   📊 Analysis: ${analysis.fee} sats fee, ${analysis.feeRate} sat/vB`);
        
        // 4.5. Buscar runes nos outputs individuais
        let runesFromOutputs = [];
        if (txData && txData.vout) {
            console.log('   🔍 Checking outputs for runes...');
            runesFromOutputs = await fetchRunesFromOutputs(txData.txid, txData.vout);
            console.log(`   ⧈ Found ${runesFromOutputs.length} rune(s) in outputs`);
        }
        
        // 5. Retornar resposta completa
        // 5. Enriquecer Inputs/Outputs com informações de Runes e Inscriptions
        console.log('   📡 Enriching inputs/outputs...');
        const enrichedVout = await enrichOutputs(txData.vout, txData.txid, runes, inscriptions, runesFromOutputsData);
        const enrichedVin = await enrichInputs(txData.vin);
        
        const response = {
            success: true,
            tx: {
                txid: txData.txid,
                version: txData.version,
                locktime: txData.locktime,
                size: txData.size || txData.weight / 4,
                weight: txData.weight || txData.size * 4,
                vin: enrichedVin,
                vout: enrichedVout,
                blockhash: txData.blockhash,
                confirmations: txData.confirmations || 0,
                time: txData.time,
                blocktime: txData.blocktime
            },
            block: blockData ? {
                height: blockData.height,
                hash: blockData.hash,
                time: blockData.time,
                nTx: blockData.nTx
            } : null,
            inscriptions,
            runes,
            analysis,
            ordServerAvailable: true
        };
        
        console.log(`✅ Explorer data prepared for ${txid}`);
        console.log('=========================================\n');
        
        return res.json(response);
        
    } catch (error) {
        console.error('❌ Explorer error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse inscriptions do HTML do Ord Server
 */
function parseInscriptionsFromHtml(html, txid) {
    const inscriptions = [];
    
    try {
        // Procurar por inscrições no HTML
        // Formato: <a href=/inscription/INSCRIPTION_ID>INSCRIPTION_NUMBER</a>
        const inscriptionPattern = /<a\s+href=\/inscription\/([a-f0-9]{64}i\d+)>([^<]+)<\/a>/gi;
        let match;
        
        while ((match = inscriptionPattern.exec(html)) !== null) {
            const inscriptionId = match[1];
            const inscriptionNumber = match[2].replace('#', '').trim();
            
            inscriptions.push({
                inscriptionId,
                inscriptionNumber,
                contentUrl: `${process.env.ORD_SERVER_URL || 'http://127.0.0.1:80'}/content/${inscriptionId}`,
                inscriptionUrl: `${process.env.ORD_SERVER_URL || 'http://127.0.0.1:80'}/inscription/${inscriptionId}`
            });
        }
    } catch (error) {
        console.error('Error parsing inscriptions:', error);
    }
    
    return inscriptions;
}

/**
 * Parse Runes do HTML do Ord Server
 */
function parseRunesFromHtml(html) {
    try {
        // Procurar por Runestone no HTML
        // O ord server mostra o Runestone decodificado
        const runestoneMatch = html.match(/<h2>Runestone<\/h2>([\s\S]*?)<\/dl>/i);
        if (!runestoneMatch) {
            return null;
        }
        
        const runestoneSection = runestoneMatch[1];
        
        // Extrair edicts
        const edictsMatch = runestoneSection.match(/<dt>edicts<\/dt>\s*<dd><ul>([\s\S]*?)<\/ul><\/dd>/i);
        let edicts = [];
        
        if (edictsMatch) {
            const edictsHtml = edictsMatch[1];
            const edictPattern = /<li>(\d+:\d+)→(\d+):(\d+)<\/li>/g;
            let edictMatch;
            
            while ((edictMatch = edictPattern.exec(edictsHtml)) !== null) {
                const runeId = edictMatch[1];
                const amount = edictMatch[2];
                const output = edictMatch[3];
                
                edicts.push({
                    runeId,
                    amount,
                    output: parseInt(output)
                });
            }
        }
        
        // Extrair cenotaph (se houver)
        const isCenotaph = runestoneSection.includes('<dt>cenotaph</dt>');
        
        return {
            edicts,
            isCenotaph,
            raw: runestoneSection
        };
    } catch (error) {
        console.error('Error parsing runes:', error);
        return null;
    }
}

/**
 * Decodificar Runestone diretamente do OP_RETURN
 */
function decodeRunestoneFromOutputs(vout) {
    try {
        // Procurar output com OP_RETURN que começa com 6a5d (OP_RETURN + OP_PUSHNUM_13)
        for (const output of vout) {
            const script = output.scriptpubkey || output.scriptPubKey?.hex;
            if (!script || !script.startsWith('6a5d')) {
                continue;
            }
            
            console.log(`   📜 Found OP_RETURN: ${script}`);
            
            // Decodificar LEB128
            const payload = script.substring(6); // Pular 6a5d e length byte
            const buffer = [];
            for (let i = 0; i < payload.length; i += 2) {
                buffer.push(parseInt(payload.substring(i, i + 2), 16));
            }
            
            // Função LEB128
            function decodeLEB128(bytes, offset = 0) {
                let result = 0;
                let shift = 0;
                let i = offset;
                
                while (i < bytes.length) {
                    const byte = bytes[i++];
                    result |= (byte & 0x7F) << shift;
                    shift += 7;
                    
                    if (!(byte & 0x80)) {
                        break;
                    }
                }
                
                return { value: result, nextOffset: i };
            }
            
            // Decodificar valores
            let offset = 0;
            const values = [];
            while (offset < buffer.length && values.length < 6) {
                const decoded = decodeLEB128(buffer, offset);
                values.push(decoded.value);
                offset = decoded.nextOffset;
            }
            
            if (values.length < 3) {
                continue;
            }
            
            const tag = values[0];
            const isCenotaph = tag !== 0;
            
            let edicts = [];
            
            if (isCenotaph) {
                // Cenotaph: valores deslocados
                if (values.length >= 5) {
                    edicts.push({
                        runeId: `${values[2]}:${values[3]}`,
                        amount: values[4].toString(),
                        output: values[5] || 0
                    });
                }
            } else {
                // Normal: Tag 0
                if (values.length >= 5) {
                    edicts.push({
                        runeId: `${values[1]}:${values[2]}`,
                        amount: values[3].toString(),
                        output: values[4]
                    });
                }
            }
            
            return {
                edicts,
                isCenotaph,
                tag,
                raw: script
            };
        }
    } catch (error) {
        console.error('Error decoding Runestone:', error);
    }
    
    return null;
}

/**
 * Analisar transação (fee, fee rate, etc)
 */
function analyzeTx(txData, blockData) {
    const analysis = {
        fee: 0,
        feeRate: 0,
        size: txData.size || Math.ceil(txData.weight / 4),
        weight: txData.weight || txData.size * 4,
        vsize: txData.vsize || Math.ceil(txData.weight / 4),
        confirmations: txData.confirmations || 0,
        confirmed: !!txData.blockhash,
        timestamp: txData.time || txData.blocktime,
        blockHeight: blockData?.height
    };
    
    // Calcular fee
    try {
        let inputValue = 0;
        let outputValue = 0;
        
        // Somar inputs
        for (const vin of txData.vin) {
            if (vin.prevout) {
                inputValue += vin.prevout.value;
            }
        }
        
        // Somar outputs
        for (const vout of txData.vout) {
            outputValue += vout.value;
        }
        
        analysis.fee = inputValue - outputValue;
        analysis.feeRate = analysis.fee > 0 ? (analysis.fee / analysis.vsize).toFixed(2) : 0;
    } catch (error) {
        console.error('Error calculating fee:', error);
    }
    
    return analysis;
}

/**
 * GET /api/explorer/address/:address
 * Busca informações completas de um endereço
 */
router.get('/address/:address', async (req, res) => {
    try {
        const { address } = req.params;
        console.log(`\n🔍 ========== EXPLORER ADDRESS REQUEST ==========`);
        console.log(`📍 Address: ${address}`);
        
        // 1. Buscar saldo de Bitcoin (Mempool.space API)
        console.log('   📡 Fetching Bitcoin balance from mempool.space...');
        let btcBalance = { confirmed: 0, unconfirmed: 0, total: 0 };
        let utxos = [];
        
        try {
            const balanceResponse = await axios.get(`https://mempool.space/api/address/${address}`, {
                timeout: 15000
            });
            const balanceData = balanceResponse.data;
            
            btcBalance = {
                confirmed: balanceData.chain_stats.funded_txo_sum - balanceData.chain_stats.spent_txo_sum,
                unconfirmed: balanceData.mempool_stats.funded_txo_sum - balanceData.mempool_stats.spent_txo_sum,
                total: (balanceData.chain_stats.funded_txo_sum - balanceData.chain_stats.spent_txo_sum) + 
                       (balanceData.mempool_stats.funded_txo_sum - balanceData.mempool_stats.spent_txo_sum)
            };
            
            console.log(`   ✅ Bitcoin balance: ${btcBalance.total} sats`);
        } catch (error) {
            console.error('   ❌ Error fetching balance:', error.message);
        }
        
        // 2. Buscar UTXOs (Mempool.space API)
        console.log('   📡 Fetching UTXOs from mempool.space...');
        try {
            const utxosResponse = await axios.get(`https://mempool.space/api/address/${address}/utxo`, {
                timeout: 15000
            });
            utxos = utxosResponse.data.map(utxo => ({
                txid: utxo.txid,
                vout: utxo.vout,
                value: utxo.value,
                status: utxo.status
            }));
            
            console.log(`   ✅ Found ${utxos.length} UTXOs`);
        } catch (error) {
            console.error('   ❌ Error fetching UTXOs:', error.message);
        }
        
        // 3. Buscar Inscriptions escaneando UTXOs via QuickNode
        console.log('   📡 Scanning UTXOs for inscriptions...');
        let inscriptions = [];
        
        try {
            // Buscar TODAS as transações (com paginação)
            let transactions = [];
            let lastTxid = null;
            let page = 1;
            
            console.log('   📡 Fetching ALL transactions (with pagination)...');
            
            while (page <= 10) { // Máximo 10 páginas (500 TXs)
                const url = lastTxid 
                    ? `https://mempool.space/api/address/${address}/txs/chain/${lastTxid}`
                    : `https://mempool.space/api/address/${address}/txs`;
                
                const txsResponse = await axios.get(url, { timeout: 15000 });
                const txs = txsResponse.data;
                
                if (txs.length === 0) break;
                
                transactions = transactions.concat(txs);
                lastTxid = txs[txs.length - 1].txid;
                
                console.log(`      Page ${page}: ${txs.length} TXs (total: ${transactions.length})`);
                
                if (txs.length < 50) break; // Última página
                page++;
            }
            
            console.log(`   ✅ Total transactions to scan: ${transactions.length}`);
            
            for (const tx of transactions) {
                for (let vout = 0; vout < tx.vout.length; vout++) {
                    const output = tx.vout[vout];
                    
                    if (output.scriptpubkey_address === address) {
                        try {
                            // Verificar se UTXO ainda existe
                            const txout = await quicknode.call('gettxout', [tx.txid, vout, true]);
                            
                            if (txout) {
                                const outpoint = `${tx.txid}:${vout}`;
                                const outputData = await quicknode.getOutput(outpoint);
                                
                                if (outputData.inscriptions && outputData.inscriptions.length > 0) {
                                    for (const inscId of outputData.inscriptions) {
                                        const inscData = await quicknode.getInscription(inscId);
                                        
                                        inscriptions.push({
                                            id: inscId,
                                            number: inscData.number,
                                            contentUrl: `http://localhost:4000/api/rune-thumbnail/${inscId}`,
                                            inscriptionUrl: `https://ordinals.com/inscription/${inscId}`,
                                            preview: `https://ordinals.com/preview/${inscId}`
                                        });
                                        
                                        console.log(`      ✅ Found inscription: #${inscData.number}`);
                                    }
                                }
                            }
                        } catch (e) {
                            // UTXO gasto ou erro
                        }
                    }
                }
            }
            
            console.log(`   ✅ Found ${inscriptions.length} inscriptions total`);
        } catch (error) {
            console.error('   ❌ Error fetching inscriptions:', error.message);
        }
        
        // 4. Buscar Runes escaneando UTXOs via QuickNode
        console.log('   📡 Scanning UTXOs for runes...');
        let runes = [];
        const runesMap = new Map();
        
        try {
            // Buscar TODAS as transações (com paginação - mesmo código acima)
            let transactions = [];
            let lastTxid = null;
            let page = 1;
            
            while (page <= 20) { // Até 1000 TXs (20 páginas)
                const url = lastTxid 
                    ? `https://mempool.space/api/address/${address}/txs/chain/${lastTxid}`
                    : `https://mempool.space/api/address/${address}/txs`;
                
                const txsResponse = await axios.get(url, { timeout: 15000 });
                const txs = txsResponse.data;
                
                if (txs.length === 0) break;
                
                transactions = transactions.concat(txs);
                lastTxid = txs[txs.length - 1].txid;
                
                console.log(`      Page ${page}: ${txs.length} TXs (total: ${transactions.length})`);
                
                if (txs.length < 25) break; // Última página (Mempool retorna menos no final)
                page++;
            }
            
            for (const tx of transactions) {
                for (let vout = 0; vout < tx.vout.length; vout++) {
                    const output = tx.vout[vout];
                    
                    if (output.scriptpubkey_address === address) {
                        try {
                            const txout = await quicknode.call('gettxout', [tx.txid, vout, true]);
                            
                            if (txout) {
                                const outpoint = `${tx.txid}:${vout}`;
                                const outputData = await quicknode.getOutput(outpoint);
                                
                                if (outputData.runes && Object.keys(outputData.runes).length > 0) {
                                    for (const [name, info] of Object.entries(outputData.runes)) {
                                        if (!runesMap.has(name)) {
                                            runesMap.set(name, {
                                                amount: 0,
                                                symbol: info.symbol,
                                                divisibility: info.divisibility,
                                                utxos: []
                                            });
                                        }
                                        
                                        const current = runesMap.get(name);
                                        current.amount += info.amount;
                                        current.utxos.push({
                                            txid: tx.txid,
                                            vout,
                                            amount: info.amount,
                                            value: output.value
                                        });
                                        
                                        console.log(`      ✅ Found rune: ${name} (+${info.amount})`);
                                    }
                                }
                            }
                        } catch (e) {
                            // Continuar
                        }
                    }
                }
            }
            
            // Converter para array com detalhes E BUSCAR PARENTS
            for (const [name, info] of runesMap) {
                const displayAmount = info.amount / Math.pow(10, info.divisibility);
                
                // Buscar parent/thumbnail
                let thumbnail = null;
                try {
                    const runeWithParent = await getRuneWithParent(name);
                    thumbnail = runeWithParent.thumbnail;
                    console.log(`      🖼️  ${name}: ${thumbnail ? 'Has thumbnail' : 'No parent, using emoji'}`);
                } catch (e) {
                    console.warn(`      ⚠️  Could not get parent for ${name}`);
                }
                
                runes.push({
                    name,
                    displayName: `${name} ${info.symbol}`,
                    symbol: info.symbol,
                    amount: displayAmount,
                    rawAmount: info.amount,
                    divisibility: info.divisibility,
                    utxos: info.utxos,
                    thumbnail
                });
            }
            
            console.log(`   ✅ Found ${runes.length} runes total`);
        } catch (error) {
            console.error('   ❌ Error fetching runes:', error.message);
        }
        
        // 5. Buscar histórico de transações (últimas 50)
        console.log('   📡 Fetching transaction history...');
        let transactions = [];
        
        try {
            const txsResponse = await axios.get(`https://mempool.space/api/address/${address}/txs`, {
                timeout: 15000
            });
            
            transactions = txsResponse.data.slice(0, 50).map(tx => ({
                txid: tx.txid,
                confirmed: !!tx.status.confirmed,
                blockHeight: tx.status.block_height,
                blockTime: tx.status.block_time,
                fee: tx.fee,
                size: tx.size,
                weight: tx.weight
            }));
            
            console.log(`   ✅ Found ${transactions.length} transactions`);
        } catch (error) {
            console.error('   ❌ Error fetching transactions:', error.message);
        }
        
        console.log(`✅ ========== ADDRESS DATA COMPLETE ==========\n`);
        
        res.json({
            success: true,
            address,
            bitcoin: btcBalance,
            utxos,
            inscriptions,
            runes,
            transactions
        });
        
    } catch (error) {
        console.error('❌ Error in /address endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Calcular confirmações a partir do block height
 */
async function getConfirmations(blockHeight) {
    try {
        // Buscar o tip (altura atual) do blockchain
        const tipResponse = await axios.get('https://mempool.space/api/blocks/tip/height');
        const currentHeight = tipResponse.data;
        return currentHeight - blockHeight + 1;
    } catch (error) {
        console.error('Error getting confirmations:', error.message);
        return 0;
    }
}

/**
 * Buscar inscriptions nos outputs individuais
 */
async function fetchInscriptionsFromOutputs(txid, outputs) {
    const inscriptions = [];
    const ORD_URL = process.env.ORD_SERVER_URL || 'http://127.0.0.1:80';
    
    try {
        const outputPromises = outputs.map(async (output, index) => {
            try {
                const outputUrl = `${ORD_URL}/output/${txid}:${index}`;
                const response = await axios.get(outputUrl, {
                    timeout: 5000,
                    headers: { 'Accept': 'text/html' },
                    family: 4
                });
                
                const html = response.data;
                const inscriptionPattern = /<a href=\/inscription\/([a-f0-9]{64}i\d+)>/gi;
                let match;
                
                while ((match = inscriptionPattern.exec(html)) !== null) {
                    const inscriptionId = match[1];
                    
                    // Buscar número da inscription
                    let inscriptionNumber = null;
                    try {
                        const inscResponse = await axios.get(`${ORD_URL}/inscription/${inscriptionId}`, {
                            timeout: 5000,
                            family: 4
                        });
                        const inscHtml = inscResponse.data;
                        // Buscar no <title>Inscription XXXXXX</title>
                        const titleMatch = inscHtml.match(/<title>Inscription\s+(\d+)<\/title>/i);
                        if (titleMatch) {
                            inscriptionNumber = parseInt(titleMatch[1]);
                        }
                    } catch (err) {
                        console.warn(`      ⚠️  Could not fetch inscription number for ${inscriptionId}`);
                    }
                    
                    inscriptions.push({
                        inscriptionId,
                        inscriptionNumber,
                        contentUrl: `/api/ordinals/${inscriptionId}/content`,
                        inscriptionUrl: `${ORD_URL}/inscription/${inscriptionId}`,
                        preview: `/api/ordinals/${inscriptionId}/content`,
                        outputIndex: index
                    });
                }
            } catch (err) {
                // Silent fail
            }
        });
        
        await Promise.all(outputPromises);
    } catch (error) {
        console.error('Error fetching inscriptions from outputs:', error);
    }
    
    return inscriptions;
}

/**
 * Buscar runes nos outputs individuais
 */
async function fetchRunesFromOutputs(txid, outputs) {
    const runesData = [];
    const ORD_URL = process.env.ORD_SERVER_URL || 'http://127.0.0.1:80';
    
    try {
        const outputPromises = outputs.map(async (output, index) => {
            try {
                const outputUrl = `${ORD_URL}/output/${txid}:${index}`;
                const response = await axios.get(outputUrl, {
                    timeout: 5000,
                    headers: { 'Accept': 'text/html' },
                    family: 4
                });
                
                const html = response.data;
                const runePattern = /<td><a href=\/rune\/([^>]+)>([^<]+)<\/a><\/td>\s*<td>(\d+)\s*([^<]*)<\/td>/gi;
                let match;
                
                while ((match = runePattern.exec(html)) !== null) {
                    const runeName = match[2];
                    const amount = match[3];
                    const symbol = match[4].trim();
                    
                    let runeId = null;
                    try {
                        const runeResponse = await axios.get(`${ORD_URL}/rune/${runeName}`, {
                            timeout: 5000,
                            family: 4
                        });
                        const runeHtml = runeResponse.data;
                        const runeIdMatch = runeHtml.match(/id<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i);
                        if (runeIdMatch) {
                            runeId = runeIdMatch[1].trim();
                        }
                    } catch (err) {
                        console.warn(`      ⚠️  Could not fetch runeId for ${runeName}`);
                    }
                    
                    runesData.push({
                        outputIndex: index,
                        runeName: runeName,
                        amount: parseInt(amount),
                        symbol: symbol,
                        runeId: runeId
                    });
                }
            } catch (err) {
                // Silent fail
            }
        });
        
        await Promise.all(outputPromises);
    } catch (error) {
        console.error('Error fetching runes from outputs:', error);
    }
    
    return runesData;
}

/**
 * Enriquecer Outputs com informações de Runes e Inscriptions
 */
async function enrichOutputs(vout, txid, runes, inscriptions, runesFromOutputs) {
    const enriched = [];
    
    for (let i = 0; i < vout.length; i++) {
        const output = { ...vout[i] };
        output.enrichment = {
            type: 'bitcoin', // bitcoin, rune, inscription, op_return
            data: null
        };
        
        // ✅ Garantir que address está presente
        if (!output.scriptpubkey_address && output.scriptPubKey?.address) {
            output.scriptpubkey_address = output.scriptPubKey.address;
        }
        
        // ✅ Garantir que scriptpubkey está presente
        if (!output.scriptpubkey && output.scriptPubKey?.hex) {
            output.scriptpubkey = output.scriptPubKey.hex;
        }
        
        const script = output.scriptpubkey || output.scriptPubKey?.hex || '';
        
        // Check OP_RETURN
        if (script.startsWith('6a')) {
            output.enrichment.type = 'op_return';
            output.enrichment.data = {
                hex: script,
                decoded: script.startsWith('6a5d') ? 'Runestone' : 'Data'
            };
        }
        
        // Check for Inscription
        const inscriptionInOutput = inscriptions.find(ins => ins.output === i || (ins.inscriptionId && i === 0));
        
        if (inscriptionInOutput) {
            output.enrichment.type = 'inscription';
            output.enrichment.data = {
                inscriptionId: inscriptionInOutput.inscriptionId,
                inscriptionNumber: inscriptionInOutput.inscriptionNumber,
                contentUrl: inscriptionInOutput.contentUrl,
                inscriptionUrl: inscriptionInOutput.inscriptionUrl,
                preview: inscriptionInOutput.preview
            };
        }
        
        // Check for Runes from QuickNode ord_getOutput (ANTES do OP_RETURN)
        if (runesFromOutputs && runesFromOutputs.length > 0) {
            const runeInOutput = runesFromOutputs.find(r => r.output === i);
            
            if (runeInOutput) {
                console.log(`   ✅ Enriching output ${i} with rune: ${runeInOutput.name}`);
                
                // Buscar parent para thumbnail DINAMICAMENTE
                console.log(`      📡 Fetching parent for ${runeInOutput.name}...`);
                
                const runeWithParent = await getRuneWithParent(runeInOutput.name);
                
                const parentPreview = runeWithParent.thumbnail;
                const actualRuneId = runeWithParent.runeId || '840000:3';
                
                if (parentPreview) {
                    console.log(`      ✅ Parent found!`);
                } else {
                    console.log(`      ℹ️  No parent, will use emoji: ${runeInOutput.symbol}`);
                }
                
                output.enrichment.type = 'rune';
                output.enrichment.data = {
                    runeId: actualRuneId,
                    name: runeInOutput.name,
                    symbol: runeInOutput.symbol,
                    amount: runeInOutput.amount,
                    divisibility: runeInOutput.divisibility,
                    thumbnail: parentPreview, // Sempre tenta buscar
                    isCenotaph: false
                };
            }
        }
        
        // Check Runes from OP_RETURN/Runestone (PRIORITY - valores sempre RAW corretos)
        if (runes && runes.edicts) {
            const edict = runes.edicts.find(e => e.output === i);
            if (edict) {
                try {
                    // Fetch rune details
                    const runeResponse = await axios.get(`http://localhost:80/rune/${edict.runeId}`, {
                        timeout: 5000,
                        family: 4
                    });
                    const runeHtml = runeResponse.data;
                    
                    const nameMatch = runeHtml.match(/<h1>([^<]+)<\/h1>/);
                    const symbolMatch = runeHtml.match(/symbol<\/dt>\s*<dd>([^<]+)<\/dd>/i);
                    const divisibilityMatch = runeHtml.match(/divisibility<\/dt>\s*<dd>(\d+)<\/dd>/i);
                    const parentMatch = runeHtml.match(/<dt>parent<\/dt>\s*<dd[^>]*>\s*<a[^>]+>([a-f0-9]{64}i\d+)<\/a>/i);
                    
                    const divisibility = divisibilityMatch ? parseInt(divisibilityMatch[1]) : 0;
                    
                    output.enrichment.type = 'rune';
                    output.enrichment.data = {
                        runeId: edict.runeId,
                        name: nameMatch ? nameMatch[1] : `Rune ${edict.runeId}`,
                        symbol: symbolMatch ? symbolMatch[1].trim() : '⧈',
                        amount: Math.abs(edict.amount),
                        divisibility: divisibility,
                        thumbnail: parentMatch ? `http://localhost:4000/api/rune-thumbnail/${parentMatch[1]}` : null,
                        isCenotaph: runes.isCenotaph || false
                    };
                } catch (error) {
                    console.error(`Error fetching rune ${edict.runeId}:`, error.message);
                    output.enrichment.type = 'rune';
                    output.enrichment.data = {
                        runeId: edict.runeId,
                        name: `Rune ${edict.runeId}`,
                        symbol: '⧈',
                        amount: Math.abs(edict.amount),
                        divisibility: 0,
                        thumbnail: null
                    };
                }
            }
        }
        
        // Check Runes from outputs individuais (FALLBACK - se não tem Runestone)
        if (output.enrichment.type === 'bitcoin' && runesFromOutputs && runesFromOutputs.length > 0) {
            const runeOutput = runesFromOutputs.find(r => r.outputIndex === i);
            if (runeOutput) {
                try {
                    const ORD_URL = process.env.ORD_SERVER_URL || 'http://127.0.0.1:80';
                    const runeResponse = await axios.get(`${ORD_URL}/rune/${runeOutput.runeName}`, {
                        timeout: 5000,
                        family: 4
                    });
                    const runeHtml = runeResponse.data;
                    
                    const divisibilityMatch = runeHtml.match(/divisibility<\/dt>\s*<dd>(\d+)<\/dd>/i);
                    const parentMatch = runeHtml.match(/<dt>parent<\/dt>\s*<dd[^>]*>\s*<a[^>]+>([a-f0-9]{64}i\d+)<\/a>/i);
                    const divisibility = divisibilityMatch ? parseInt(divisibilityMatch[1]) : 0;
                    
                    output.enrichment.type = 'rune';
                    output.enrichment.data = {
                        runeId: runeOutput.runeId || 'N/A',
                        name: runeOutput.runeName,
                        symbol: runeOutput.symbol || '⧈',
                        amount: runeOutput.amount,
                        divisibility: divisibility,
                        thumbnail: parentMatch ? `http://localhost:4000/api/rune-thumbnail/${parentMatch[1]}` : null,
                        isCenotaph: false
                    };
                } catch (error) {
                    output.enrichment.type = 'rune';
                    output.enrichment.data = {
                        runeId: runeOutput.runeId || 'N/A',
                        name: runeOutput.runeName,
                        symbol: runeOutput.symbol || '⧈',
                        amount: runeOutput.amount,
                        divisibility: 0,
                        thumbnail: null,
                        isCenotaph: false
                    };
                }
            }
        }
        
        // Check Inscriptions (pode coexistir com runes)
        if (inscriptions && inscriptions.length > 0) {
            const inscription = inscriptions.find(insc => insc.outputIndex === i && !insc.assigned);
            if (inscription) {
                inscription.assigned = true;
                
                if (output.enrichment.type === 'bitcoin') {
                    // Se for bitcoin puro, trocar para inscription
                    output.enrichment.type = 'inscription';
                    output.enrichment.data = {
                        inscriptionId: inscription.inscriptionId,
                        inscriptionNumber: inscription.inscriptionNumber,
                        contentUrl: inscription.contentUrl,
                        inscriptionUrl: inscription.inscriptionUrl,
                        preview: inscription.preview
                    };
                    console.log(`      ✅ Enriched output ${i} with Inscription #${inscription.inscriptionNumber}`);
                } else if (output.enrichment.type === 'rune') {
                    // Se já é rune, adicionar inscription data junto
                    output.enrichment.data.inscription = {
                        inscriptionId: inscription.inscriptionId,
                        inscriptionNumber: inscription.inscriptionNumber,
                        contentUrl: inscription.contentUrl,
                        inscriptionUrl: inscription.inscriptionUrl,
                        preview: inscription.preview
                    };
                    console.log(`      ✅ Output ${i} has BOTH Rune + Inscription #${inscription.inscriptionNumber}`);
                }
            }
        }
        
        enriched.push(output);
    }
    
    return enriched;
}

/**
 * Enriquecer Inputs (buscar de onde vieram - Runes/Inscriptions/Bitcoin)
 * ✅ OTIMIZADO: Busca todas as TXs anteriores em PARALELO
 */
async function enrichInputs(vin) {
    // ✅ Criar promises para todas as buscas em paralelo
    const enrichPromises = vin.map(async (input) => {
        const enrichedInput = { ...input };
        enrichedInput.enrichment = {
            type: 'bitcoin',
            data: null
        };
        
        // Se não tiver txid anterior, é coinbase
        if (!input.txid) {
            return enrichedInput;
        }
        
        try {
            // Buscar TX anterior via QuickNode para obter prevout (endereço e valor)
            const prevTx = await bitcoinRpc.getRawTransaction(input.txid, true);
            const prevOutput = prevTx.vout[input.vout];
            
            // Adicionar prevout
            enrichedInput.prevout = {
                value: Math.round(prevOutput.value * 100000000), // BTC para sats
                scriptpubkey: prevOutput.scriptPubKey.hex,
                scriptpubkey_address: prevOutput.scriptPubKey.address || null,
                scriptpubkey_type: prevOutput.scriptPubKey.type
            };
            
            console.log(`      ✅ Prevout: ${enrichedInput.prevout.scriptpubkey_address || 'N/A'} (${enrichedInput.prevout.value} sats)`);
            
            // 🔥 NOVO: Verificar se input contém inscription ou rune
            try {
                const inputOutpoint = `${input.txid}:${input.vout}`;
                const inputOutputData = await quicknode.getOutput(inputOutpoint);
                
                // Verificar inscription
                if (inputOutputData.inscriptions && inputOutputData.inscriptions.length > 0) {
                    const inscId = inputOutputData.inscriptions[0];
                    console.log(`      🖼️  INPUT has inscription: ${inscId}`);
                    
                    enrichedInput.enrichment = {
                        type: 'inscription',
                        data: {
                            inscriptionId: inscId,
                            preview: `https://ordinals.com/preview/${inscId}`
                        }
                    };
                }
                
                // Verificar runes
                if (inputOutputData.runes && Object.keys(inputOutputData.runes).length > 0) {
                    const runeName = Object.keys(inputOutputData.runes)[0];
                    console.log(`      🪙 INPUT has rune: ${runeName}`);
                    
                    enrichedInput.enrichment = {
                        type: 'rune',
                        data: {
                            name: runeName,
                            ...inputOutputData.runes[runeName]
                        }
                    };
                }
                
                // Delay para rate limit
                await new Promise(r => setTimeout(r, 120));
            } catch (inputCheckError) {
                // Continuar sem enriquecimento
            }
            
        } catch (error) {
            console.error(`   ❌ Error enriching input:`, error.message);
        }
        
        return enrichedInput;
    });
    
    // ✅ Esperar TODAS as requisições terminarem em paralelo
    const enriched = await Promise.all(enrichPromises);
    
    return enriched;
}

// ============================================================================
// HELPER: Fetch Ancestors/Descendants Recursively
// ============================================================================

async function fetchAncestors(inscriptionId, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return [];
    
    try {
        const response = await axios.get(`${ORD_SERVER_URL}/inscription/${inscriptionId}`, {
            timeout: 10000,
            headers: { 'Accept': 'text/html' },
            family: 4
        });
        
        const html = response.data;
        const parentsMatch = html.match(/<dt>parents<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
        
        if (!parentsMatch) return [];
        
        const parentsHtml = parentsMatch[1];
        let parents = [];
        
        // Check if has multiple parents
        const hasMultipleParents = parentsHtml.includes('/parents/');
        
        if (hasMultipleParents) {
            const parentsResponse = await axios.get(`${ORD_SERVER_URL}/parents/${inscriptionId}`, {
                timeout: 10000,
                headers: { 'Accept': 'text/html' },
                family: 4
            });
            const allParentMatches = [...parentsResponse.data.matchAll(/<a[^>]+href=\/inscription\/([a-f0-9]{64}i\d+)>/gi)];
            parents = allParentMatches.map(m => m[1]).filter(id => id !== inscriptionId);
        } else {
            const parentMatches = [...parentsHtml.matchAll(/<a[^>]+href=\/inscription\/([a-f0-9]{64}i\d+)>/gi)];
            parents = parentMatches.map(m => m[1]);
        }
        
        // Recursively fetch grandparents
        const parentsWithAncestors = await Promise.all(parents.map(async (parentId) => {
            const ancestors = await fetchAncestors(parentId, maxDepth, currentDepth + 1);
            return {
                id: parentId,
                generation: currentDepth + 1,
                ancestors: ancestors
            };
        }));
        
        return parentsWithAncestors;
        
    } catch (error) {
        console.warn(`Could not fetch ancestors for ${inscriptionId}:`, error.message);
        return [];
    }
}

async function fetchDescendants(inscriptionId, maxDepth = 2, currentDepth = 0) {
    if (currentDepth >= maxDepth) return [];
    
    try {
        const response = await axios.get(`${ORD_SERVER_URL}/inscription/${inscriptionId}`, {
            timeout: 10000,
            headers: { 'Accept': 'text/html' },
            family: 4
        });
        
        const html = response.data;
        const childrenMatch = html.match(/<dt>children<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
        
        if (!childrenMatch) return [];
        
        const childrenText = childrenMatch[1];
        let children = [];
        
        // Check count
        const countMatch = childrenText.match(/all \((\d+)\)/);
        const childrenCount = countMatch ? parseInt(countMatch[1]) : 0;
        
        if (childrenCount > 10) {
            const childrenResponse = await axios.get(`${ORD_SERVER_URL}/children/${inscriptionId}`, {
                timeout: 10000,
                headers: { 'Accept': 'text/html' },
                family: 4
            });
            const allChildMatches = [...childrenResponse.data.matchAll(/<a[^>]+href=\/inscription\/([a-f0-9]{64}i\d+)>/gi)];
            children = allChildMatches.map(m => m[1]).filter(id => id !== inscriptionId);
        } else {
            const childMatches = [...childrenText.matchAll(/<a[^>]+href=\/inscription\/([a-f0-9]{64}i\d+)>/gi)];
            children = childMatches.map(m => m[1]);
        }
        
        // Recursively fetch grandchildren (limitado para evitar sobrecarga)
        if (children.length <= 10 && currentDepth < maxDepth - 1) {
            const childrenWithDescendants = await Promise.all(children.map(async (childId) => {
                const descendants = await fetchDescendants(childId, maxDepth, currentDepth + 1);
                return {
                    id: childId,
                    generation: currentDepth + 1,
                    descendants: descendants
                };
            }));
            return childrenWithDescendants;
        }
        
        // Se tiver muitos children, retornar só os IDs
        return children.map(childId => ({
            id: childId,
            generation: currentDepth + 1,
            descendants: []
        }));
        
    } catch (error) {
        console.warn(`Could not fetch descendants for ${inscriptionId}:`, error.message);
        return [];
    }
}

/**
 * GET /api/explorer/inscription/:inscriptionId
 * Busca informações completas de uma inscription
 */
router.get('/inscription/:inscriptionId', async (req, res) => {
    try {
        const { inscriptionId } = req.params;
        console.log(`\n🖼️  ========== EXPLORER INSCRIPTION REQUEST ==========`);
        console.log(`📍 Inscription ID: ${inscriptionId}`);
        
        // Buscar do ord server
        const response = await axios.get(`${ORD_SERVER_URL}/inscription/${inscriptionId}`, {
            timeout: 15000,
            headers: { 'Accept': 'text/html' },
            family: 4
        });
        
        const html = response.data;
        console.log(`   ✅ Got Ord Server data (${html.length} bytes)`);
        
        // Extrair dados da HTML
        const inscriptionData = {
            inscriptionId: inscriptionId,
            inscriptionNumber: null,
            address: null,
            outputValue: null,
            sat: null,
            satName: null,
            preview: `${ORD_SERVER_URL}/preview/${inscriptionId}`,
            content: `${ORD_SERVER_URL}/content/${inscriptionId}`,
            contentLength: null,
            contentType: null,
            timestamp: null,
            genesisHeight: null,
            genesisFee: null,
            genesisTx: null,
            location: null,
            output: null,
            offset: null,
            charms: [],
            parents: [],
            children: [],
            ethereumTeleburnAddress: null
        };
        
        // Extrair número da inscription
        const numberMatch = html.match(/<h1>Inscription (\d+)<\/h1>/);
        if (numberMatch) {
            inscriptionData.inscriptionNumber = parseInt(numberMatch[1]);
        }
        
        // Extrair informações do <dl>
        const extractDd = (label) => {
            const regex = new RegExp(`<dt>${label}<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, 'i');
            const match = html.match(regex);
            if (!match) return null;
            
            // Limpar HTML tags
            return match[1].replace(/<[^>]+>/g, '').trim();
        };
        
        // Extrair charms (emojis)
        const charmsMatch = html.match(/<dt>charms<\/dt>\s*<dd>([^<]+)<\/dd>/i);
        if (charmsMatch) {
            inscriptionData.charms = charmsMatch[1].trim().split(/\s+/);
        }
        
        // Extrair address
        inscriptionData.address = extractDd('address');
        
        // Extrair value
        const valueStr = extractDd('value');
        if (valueStr) {
            inscriptionData.outputValue = parseInt(valueStr);
        }
        
        // Extrair sat
        const satStr = extractDd('sat');
        if (satStr) {
            inscriptionData.sat = satStr;
        }
        
        // Extrair sat name
        inscriptionData.satName = extractDd('sat name');
        
        // Extrair content length
        const lengthStr = extractDd('content length');
        if (lengthStr) {
            inscriptionData.contentLength = lengthStr;
        }
        
        // Extrair content type
        inscriptionData.contentType = extractDd('content type');
        
        // Extrair timestamp
        inscriptionData.timestamp = extractDd('timestamp');
        
        // Extrair height
        const heightStr = extractDd('height');
        if (heightStr) {
            inscriptionData.genesisHeight = parseInt(heightStr);
        }
        
        // Extrair fee
        const feeStr = extractDd('fee');
        if (feeStr) {
            inscriptionData.genesisFee = parseInt(feeStr);
        }
        
        // Extrair reveal transaction
        inscriptionData.genesisTx = extractDd('reveal transaction');
        
        // Extrair location
        inscriptionData.location = extractDd('location');
        
        // Extrair output
        inscriptionData.output = extractDd('output');
        
        // Extrair offset
        const offsetStr = extractDd('offset');
        if (offsetStr) {
            inscriptionData.offset = parseInt(offsetStr);
        }
        
        // Extrair ethereum teleburn address
        inscriptionData.ethereumTeleburnAddress = extractDd('ethereum teleburn address');
        
        // Extrair parents
        const parentsMatch = html.match(/<dt>parents<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
        if (parentsMatch) {
            const parentsHtml = parentsMatch[1];
            const parentMatches = [...parentsHtml.matchAll(/<a[^>]+href=\/inscription\/([a-f0-9]{64}i\d+)>/gi)];
            inscriptionData.parents = parentMatches.map(m => m[1]);
            
            // Verificar se tem link "all" indicando múltiplos parents
            const hasMultipleParents = parentsHtml.includes('/parents/');
            
            // ✅ Se tiver múltiplos parents, buscar TODOS do ord server
            if (hasMultipleParents || inscriptionData.parents.length === 0) {
                console.log(`   🔍 Fetching all parents from ord server...`);
                try {
                    const parentsUrl = `${ORD_SERVER_URL}/parents/${inscriptionId}`;
                    const parentsResponse = await axios.get(parentsUrl, {
                        timeout: 15000,
                        headers: { 'Accept': 'text/html' },
                        family: 4
                    });
                    
                    const parentsPageHtml = parentsResponse.data;
                    const allParentMatches = [...parentsPageHtml.matchAll(/<a[^>]+href=\/inscription\/([a-f0-9]{64}i\d+)>/gi)];
                    
                    // ✅ IMPORTANTE: O primeiro link é sempre o próprio inscription (self), então pular ele
                    const allParents = allParentMatches.map(m => m[1]);
                    inscriptionData.parents = allParents.filter(id => id !== inscriptionId);
                    
                    console.log(`   ✅ Found ${inscriptionData.parents.length} parents (filtered self)`);
                } catch (parentsError) {
                    console.warn(`   ⚠️  Could not fetch parents list:`, parentsError.message);
                }
            }
        }
        
        // Extrair children
        const childrenMatch = html.match(/<dt>children<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
        if (childrenMatch) {
            const childrenText = childrenMatch[1];
            const countMatch = childrenText.match(/all \((\d+)\)/);
            if (countMatch) {
                inscriptionData.childrenCount = parseInt(countMatch[1]);
            }
            
            // Extrair IDs dos children (se estiverem listados)
            const childMatches = [...childrenText.matchAll(/<a[^>]+href=\/inscription\/([a-f0-9]{64}i\d+)>/gi)];
            inscriptionData.children = childMatches.map(m => m[1]);
            
            // ✅ Se tiver mais de 10 children, buscar TODOS do ord server (não apenas os 4-5 que aparecem no HTML)
            if (inscriptionData.childrenCount > 10) {
                console.log(`   🔍 Fetching ${inscriptionData.childrenCount} children from ord server...`);
                try {
                    // Buscar página de children
                    const childrenUrl = `${ORD_SERVER_URL}/children/${inscriptionId}`;
                    const childrenResponse = await axios.get(childrenUrl, {
                        timeout: 15000,
                        headers: { 'Accept': 'text/html' },
                        family: 4
                    });
                    
                    const childrenHtml = childrenResponse.data;
                    const childrenMatches = [...childrenHtml.matchAll(/<a[^>]+href=\/inscription\/([a-f0-9]{64}i\d+)>/gi)];
                    
                    // ✅ IMPORTANTE: O primeiro link é sempre o parent (self), então pular ele
                    const allInscriptions = childrenMatches.map(m => m[1]);
                    inscriptionData.children = allInscriptions.filter(id => id !== inscriptionId);
                    
                    console.log(`   ✅ Found ${inscriptionData.children.length} children (filtered parent)`);
                } catch (childrenError) {
                    console.warn(`   ⚠️  Could not fetch children list:`, childrenError.message);
                }
            }
        }
        
        console.log(`   ✅ Inscription #${inscriptionData.inscriptionNumber}`);
        console.log(`   📍 Address: ${inscriptionData.address?.substring(0, 20)}...`);
        console.log(`   🎨 Content Type: ${inscriptionData.contentType}`);
        
        // Verificar se há oferta ativa para esta inscription
        let activeOffer = null;
        try {
            const offer = db.prepare(`
                SELECT id, inscription_id, price, seller_address, status, created_at
                FROM offers 
                WHERE inscription_id = ? AND status = 'active'
                ORDER BY created_at DESC
                LIMIT 1
            `).get(inscriptionId);
            
            if (offer) {
                activeOffer = {
                    offerId: offer.id,
                    price: offer.price,
                    sellerAddress: offer.seller_address,
                    createdAt: offer.created_at
                };
                console.log(`   💰 Found active offer: ${offer.price} sats`);
            }
        } catch (dbError) {
            console.warn('   ⚠️  Could not check for offers:', dbError.message);
        }
        
        // 🧬 Buscar árvore genealógica completa (ancestrais e descendentes)
        console.log(`\n🧬 Fetching family tree...`);
        let ancestors = [];
        let descendants = [];
        
        try {
            // Buscar até 3 gerações de ancestrais (parents, grandparents, great-grandparents)
            if (inscriptionData.parents.length > 0) {
                console.log(`   👴 Fetching ancestors (up to 3 generations)...`);
                ancestors = await fetchAncestors(inscriptionId, 3, 0);
                console.log(`   ✅ Found ${ancestors.length} direct parents with their ancestors`);
            }
            
            // Buscar até 2 gerações de descendentes (children, grandchildren)
            if (inscriptionData.childrenCount > 0 && inscriptionData.childrenCount <= 100) {
                console.log(`   👶 Fetching descendants (up to 2 generations)...`);
                descendants = await fetchDescendants(inscriptionId, 2, 0);
                console.log(`   ✅ Found ${descendants.length} direct children with their descendants`);
            }
        } catch (treeError) {
            console.warn('   ⚠️  Could not fetch complete family tree:', treeError.message);
        }
        
        res.json({
            success: true,
            inscription: inscriptionData,
            offer: activeOffer,
            familyTree: {
                ancestors: ancestors,
                descendants: descendants
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching inscription:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

