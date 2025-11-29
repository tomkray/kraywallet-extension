/**
 * GET /api/wallet/balance/[address]
 * Get wallet balance via Mempool.space
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { address } = req.query;
  
  if (!address || typeof address !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Valid address required'
    });
  }
  
  try {
    // Buscar UTXOs via Mempool.space
    const utxosResponse = await fetch(
      `https://mempool.space/api/address/${address}/utxo`,
      { timeout: 10000 }
    );
    
    if (!utxosResponse.ok) {
      throw new Error(`Mempool API returned ${utxosResponse.status}`);
    }
    
    const utxos = await utxosResponse.json();
    
    // Calcular saldo total
    const balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    
    return res.status(200).json({
      success: true,
      address,
      balance,
      utxos: utxos.length,
      confirmed: utxos.filter(u => u.status?.confirmed).length,
      unconfirmed: utxos.filter(u => !u.status?.confirmed).length
    });
    
  } catch (error) {
    console.error('Balance error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}






