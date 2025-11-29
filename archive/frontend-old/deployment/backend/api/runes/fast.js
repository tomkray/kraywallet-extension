/**
 * GET /api/runes/fast/[address]
 * Get runes for address with thumbnails (optimized)
 */

import quicknode from '../utils/quicknode.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({
      success: false,
      error: 'Address required'
    });
  }
  
  try {
    // 1. Buscar UTXOs via Mempool
    const utxosResponse = await fetch(
      `https://mempool.space/api/address/${address}/utxo`
    );
    const utxos = await utxosResponse.json();
    
    // 2. Verificar cada UTXO para runes
    const runesMap = new Map();
    
    for (const utxo of utxos) {
      const outpoint = `${utxo.txid}:${utxo.vout}`;
      
      try {
        const outputData = await quicknode.getOutput(outpoint);
        
        if (outputData.runes && Object.keys(outputData.runes).length > 0) {
          for (const [runeId, amount] of Object.entries(outputData.runes)) {
            if (runesMap.has(runeId)) {
              const existing = runesMap.get(runeId);
              existing.balance += BigInt(amount);
            } else {
              // Buscar detalhes da rune
              const runeDetails = await quicknode.getRune(runeId);
              
              runesMap.set(runeId, {
                runeId,
                name: runeDetails.entry.spaced_rune,
                spacedName: runeDetails.entry.spaced_rune,
                symbol: runeDetails.entry.symbol || '⧈',
                divisibility: runeDetails.entry.divisibility || 0,
                balance: BigInt(amount),
                thumbnail: runeDetails.parent 
                  ? `https://api.kraywallet.com/api/rune-thumbnail/${runeDetails.parent}`
                  : null
              });
            }
          }
        }
        
        // Rate limit
        await new Promise(r => setTimeout(r, 120));
        
      } catch (e) {
        console.error(`Error checking ${outpoint}:`, e.message);
      }
    }
    
    // 3. Formatar resposta
    const runes = Array.from(runesMap.values()).map(r => ({
      ...r,
      balance: r.balance.toString()
    }));
    
    return res.status(200).json({
      success: true,
      runes,
      count: runes.length
    });
    
  } catch (error) {
    console.error('Runes fast error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}






