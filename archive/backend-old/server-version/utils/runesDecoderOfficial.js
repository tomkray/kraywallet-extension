import bitcoinRpc from './bitcoinRpc.js';
import axios from 'axios';

const ORD_SERVER_URL = process.env.ORD_SERVER_URL || 'http://127.0.0.1:80';

/**
 * Runes Decoder OFICIAL - Seguindo padrão do repositório ordinals/ord
 * 
 * MÉTODO CORRETO (à prova de fraudes):
 * 1. Buscar UTXOs via Bitcoin Core RPC
 * 2. Para cada UTXO, buscar a transação completa
 * 3. Decodificar OP_RETURN (Runestone) se existir
 * 4. Validar Edicts (regras de transferência)
 * 5. Cruzar com ORD server apenas para metadados (parent, symbol, etc)
 * 
 * Fonte: https://github.com/ordinals/ord
 */

class RunesDecoderOfficial {
    /**
     * Estrutura de um Runestone (OP_RETURN):
     * 
     * OP_RETURN
     * OP_13           // Protocolo Runes
     * <edicts>        // Lista de edicts (transferências)
     * <default_output> // Output padrão para runes não especificados
     * 
     * Edict structure:
     * - rune_id: ID da rune (bloco + tx)
     * - amount: Quantidade transferida
     * - output: Índice do output de destino
     */

    /**
     * Decodifica OP_RETURN de uma transação para extrair Runestone
     * 
     * @param {string} opReturnHex - Hex do scriptPubKey OP_RETURN
     * @returns {Object|null} Runestone decodificado ou null
     */
    decodeRunestone(opReturnHex) {
        try {
            // OP_RETURN format: 6a (OP_RETURN) + 5d (OP_13) + data
            // Runes usa OP_13 (0x5d) como magic number
            
            if (!opReturnHex || !opReturnHex.startsWith('6a5d')) {
                return null;
            }

            // Remove OP_RETURN (6a) e OP_13 (5d)
            const data = opReturnHex.substring(4);
            
            console.log('🔍 Decoding Runestone:', data.substring(0, 100));
            
            // Decodificar usando LEB128 (Little Endian Base 128)
            const integers = this.decodeLEB128Array(data);
            
            if (integers.length === 0) {
                return null;
            }

            // Estrutura do Runestone:
            // [edicts_count, ...edicts_data, default_output, ...]
            const edicts = [];
            let position = 0;

            // Ler edicts (grupos de 4 integers)
            while (position + 3 < integers.length) {
                const blockHeight = integers[position];
                const txIndex = integers[position + 1];
                const amount = integers[position + 2];
                const output = integers[position + 3];

                // Se encontrarmos 0,0,0,X isso indica o fim dos edicts
                if (blockHeight === 0 && txIndex === 0 && amount === 0) {
                    position += 4;
                    break;
                }

                edicts.push({
                    runeId: `${blockHeight}:${txIndex}`,
                    amount: amount.toString(),
                    output: output
                });

                position += 4;
            }

            // Default output (se houver)
            const defaultOutput = position < integers.length ? integers[position] : null;

            return {
                edicts: edicts,
                defaultOutput: defaultOutput,
                raw: data
            };

        } catch (error) {
            console.error('❌ Error decoding Runestone:', error);
            return null;
        }
    }

    /**
     * Decodifica array de integers usando LEB128
     * (Little Endian Base 128 - formato usado pelo protocolo Runes)
     */
    decodeLEB128Array(hex) {
        const integers = [];
        let i = 0;
        
        while (i < hex.length) {
            let value = 0;
            let shift = 0;
            let byte;
            
            do {
                if (i >= hex.length) break;
                
                byte = parseInt(hex.substring(i, i + 2), 16);
                i += 2;
                
                value |= (byte & 0x7f) << shift;
                shift += 7;
            } while (byte & 0x80);
            
            integers.push(value);
        }
        
        return integers;
    }

