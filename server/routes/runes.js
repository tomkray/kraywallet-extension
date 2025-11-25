import express from 'express';
import axios from 'axios';
import bitcoinRpc from '../utils/bitcoinRpc.js';
import runesDecoder from '../utils/runesDecoder.js';
import mempoolApi from '../utils/mempoolApi.js';

const router = express.Router();
// QuickNode enabled - usar APIs locais que já usam QuickNode
const USE_QUICKNODE = process.env.QUICKNODE_ENABLED === 'true';

/**
 * GET /api/runes/by-address/:address
 * Retorna todas as runes de um endereço (decodificando OP_RETURN)
 * Query params:
 * - method: 'html' (padrão) ou 'runestone' (decodifica diretamente das txs)
 */
router.get('/by-address/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const useQuickNode = process.env.QUICKNODE_ENABLED === 'true';
        
        console.log('\n========================================');
        console.log('🪙 RUNES ENDPOINT CALLED!!!');
        console.log(`📊 Fetching runes for address: ${address}`);
        console.log(`📊 QuickNode: ${useQuickNode ? 'ENABLED ✅' : 'disabled'}`);
        console.log('========================================\n');

        let runes;
        
        if (useQuickNode) {
            // 🚀 Usar QuickNode + Hiro API
            console.log('🔍 [QUICKNODE METHOD] Using cloud APIs...');
            const { getRunesForAddress } = await import('../utils/runesHelper.js');
            runes = await getRunesForAddress(address);
        } else {
            // 📜 Fallback: usar ord local
            const method = req.query.method || 'html';
            
            if (method === 'runestone') {
                console.log('🔍 [RUNESTONE METHOD] Decoding edicts from transactions (EXPERIMENTAL)...');
                runes = await runesDecoder.getRunesFromRunestones(address);
            } else {
                console.log('🔍 [HTML METHOD - DEFAULT] Parsing from ord server HTML...');
                runes = await runesDecoder.getRunesForAddress(address);
            }
        }
        
        console.log(`✅ Found ${runes.length} unique runes`);

        // 2. Se QuickNode, runes já vêm com detalhes completos
        // Se local, buscar detalhes de cada rune
        let runesWithDetails = [];
        
        if (useQuickNode) {
            // Runes já vêm com detalhes do runesHelper
            runesWithDetails = runes;
        } else {
            // Buscar detalhes para cada rune (método local)
            for (const rune of runes) {
                try {
                    const details = await runesDecoder.getRuneDetails(rune.name);
                    const runeUtxos = await runesDecoder.getRuneUtxos(address, rune.name);
                    
                    let symbol = '⧈';
                    const emojiMatch = rune.displayName.match(/([🐕🪙🔥💎⚡🌟🚀⧈]+)$/);
                    if (emojiMatch) {
                        symbol = emojiMatch[1];
                    }
                    
                    runesWithDetails.push({
                        name: rune.name,
                        displayName: rune.displayName,
                        amount: rune.amount,
                        symbol: details.symbol || symbol,
                        runeId: details.runeId,
                        divisibility: details.divisibility || 0,
                        utxos: runeUtxos,
                        parent: details.parent,
                        parentPreview: details.parentPreview,
                        etching: details.etching,
                        supply: details.supply
                    });
                } catch (error) {
                    console.error(`❌ Error fetching details for rune ${rune.name}:`, error.message);
                    
                    let symbol = '⧈';
                    const emojiMatch = rune.displayName.match(/([🐕🪙🔥💎⚡🌟🚀⧈]+)$/);
                    if (emojiMatch) {
                        symbol = emojiMatch[1];
                    }
                    
                    runesWithDetails.push({
                        name: rune.name,
                        displayName: rune.displayName,
                        amount: rune.amount,
                        symbol: symbol,
                        divisibility: 0,
                        utxos: rune.utxos
                    });
                }
            }
        }

        console.log(`✅ Processed ${runesWithDetails.length} runes with details`);

        res.json({
            success: true,
            address: address,
            runes: runesWithDetails
        });

    } catch (error) {
        console.error('❌ Error fetching runes:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            runes: []
        });
    }
});

/**
 * GET /api/runes/:runeName
 * Retorna informações detalhadas de uma rune específica
 */
