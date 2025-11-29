/**
 * QuickNode Client for Vercel Serverless
 * Lightweight version sem cache (cada function é stateless)
 */

class QuickNodeClient {
  constructor() {
    this.endpoint = process.env.QUICKNODE_ENDPOINT;
    
    if (!this.endpoint) {
      throw new Error('QUICKNODE_ENDPOINT not configured');
    }
  }

  /**
   * Generic RPC call
   */
  async call(method, params = []) {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params
        })
      });

      if (!response.ok) {
        throw new Error(`QuickNode HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`QuickNode: ${data.error.message}`);
      }

      return data.result;
    } catch (error) {
      console.error(`QuickNode call failed (${method}):`, error.message);
      throw error;
    }
  }

  /**
   * Get inscription details
   */
  async getInscription(inscriptionId) {
    return await this.call('ord_getInscription', [inscriptionId]);
  }

  /**
   * Get rune details
   */
  async getRune(runeId) {
    return await this.call('ord_getRune', [runeId]);
  }

  /**
   * Get output details (inscriptions + runes)
   */
  async getOutput(outpoint) {
    return await this.call('ord_getOutput', [outpoint]);
  }
}

// Export singleton
export default new QuickNodeClient();