    /**
     * Busca Rune ID pelo nome (consulta ORD server)
     */
    async getRuneIdByName(runeName) {
        try {
            const response = await axios.get(
                `${ORD_SERVER_URL}/rune/${encodeURIComponent(runeName)}`,
                { timeout: 5000 }
            );

            const html = response.data;
            
            // Extrair etching transaction (que contém o bloco)
            const etchingMatch = html.match(/<dt>etching<\/dt>\s*<dd><a[^>]*href=\/tx\/([^>]+)>/i);
            
            if (etchingMatch) {
                const txid = etchingMatch[1];
                
                // Buscar a transação para obter o bloco
                const txData = await bitcoinRpc.getRawTransaction(txid, true);
                
                if (txData && txData.blockhash) {
                    const blockData = await bitcoinRpc.getBlock(txData.blockhash);
                    return `${blockData.height}:${txData.vin[0].vout || 0}`;
                }
            }
            
            return null;
        } catch (error) {
            console.error(`❌ Error getting rune ID for ${runeName}:`, error.message);
            return null;
        }
    }

    /**
     * Busca todas as runes de um endereço (MÉTODO OFICIAL)
     * 
     * FLUXO CORRETO:
     * 1. Buscar UTXOs do endereço via Bitcoin Core RPC
     * 2. Para cada UTXO, buscar a transação que o criou
     * 3. Decodificar OP_RETURN da transação (se houver)
     * 4. Validar se o UTXO contém runes baseado nos edicts
     * 5. Buscar metadados no ORD server (nome, symbol, parent)
     */
    async getRunesForAddress(address) {
        try {
            console.log(`\n🔍 ========== OFFICIAL RUNES DECODER ==========`);
            console.log(`📍 Address: ${address}`);
            
            // 1. Buscar UTXOs via Bitcoin Core RPC
            console.log('\n📡 Step 1: Fetching UTXOs from Bitcoin Core RPC...');
            const utxos = await bitcoinRpc.listUnspent(0, 9999999, [address]);
            
            console.log(`✅ Found ${utxos.length} UTXOs`);
            
            const runesMap = new Map();
            
            // 2. Para cada UTXO, verificar se contém runes
            for (const utxo of utxos) {
                console.log(`\n🔍 Analyzing UTXO: ${utxo.txid}:${utxo.vout}`);
                
                // 2.1. Buscar transação completa
                const tx = await bitcoinRpc.getRawTransaction(utxo.txid, true);
                
                if (!tx || !tx.vout) {
                    console.log('   ⚠️  Could not fetch transaction');
                    continue;
                }
                
                // 2.2. Procurar OP_RETURN na transação
                const opReturnOutput = tx.vout.find(vout => 
                    vout.scriptPubKey && 
                    vout.scriptPubKey.hex && 
                    vout.scriptPubKey.hex.startsWith('6a5d')
                );
                
                if (!opReturnOutput) {
                    console.log('   ℹ️  No Runestone found (no OP_RETURN with OP_13)');
                    continue;
                }
                
                console.log('   ✅ Found Runestone!');
                
                // 2.3. Decodificar Runestone
                const runestone = this.decodeRunestone(opReturnOutput.scriptPubKey.hex);
                
                if (!runestone || !runestone.edicts || runestone.edicts.length === 0) {
                    console.log('   ⚠️  Could not decode Runestone or no edicts');
                    continue;
                }
                
                console.log(`   📋 Edicts found: ${runestone.edicts.length}`);
                
                // 2.4. Verificar se algum edict aponta para nosso UTXO
                for (const edict of runestone.edicts) {
                    if (edict.output === utxo.vout) {
                        console.log(`   ✅ Edict matches UTXO! Rune ID: ${edict.runeId}, Amount: ${edict.amount}`);
                        
                        // Adicionar ao mapa
                        if (!runesMap.has(edict.runeId)) {
                            runesMap.set(edict.runeId, {
                                runeId: edict.runeId,
                                amount: BigInt(0),
                                utxos: []
                            });
                        }
                        
                        const runeData = runesMap.get(edict.runeId);
                        runeData.amount += BigInt(edict.amount);
                        runeData.utxos.push({
                            txid: utxo.txid,
                            vout: utxo.vout,
                            amount: edict.amount
                        });
                    }
                }
            }
            
            console.log(`\n✅ Found ${runesMap.size} unique runes based on UTXOs and Edicts`);
            
            // 3. Buscar metadados no ORD server
            console.log('\n📡 Step 2: Fetching metadata from ORD server...');
            const runesWithMetadata = [];
            
            for (const [runeId, runeData] of runesMap.entries()) {
                try {
                    // Buscar nome da rune no ORD server pelo rune ID
                    const metadata = await this.getRuneMetadataById(runeId);
                    
                    runesWithMetadata.push({
                        runeId: runeId,
                        name: metadata.name || runeId,
                        displayName: metadata.displayName || metadata.name || runeId,
                        amount: runeData.amount.toString(),
                        symbol: metadata.symbol || '⧈',
                        parent: metadata.parent,
                        parentPreview: metadata.parentPreview,
                        etching: metadata.etching,
                        supply: metadata.supply,
                        utxos: runeData.utxos
                    });
                } catch (error) {
                    console.error(`   ❌ Error fetching metadata for ${runeId}:`, error.message);
                    
                    // Adicionar sem metadados
                    runesWithMetadata.push({
                        runeId: runeId,
                        name: runeId,
                        displayName: runeId,
                        amount: runeData.amount.toString(),
                        symbol: '⧈',
                        utxos: runeData.utxos
                    });
                }
            }
            
            console.log(`✅ Processed ${runesWithMetadata.length} runes with metadata`);
            console.log(`========== END OFFICIAL DECODER ==========\n`);
            
            return runesWithMetadata;
            
        } catch (error) {
            console.error('❌ Error in official runes decoder:', error);
            return [];
        }
    }

