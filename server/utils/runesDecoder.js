import bitcoinRpc from './bitcoinRpc.js';
import axios from 'axios';
import { getRunesFromUtxos } from './runestoneDecoder.js';
import quicknode from './quicknode.js';

const ORD_SERVER_URL = process.env.ORD_SERVER_URL || 'http://127.0.0.1:80';

/**
 * Runes Decoder - Busca runes de um endereço via Bitcoin Core RPC + ORD server
 * Método simples: busca todos os UTXOs e consulta o ORD server para ver se tem runes
 */

class RunesDecoder {
    /**
     * Busca todas as runes de um endereço
     * Usa o endpoint /address/ do ORD server que retorna TUDO
     */
    async getRunesForAddress(address) {
        try {
            console.log(`🔍 Searching runes for address: ${address}`);

            // Usar endpoint /address/ do ORD server (mais eficiente!)
            console.log(`📡 Fetching from ORD server: ${ORD_SERVER_URL}/address/${address}`);
            
            const response = await axios.get(
                `${ORD_SERVER_URL}/address/${address}`,
                { timeout: 30000 } // 30 segundos (pode ser lento)
            );

            const html = response.data;
            console.log(`✅ Got HTML response (${html.length} chars)`);

            // Parse HTML para encontrar seção de Runes Balance
            // Formato do ORD server (HTML):
            // <dt>rune balances</dt>
            // <dd><a href=/rune/DOG•GO•TO•THE•MOON>DOG•GO•TO•THE•MOON</a>: 1000🐕</dd>
            
            const runesMap = new Map();
            
            // Procurar pela tag <dt>rune balances</dt> seguida de <dd>
            // Formato: <dt>rune balances</dt><dd>RUNE1: AMOUNT1 EMOJI1<br/>RUNE2: AMOUNT2 EMOJI2</dd>
            
            // 🔧 CORREÇÃO FINAL: Capturar TODAS as tags <dd> após "rune balances"
            // Formato do ord server: cada rune tem sua própria tag <dd>
            // <dt>rune balances</dt>
            // <dd><a ...>RUNE1</a>: AMOUNT1 EMOJI1</dd>
            // <dd><a ...>RUNE2</a>: AMOUNT2 EMOJI2</dd>
            
            // Primeiro, encontrar a posição de "rune balances"
            const runeBalancesIndex = html.indexOf('<dt>rune balances</dt>');
            
            if (runeBalancesIndex !== -1) {
                console.log('✅ Found "rune balances" section (HTML format)');
                
                // Extrair tudo após "rune balances" até o próximo <dt>
                const afterRuneBalances = html.substring(runeBalancesIndex);
                const nextDtIndex = afterRuneBalances.indexOf('<dt>', 30); // Buscar próximo <dt> depois de "rune balances"
                const runesSection = nextDtIndex !== -1 
                    ? afterRuneBalances.substring(0, nextDtIndex)
                    : afterRuneBalances;
                
                console.log('📋 Runes section LENGTH:', runesSection.length);
                console.log('📋 Runes section:', runesSection.substring(0, 500));
                
                // Agora extrair TODAS as tags <dd> com runes
                // Formato: <dd><a ...>RUNE•NAME</a>: AMOUNT EMOJI</dd>
                const ddPattern = /<dd><a[^>]*href=\/rune\/[^>]*>([A-Z•]+)<\/a>:\s*([\d,]+)\s*([^<]*)<\/dd>/gi;
                
                console.log('🔍 Starting regex matching with pattern:', ddPattern.source);
                
                let match;
                let matchCount = 0;
                while ((match = ddPattern.exec(runesSection)) !== null) {
                    matchCount++;
                    const displayName = match[1].trim();
                    const amount = match[2].replace(/,/g, ''); // Remove vírgulas
                    const extraInfo = match[3].trim(); // Pode conter emoji
                    
                    console.log(`✅ Match #${matchCount}: ${displayName} = ${amount} ${extraInfo}`);
                    
                    // Extrair emoji se houver (adicionar 🐺 para LOBO)
                    let symbol = '⧈';
                    const emojiMatch = extraInfo.match(/([🐕🐺🪙🔥💎⚡🌟🚀🌙🐂🐻🦁🐶🦴🎯🎨🎭🎪🎡🎢🎠🎰⧈]+)/);
                    if (emojiMatch) {
                        symbol = emojiMatch[1];
                    }
                    
                    // Nome é o mesmo que displayName para runes
                    runesMap.set(displayName, {
                        name: displayName,
                        displayName: extraInfo ? `${displayName} ${extraInfo}` : displayName,
                        amount: amount,
                        symbol: symbol,
                        utxos: [] // Vamos preencher depois se necessário
                    });
                }
                
                console.log(`🏁 Regex matching finished. Total matches: ${matchCount}`);
                
                if (runesMap.size === 0) {
                    console.log('⚠️  No runes parsed from HTML');
                    console.log('📋 Full content:', runesContent);
                }
            } else {
                console.log('ℹ️  No "rune balances" section found in HTML');
                
                // Debug: mostrar o que tem no HTML
                const preview = html.substring(0, 1500);
                console.log('📋 HTML preview:', preview);
            }

            const groupedRunes = Array.from(runesMap.values());
            console.log(`✅ Found ${groupedRunes.length} unique runes for address`);

            return groupedRunes;

        } catch (error) {
            console.error('❌ Error getting runes for address:', error);
            return [];
        }
    }

