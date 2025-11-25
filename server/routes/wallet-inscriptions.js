import express from 'express';
import quicknode from '../utils/quicknode.js';
import axios from 'axios';
import { getRuneWithParent } from '../utils/runeIdCache.js';

const router = express.Router();
const walletCache = new Map();

/**
 * GET /api/wallet/:address/inscriptions
 * Retorna inscriptions do DB local
 */
router.get('/:address/inscriptions', async (req, res) => {
    try {
        const { address } = req.params;
        console.log(`📡 Fetching inscriptions for ${address}...`);
        
        // 🔥 ESCANEAR UTXOS VIA QUICKNODE (100% dinâmico e em tempo real)
        const axios = (await import('axios')).default;
        const utxosResponse = await axios.get(`https://mempool.space/api/address/${address}/utxo`, {
            timeout: 10000
        });
        
        const utxos = utxosResponse.data;
        console.log(`   📦 Scanning ${utxos.length} UTXOs for inscriptions...`);
        
        const inscriptions = [];
        
        for (const utxo of utxos) {
            const outpoint = `${utxo.txid}:${utxo.vout}`;
            
            try {
                const outputData = await quicknode.getOutput(outpoint);
                
                if (outputData.inscriptions && outputData.inscriptions.length > 0) {
                    for (const inscId of outputData.inscriptions) {
                        const details = await quicknode.call('ord_getInscription', [inscId]);
                        
                        // Verificar se pertence a este endereço
                        if (details.address === address) {
                            console.log(`      ✅ Found #${details.number} (${utxo.status?.confirmed ? 'confirmed' : 'PENDING ⏳'})`);
                            
                            inscriptions.push({
                                id: inscId,
                                inscription_number: details.number,
                                address: details.address,
                                content_type: details.content_type || details.effective_content_type,
                                output: outpoint,
                                confirmed: utxo.status?.confirmed || false
                            });
                        }
                        
                        await new Promise(r => setTimeout(r, 120));
                    }
                }
            } catch (e) {
                // Continuar
            }
        }
        
        console.log(`   ✅ Returning ${inscriptions.length} inscriptions (dynamic scan)`);
        
        res.json({
            success: true,
            inscriptions,
            count: inscriptions.length,
            source: 'quicknode_dynamic'
        });
    } catch (error) {
        console.error(`   ❌ Error:`, error.message);
        res.json({ success: true, inscriptions: [], count: 0 });
    }
});

/**
 * GET /api/wallet/:address/runes
 * Escaneia TODOS os UTXOs via QuickNode e busca parents DINAMICAMENTE
 */
router.get('/:address/runes', async (req, res) => {
    try {
        const { address } = req.params;
        console.log(`🔍 Scanning runes for ${address}...`);
        
        // Buscar UTXOs via Mempool.space (RÁPIDO - apenas UTXOs não gastos)
        const utxosResponse = await axios.get(`https://mempool.space/api/address/${address}/utxo`, {
            timeout: 10000
        });
        
        const utxos = utxosResponse.data;
        console.log(`   📦 ${utxos.length} UTXOs found`);
        
        const runesMap = new Map();
        
        // Escanear cada UTXO via QuickNode (SEQUENCIAL para respeitar rate limit)
        const results = [];
        
        for (let i = 0; i < utxos.length; i++) {
            const utxo = utxos[i];
            const outpoint = `${utxo.txid}:${utxo.vout}`;
            
            try {
                const outputData = await quicknode.getOutput(outpoint);
                
                if (outputData.runes && Object.keys(outputData.runes).length > 0) {
                    results.push({ outpoint, runes: outputData.runes, utxo });
                }
                
                // Delay de 120ms entre chamadas (máx 8/segundo para ficar abaixo de 10/segundo)
                if (i < utxos.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 120));
                }
            } catch (e) {
                // Continuar
            }
        }
        
        // Processar resultados
        for (const result of results) {
            if (result) {
                for (const [name, info] of Object.entries(result.runes)) {
                    if (!runesMap.has(name)) {
                        runesMap.set(name, {
                            amount: 0,
                            symbol: info.symbol,
                            divisibility: info.divisibility,
                            utxos: []
                        });
                    }
                    const rune = runesMap.get(name);
                    rune.amount += info.amount;
                    rune.utxos.push({ txid: result.utxo.txid, vout: result.utxo.vout, amount: info.amount });
                }
            }
        }
        
        console.log(`   🎯 Found ${runesMap.size} unique runes`);
        
        // Converter para array e buscar parents DINAMICAMENTE (SEQUENCIAL com delay)
        const runes = [];
        
        let index = 0;
        for (const [name, data] of runesMap) {
            const amount = data.amount / Math.pow(10, data.divisibility);
            
            // 🔥 BUSCAR PARENT DINAMICAMENTE
            console.log(`   🔍 Getting parent for: ${name}`);
            const runeWithParent = await getRuneWithParent(name);
            
            console.log(`      Parent: ${runeWithParent.parent ? 'YES ✅' : 'NO (emoji)'}`);
            console.log(`      Thumbnail: ${runeWithParent.thumbnail ? 'YES ✅' : 'NO (emoji)'}`);
            
            runes.push({
                name,
                displayName: `${name} ${data.symbol}`,
                symbol: data.symbol,
                amount,
                rawAmount: data.amount,
                divisibility: data.divisibility,
                utxos: data.utxos,
                thumbnail: runeWithParent.thumbnail,
                parent: runeWithParent.parent,
                parentPreview: runeWithParent.thumbnail,
                runeId: runeWithParent.runeId
            });
            
            // Delay de 150ms entre chamadas para respeitar rate limit
            index++;
            if (index < runesMap.size) {
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }
        
        console.log(`   ✅ Returning ${runes.length} runes with parents`);
        
        res.json({ success: true, runes });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.json({ success: true, runes: [] });
    }
});

export default router;
