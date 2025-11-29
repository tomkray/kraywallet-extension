/**
 * 🪙 Runes Helper - QuickNode + Hiro API
 * Busca runes de um endereço usando APIs em nuvem
 */

import axios from 'axios';
import quicknode from './quicknode.js';
import bitcoinRpc from './bitcoinRpc.js';

/**
 * Get runes for an address - 100% QuickNode
 * Estratégia: Buscar UTXOs do endereço via Bitcoin RPC, depois verificar se têm runes
 */
export async function getRunesForAddress(address) {
    try {
        console.log(`🪙 Fetching runes for ${address}...`);
        console.log(`   📡 Using 100% QuickNode (Bitcoin RPC + Ord API)`);
        
        // 1️⃣ Buscar UTXOs do endereço via Bitcoin RPC (scantxoutset)
        console.log('   📡 Step 1: Getting UTXOs via Bitcoin RPC...');
        
        const descriptor = `addr(${address})`;
        const scanResult = await quicknode.call('scantxoutset', ['start', [descriptor]]);
        
        if (!scanResult || !scanResult.unspents || scanResult.unspents.length === 0) {
            console.log('   ℹ️  No UTXOs found for this address');
            return [];
        }
        
        console.log(`   ✅ Found ${scanResult.unspents.length} UTXOs`);
        
        // 2️⃣ Para cada UTXO, verificar se tem runes via ord_getOutput
        console.log('   📡 Step 2: Checking each UTXO for runes via ord_getOutput...');
        
        const runesMap = new Map(); // Agregar por rune ID
        
        for (const utxo of scanResult.unspents) {
            try {
                const outpoint = `${utxo.txid}:${utxo.vout}`;
                const outputData = await quicknode.getOutput(outpoint);
                
                // Verificar se tem runes neste UTXO
                if (outputData && outputData.runes) {
                    // outputData.runes é um objeto: { "runeId": amount, ... }
                    for (const [runeId, amount] of Object.entries(outputData.runes)) {
                        console.log(`      ✅ Found rune ${runeId}: ${amount} units in ${outpoint}`);
                        
                        if (runesMap.has(runeId)) {
                            // Somar amount
                            runesMap.get(runeId).amount += amount;
                            runesMap.get(runeId).utxos.push({
                                txid: utxo.txid,
                                vout: utxo.vout,
                                amount,
                                value: Math.round(utxo.amount * 100000000) // BTC to sats
                            });
                        } else {
                            // Nova rune encontrada
                            runesMap.set(runeId, {
                                runeId,
                                amount,
                                utxos: [{
                                    txid: utxo.txid,
                                    vout: utxo.vout,
                                    amount,
                                    value: Math.round(utxo.amount * 100000000)
                                }]
                            });
                        }
                    }
                }
            } catch (outputError) {
                // UTXO não tem runes ou erro, continuar
                console.log(`      ⚠️  No runes in ${utxo.txid}:${utxo.vout}`);
            }
        }
        
        // 3️⃣ Buscar detalhes de cada rune via QuickNode
        const runesWithDetails = [];
        
        for (const [runeId, runeData] of runesMap) {
            try {
                const details = await quicknode.getRune(runeId);
                
                runesWithDetails.push({
                    name: details.entry.spaced_rune,
                    displayName: details.entry.spaced_rune,
                    runeId: runeId,
                    amount: runeData.amount,
                    symbol: details.entry.symbol || '⧈',
                    divisibility: details.entry.divisibility || 0,
                    utxos: runeData.utxos,
                    etching: details.entry.etching,
                    supply: details.entry.premine + (details.entry.terms?.amount * details.entry.terms?.cap || 0),
                    mintable: details.mintable,
                    parent: details.parent
                });
                
                console.log(`      ✅ Rune: ${details.entry.spaced_rune} (${runeData.amount} units)`);
                
            } catch (detailsError) {
                console.warn(`      ⚠️  Could not get details for rune ${runeId}`);
                // Adicionar sem detalhes
                runesWithDetails.push({
                    runeId,
                    amount: runeData.amount,
                    symbol: '⧈',
                    utxos: runeData.utxos
                });
            }
        }
        
        console.log(`   ✅ Found ${runesWithDetails.length} different runes`);
        return runesWithDetails;
        
    } catch (error) {
        console.error(`❌ Error getting runes for ${address}:`, error.message);
        return [];
    }
}

/**
 * Fallback simples: retornar vazio se nada funcionar
 */
export async function getRunesForAddressFallback(address) {
    console.log('   🔄 Using fallback (empty) for runes');
    return [];
}