    /**
     * ✅ Busca UTXOs que contêm uma rune específica
     * Método: Busca TODOS os outputs do endereço e filtra pela rune desejada
     */
    async getRuneUtxos(address, runeName) {
        try {
            console.log(`🔍 Searching UTXOs with rune "${runeName}" for address: ${address}`);
            
            // 1. Buscar TODOS os outputs do endereço
            const response = await axios.get(
                `${ORD_SERVER_URL}/address/${address}`,
                { timeout: 30000 }
            );
            
            const html = response.data;
            
            // 2. Extrair TODOS os outputs (formato: txid:vout)
            // Regex flexível: <a class=collapse href=/output/TXID:VOUT>
            const outputPattern = /<a\s*class=collapse\s*href=\/output\/([a-f0-9]{64}):(\d+)>/gi;
            const outputs = [];
            let match;
            
            while ((match = outputPattern.exec(html)) !== null) {
                outputs.push({
                    txid: match[1],
                    vout: parseInt(match[2])
                });
            }
            
            console.log(`   📊 Found ${outputs.length} total outputs for address`);
            
            if (outputs.length === 0) {
                console.log(`   ⚠️  No outputs found for this address`);
                return [];
            }
            
            // 3. Para cada output, verificar se contém a rune específica
            // ⚡ Limitar a 50 outputs para não demorar muito (otimização)
            const outputsToCheck = outputs.slice(0, 50);
            console.log(`   🔍 Checking first ${outputsToCheck.length} outputs for rune "${runeName}"...`);
            
            const runeUtxos = [];
            let checked = 0;
            
            for (const output of outputsToCheck) {
                try {
                    checked++;
                    console.log(`   [${checked}/${outputsToCheck.length}] Checking ${output.txid.substring(0,16)}...:${output.vout}`);
                    
                    // Usar QuickNode em vez de ORD_SERVER_URL (localhost:80)
                    const outpoint = `${output.txid}:${output.vout}`;
                    const outputData = await quicknode.getOutput(outpoint);
                    
                    // Delay para respeitar rate limit
                    await new Promise(r => setTimeout(r, 120));
                    
                    // Verificar se este output contém a rune que procuramos
                    if (outputData.runes && outputData.runes[runeName]) {
                        const runeInfo = outputData.runes[runeName];
                        
                        if (runeInfo.amount > 0) {
                            console.log(`      ✅ Found ${runeName}: ${runeInfo.amount} units`);
                            
                            runeUtxos.push({
                                txid: output.txid,
                                vout: output.vout,
                                amount: runeInfo.amount
                            });
                        }
                    }
                } catch (err) {
                    // Ignorar erros individuais (output pode ter sido gasto ou timeout)
                    if (err.response?.status === 404) {
                        // Output foi gasto
                    } else {
                        console.log(`   ⚠️  Error checking output ${output.txid}:${output.vout}: ${err.message}`);
                    }
                }
            }
            
            console.log(`   ✅ Found ${runeUtxos.length} UTXOs containing "${runeName}" (checked ${checked}/${outputs.length} outputs)`);
            return runeUtxos;
            
        } catch (error) {
            console.error(`❌ Error getting rune UTXOs:`, error.message);
            return [];
        }
    }