router.get('/:runeName', async (req, res) => {
    try {
        const { runeName } = req.params;
        console.log(`📊 Fetching rune details: ${runeName}`);

        const runeResponse = await axios.get(
            `${ORD_SERVER_URL}/rune/${encodeURIComponent(runeName)}`,
            { timeout: 5000 }
        );

        const html = runeResponse.data;
        
        // Parse HTML para extrair todas as informações
        const runeData = {
            name: runeName,
            displayName: decodeURIComponent(runeName)
        };

        // Extrair parent
        const parentMatch = html.match(/<dt>parent<\/dt>\s*<dd><a[^>]*href="\/inscription\/([^"]+)"/i);
        if (parentMatch) {
            runeData.parent = parentMatch[1];
            runeData.parentPreview = `${ORD_SERVER_URL}/content/${parentMatch[1]}`;
        }

        // Extrair etching
        const etchingMatch = html.match(/<dt>etching<\/dt>\s*<dd><a[^>]*href="\/tx\/([^"]+)"/i);
        if (etchingMatch) {
            runeData.etching = etchingMatch[1];
        }

        // Extrair supply
        const supplyMatch = html.match(/<dt>supply<\/dt>\s*<dd>([^<]+)<\/dd>/i);
        if (supplyMatch) {
            runeData.supply = supplyMatch[1].trim();
        }

        // Extrair burned
        const burnedMatch = html.match(/<dt>burned<\/dt>\s*<dd>([^<]+)<\/dd>/i);
        if (burnedMatch) {
            runeData.burned = burnedMatch[1].trim();
        }

        // Extrair divisibility
        const divisibilityMatch = html.match(/<dt>divisibility<\/dt>\s*<dd>([^<]+)<\/dd>/i);
        if (divisibilityMatch) {
            runeData.divisibility = divisibilityMatch[1].trim();
        }

        // Extrair symbol
        const symbolMatch = html.match(/<dt>symbol<\/dt>\s*<dd>([^<]+)<\/dd>/i);
        if (symbolMatch) {
            runeData.symbol = symbolMatch[1].trim();
        }

        // Extrair mint terms (se existir)
        const mintsMatch = html.match(/<dt>mints<\/dt>\s*<dd>([^<]+)<\/dd>/i);
        if (mintsMatch) {
            runeData.mints = mintsMatch[1].trim();
        }

        res.json({
            success: true,
            rune: runeData
        });

    } catch (error) {
        console.error('❌ Error fetching rune details:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/runes/build-send-psbt
 * Constrói PSBT para enviar runes (NOVO - para funcionalidade Send)
 */
router.post('/build-send-psbt', async (req, res) => {
    try {
        const { fromAddress, toAddress, runeName, amount, feeRate } = req.body;
        
        console.log('\n========================================');
        console.log('🚀 BUILD SEND PSBT ENDPOINT CALLED');
        console.log(`From: ${fromAddress}`);
        console.log(`To: ${toAddress}`);
        console.log(`Rune: ${runeName}`);
        console.log(`Amount: ${amount}`);
        console.log('========================================\n');
        
        // Validações
        if (!fromAddress || !toAddress || !runeName || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: fromAddress, toAddress, runeName, amount'
            });
        }
        
        // Validar amount é número (aceitar float para suportar decimais)
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount. Must be a positive number.'
            });
        }
        
        // Import do PSBT builder (lazy load para não quebrar se o arquivo não existir)
        const psbtBuilderRunes = (await import('../utils/psbtBuilderRunes.js')).default;
        
        // Construir PSBT
        const result = await psbtBuilderRunes.buildRuneSendPSBT({
            fromAddress,
            toAddress,
            runeName,
            amount: numAmount,
            feeRate: feeRate || 10
        });
        
        console.log('✅ PSBT built successfully');
        
        res.json({
            success: true,
            psbt: result.psbt, // Base64 PSBT
            fee: result.fee,
            summary: {
                from: fromAddress,
                to: toAddress,
                rune: result.runeName,
                amount: result.amount,
                change: result.change,
                estimatedFee: `${result.fee} sats`
            }
        });
        
    } catch (error) {
        console.error('❌ Error building PSBT:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/runes/fast/:address
 * Retorna runes de forma RÁPIDA (busca direto nos UTXOs via ORD server)
 * Mesma lógica do Split - muito mais rápido que /by-address
 */
router.get('/fast/:address', async (req, res) => {
    try {
        const { address } = req.params;
        console.log(`\n🚀 ========== FAST RUNES ENDPOINT (ORD ONLY) ==========`);
        console.log(`📊 Address: ${address}`);
        
        // ✅ BUSCAR RUNES DIRETO DO ORD SERVER (sem Mempool.space!)
        console.log('📡 Fetching runes from LOCAL ORD server...');
        
        const runesMap = new Map(); // Agregar por nome de rune
        
        try {
            // Buscar a página do endereço no ORD server
            const ordResponse = await axios.get(`${ORD_SERVER_URL}/address/${address}`, {
                timeout: 10000,
                headers: { 'Accept': 'text/html' },
                family: 4 // ✅ FORÇAR IPv4
            });
            
            const html = ordResponse.data;
            console.log(`   ✅ Got address page from ORD (${html.length} bytes)`);
            
            // Procurar pela seção de rune balances no HTML
            // Formato: <a class=monospace href=/rune/RUNE•NAME>RUNE•NAME</a>: AMOUNT SYMBOL
            // ✅ Capturar decimais também: (\d+\.?\d*) em vez de (\d+)
            const runeMatches = [...html.matchAll(/<a[^>]*href=\/rune\/([^>]+)>([^<]+)<\/a>:\s*([\d.]+)([^\n<]*)/gi)];
            
            console.log(`   🔍 Found ${runeMatches.length} rune entries in HTML`);
            
            for (const match of runeMatches) {
                const runeName = match[2];
                const amountStr = match[3].trim(); // ✅ Manter como string para preservar decimais
                const symbol = match[4].trim();
                
                console.log(`   🪙 Found: ${runeName} - ${amountStr} ${symbol}`);
                
                // Agregar amounts se a rune já existe
                if (runesMap.has(runeName)) {
                    const existing = runesMap.get(runeName);
                    // Somar como números, mas manter precisão
                    existing.amount = (parseFloat(existing.amount) + parseFloat(amountStr)).toString();
                } else {
                    runesMap.set(runeName, {
                        name: runeName,
                        displayName: runeName + (symbol ? ' ' + symbol : ''),
                        amount: amountStr, // ✅ Manter como string (ex: "999.995")
                        symbol: symbol
                    });
                }
            }
            
        } catch (ordError) {
            console.error(`❌ Error fetching from ORD server:`, ordError.message);
            return res.json({
                success: true,
                runes: []
            });
        }
        
        const runes = Array.from(runesMap.values());
        console.log(`✅ Found ${runes.length} unique runes`);
        
        if (runes.length === 0) {
            return res.json({
                success: true,
                runes: []
            });
        }
        
        // 2. Para cada rune, buscar detalhes do ORD server (parent, thumbnail, etc)
        const runesWithDetails = [];
        
        for (const rune of runes) {
            try {
                // Buscar página da rune no ORD server
                const runeResponse = await axios.get(`${ORD_SERVER_URL}/rune/${rune.name}`, {
                    timeout: 15000,  // ✅ 15s (ord server pode estar lento)
                    headers: { 'Accept': 'text/html' },
                    family: 4 // ✅ FORÇAR IPv4
                });
                
                const html = runeResponse.data;
                console.log(`   📄 HTML length for ${rune.name}: ${html.length} bytes`);
                
                // Extrair parent (inscription ID) - tentar vários formatos
                let parent = null;
                let parentMatch = html.match(/<dt>parent<\/dt>\s*<dd[^>]*>\s*<a[^>]+>([a-f0-9]{64}i\d+)<\/a>/i);
                if (!parentMatch) {
                    // Tentar formato alternativo
                    parentMatch = html.match(/<dt>parent<\/dt>\s*<dd><a[^>]*href="\/inscription\/([^"]+)"/i);
                }
                if (parentMatch) {
                    parent = parentMatch[1];
                    console.log(`   🎨 Found parent: ${parent}`);
                }
                
                // Extrair runeId
                let runeId = null;
                const runeIdMatch = html.match(/<dt>id<\/dt>\s*<dd[^>]*>(\d+:\d+)<\/dd>/i);
                if (runeIdMatch) {
                    runeId = runeIdMatch[1];
                    console.log(`   🆔 Found runeId: ${runeId}`);
                }
                
                // ✅ CRÍTICO: Extrair divisibility (decimals)
                let divisibility = 0;
                const divisibilityMatch = html.match(/<dt>divisibility<\/dt>\s*<dd>([0-9]+)<\/dd>/i);
                if (divisibilityMatch) {
                    divisibility = parseInt(divisibilityMatch[1]);
                    console.log(`   🔢 Found divisibility: ${divisibility}`);
                }
                
                // Construir thumbnail/parentPreview
                const thumbnail = parent ? `${ORD_SERVER_URL}/content/${parent}` : null;
                const parentPreview = thumbnail; // Alias para compatibilidade
                
                runesWithDetails.push({
                    name: rune.name,
                    displayName: rune.displayName,
                    amount: rune.amount,
                    symbol: rune.symbol,
                    parent: parent,
                    thumbnail: thumbnail,
                    parentPreview: parentPreview, // ✅ Adicionar para compatibilidade com popup
                    runeId: runeId,
                    divisibility: divisibility  // ✅ CRÍTICO para validação de decimais!
                });
                
                console.log(`   ✅ ${rune.name}: parent=${parent}, thumbnail=${thumbnail ? 'YES' : 'NO'}`);
                
            } catch (e) {
                console.warn(`   ⚠️  Could not fetch details for ${rune.name}:`, e.message);
                // Se falhar, adicionar sem detalhes
                runesWithDetails.push({
                    name: rune.name,
                    displayName: rune.displayName,
                    amount: rune.amount,
                    symbol: rune.symbol,
                    parent: null,
                    thumbnail: null,
                    runeId: null,
                    divisibility: 0  // Default se não conseguir buscar
                });
            }
        }
        
        console.log(`✅ Returning ${runesWithDetails.length} runes with details`);
        
        res.json({
            success: true,
            runes: runesWithDetails
        });
        
    } catch (error) {
        console.error('❌ Error fetching fast runes:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            runes: []
        });
    }
});

export default router;