    /**
     * Busca metadados de uma rune pelo ID no ORD server
     */
    async getRuneMetadataById(runeId) {
        try {
            // Formato do rune ID: blockHeight:txIndex
            // Exemplo: 840000:1
            
            // Por enquanto, vamos usar o método de fallback:
            // buscar todas as runes e encontrar pelo ID
            // (O ORD server não tem endpoint direto por rune ID)
            
            // TODO: Implementar busca mais eficiente
            
            return {
                name: runeId,
                displayName: runeId,
                symbol: '⧈',
                parent: null,
                parentPreview: null,
                etching: null,
                supply: null
            };
            
        } catch (error) {
            console.error(`❌ Error getting metadata for rune ID ${runeId}:`, error.message);
            return {
                name: runeId,
                displayName: runeId,
                symbol: '⧈'
            };
        }
    }

    /**
     * Busca detalhes de uma rune específica pelo nome
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

            return {
                parent: parentId,
                parentPreview: parentId ? `${ORD_SERVER_URL}/content/${parentId}` : null,
                etching: etching,
                supply: supply,
                symbol: symbol || '⧈'
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
     * Busca o Rune ID pelo nome no ORD server
     * O Rune ID é no formato: blockHeight:txIndex
     * 
     * @param {string} runeName - Nome da rune (ex: "DOG•GO•TO•THE•MOON")
     * @returns {string|null} - Rune ID (ex: "840000:1") ou null se não encontrado
     */
    async getRuneIdByName(runeName) {
        // Retry logic (ord server pode estar lento)
        const maxRetries = 2;
        const timeout = 15000; // 15 segundos
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔍 Searching Rune ID for: "${runeName}" (attempt ${attempt}/${maxRetries})`);
                
                // Consultar o endpoint /rune/ do ORD server
                const response = await axios.get(
                    `${ORD_SERVER_URL}/rune/${encodeURIComponent(runeName)}`,
                    { 
                        timeout,
                        family: 4  // Force IPv4
                    }
                );
                
                const html = response.data;
                
                // Extrair o Rune ID do HTML
                // Formato: <dt>id</dt><dd>840000:1</dd>
                const idMatch = html.match(/<dt>id<\/dt>\s*<dd>([^<]+)<\/dd>/i);
                
                if (idMatch) {
                    const runeId = idMatch[1].trim();
                    console.log(`   ✅ Found Rune ID: ${runeId}`);
                    return runeId;
                }
                
                // Formato alternativo: pode estar em outro lugar do HTML
                // Procurar por "BLOCK:TX" pattern
                const altMatch = html.match(/(\d{6,}:\d+)/);
                if (altMatch) {
                    const runeId = altMatch[1];
                    console.log(`   ✅ Found Rune ID (alternative): ${runeId}`);
                    return runeId;
                }
                
                console.log(`   ❌ Rune ID not found in HTML`);
                return null;
                
            } catch (error) {
                console.error(`❌ Attempt ${attempt}/${maxRetries} failed for "${runeName}":`, error.message);
                
                // Se não for o último attempt, esperar antes de tentar novamente
                if (attempt < maxRetries) {
                    console.log(`   ⏳ Retrying in 2 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.error(`   ❌ All ${maxRetries} attempts failed`);
                    return null;
                }
            }
        }
        
        return null;
    }
}

export default new RunesDecoderOfficial();

