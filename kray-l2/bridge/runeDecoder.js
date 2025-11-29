/**
 * KRAY SPACE L2 - Rune Decoder usando backend API
 * Usa o MESMO método que a extension usa (testado e funciona!)
 */

import axios from 'axios';

const BACKEND_API = process.env.BACKEND_API_URL || 'https://kraywallet-backend.onrender.com';

/**
 * Decode runes from UTXO usando backend API (TESTADO!)
 * Returns: Array of { rune_id, rune_name, amount, symbol }
 */
export async function decodeRunesFromUTXO(txid, vout) {
  try {
    console.log(`   🔍 Decoding runes via backend API...`);
    console.log(`   TXID: ${txid.substring(0, 16)}...`);
    console.log(`   Vout: ${vout}`);
    
    // Usar BACKEND API (igual extension faz!)
    const response = await axios.get(
      `${BACKEND_API}/api/output/${txid}:${vout}`,
      { timeout: 15000 }
    );
    
    if (!response.data || !response.data.success) {
      console.log('   ℹ️  No runes in this output (or API error)');
      return [];
    }
    
    // Backend retorna { success, runes: [{...}] } ou { success, rune: {...} }
    let runesData = response.data.runes || (response.data.rune ? [response.data.rune] : []);
    
    // Se for objeto único, converter para array
    if (!Array.isArray(runesData)) {
      runesData = [runesData];
    }
    
    console.log(`   ✅ Found ${runesData.length} rune(s)!`);
    
    // Format runes for L2
    return runesData.map(rune => ({
      rune_id: rune.rune_id || rune.id,
      rune_name: rune.rune_name || rune.name,
      amount: rune.amount,
      symbol: rune.symbol || rune.rune_name
    }));
    
  } catch (error) {
    console.error('   ❌ Backend API error:', error.message);
    console.log('   ℹ️  Trying fallback method...');
    
    // Fallback: Usar decoder local se backend falhar
    return await decodeLocalRunestone(txid, vout);
  }
}

/**
 * Fallback: Decode local se backend offline
 */
async function decodeLocalRunestone(txid, vout) {
  // Por enquanto retorna vazio
  // Pode implementar decoder local depois
  return [];
}

export default { decodeRunesFromUTXO };