    /**
     * Busca detalhes de uma rune específica no ORD server
     */
    async getRuneDetails(runeName) {
        try {
            const response = await axios.get(
                `${ORD_SERVER_URL}/rune/${encodeURIComponent(runeName)}`,
                { timeout: 5000 }
            );

            const html = response.data;
            
            // Extrair informações
            let parentId = null;
            const parentMatch = html.match(/<dt>parent<\/dt>\s*<dd><a[^>]*href=\/inscription\/([^>]+)>/i);
            if (parentMatch) {
                parentId = parentMatch[1];
            }

            let etching = null;
            const etchingMatch = html.match(/<dt>etching<\/dt>\s*<dd><a[^>]*href=\/tx\/([^>]+)>/i);
            if (etchingMatch) {
                etching = etchingMatch[1];
            }

            let supply = null;
            const supplyMatch = html.match(/<dt>supply<\/dt>\s*<dd>([^<]+)<\/dd>/i);
            if (supplyMatch) {
                supply = supplyMatch[1].trim();
            }

            let symbol = null;
            const symbolMatch = html.match(/<dt>symbol<\/dt>\s*<dd>([^<]+)<\/dd>/i);
            if (symbolMatch) {
                symbol = symbolMatch[1].trim();
            }

            // Extrair Rune ID (número: block:tx)
            let runeId = null;
            const runeIdMatch = html.match(/<dt>id<\/dt>\s*<dd>([0-9]+:[0-9]+)<\/dd>/i);
            if (runeIdMatch) {
                runeId = runeIdMatch[1];
            }

            // ✅ CRÍTICO: Extrair DIVISIBILITY (decimais)
            let divisibility = 0;
            const divisibilityMatch = html.match(/<dt>divisibility<\/dt>\s*<dd>([0-9]+)<\/dd>/i);
            if (divisibilityMatch) {
                divisibility = parseInt(divisibilityMatch[1]);
            }

            return {
                parent: parentId,
                parentPreview: parentId ? `${ORD_SERVER_URL}/content/${parentId}` : null,
                etching: etching,
                supply: supply,
                symbol: symbol || '⧈',
                runeId: runeId,  // CRÍTICO para construir PSBT!
                divisibility: divisibility  // CRÍTICO para calcular amount correto!
            };

        } catch (error) {
            console.error(`❌ Error getting rune details for ${runeName}:`, error.message);
            return {
                parent: null,
                parentPreview: null,
                etching: null,
                supply: null,
                symbol: '⧈'
            };
        }
    }

    /**
     * Busca runes decodificando Runestones diretamente das transações
     * Método oficial: analisa os edicts nos OP_RETURN das transações
     */
    async getRunesFromRunestones(address) {
        try {
            console.log(`🔍 [RUNESTONE METHOD] Searching runes for address: ${address}`);
            
            // 1. Buscar UTXOs do endereço
            console.log('📡 Fetching UTXOs from mempool.space...');
            const utxosResponse = await axios.get(
                `https://mempool.space/api/address/${address}/utxo`,
                { timeout: 10000 }
            );
            
            const utxos = utxosResponse.data;
            console.log(`✅ Found ${utxos.length} UTXOs`);
            
            if (utxos.length === 0) {
                return [];
            }
            
            // 2. Função para buscar hex de transação
            const getTxHex = async (txid) => {
                try {
                    const response = await axios.get(
                        `https://mempool.space/api/tx/${txid}/hex`,
                        { timeout: 10000 }
                    );
                    return response.data;
                } catch (error) {
                    console.error(`❌ Error fetching tx ${txid}:`, error.message);
                    return null;
                }
            };
            
            // 3. Decodificar Runestones
            const runes = await getRunesFromUtxos(address, utxos, getTxHex);
            
            // 4. Buscar nomes das runes (via Rune ID lookup no ord server)
            for (const rune of runes) {
                try {
                    // Buscar detalhes da rune pelo Rune ID
                    const details = await this.getRuneDetailsByRuneId(rune.runeId);
                    if (details.name) {
                        rune.name = details.name;
                        rune.displayName = `${details.name} ${details.symbol || ''}`.trim();
                        rune.symbol = details.symbol || '⧈';
                    }
                } catch (error) {
                    console.error(`⚠️  Could not fetch name for rune ${rune.runeId}`);
                }
            }
            
            return runes;
            
        } catch (error) {
            console.error(`❌ Error in getRunesFromRunestones:`, error.message);
            return [];
        }
    }

    /**
     * Busca detalhes de uma rune pelo Rune ID (block:tx)
     */
    async getRuneDetailsByRuneId(runeId) {
        try {
            console.log(`🔍 Looking up Rune ID: ${runeId}`);
            
            // Buscar no ord server: /rune/{runeId}
            const response = await axios.get(
                `${ORD_SERVER_URL}/rune/${runeId}`,
                { timeout: 10000 }
            );
            
            const html = response.data;
            
            // Extrair nome do <h1>
            const nameMatch = html.match(/<h1>([^<]+)<\/h1>/);
            const name = nameMatch ? nameMatch[1].trim() : `RUNE_${runeId}`;
            
            console.log(`✅ Found name: ${name}`);
            
            // Extrair symbol/emoji
            const symbolMatch = html.match(/<dt>symbol<\/dt>\s*<dd>([^<]+)<\/dd>/);
            const symbol = symbolMatch ? symbolMatch[1].trim() : '⧈';
            
            return {
                name,
                symbol
            };
            
        } catch (error) {
            console.error(`⚠️  Error looking up Rune ID ${runeId}:`, error.message);
            return {
                name: `RUNE_${runeId}`,
                symbol: '⧈'
            };
        }
    }
}

export default new RunesDecoder();

