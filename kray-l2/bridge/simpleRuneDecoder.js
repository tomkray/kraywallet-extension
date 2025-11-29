/**
 * Simple Runestone Decoder - Copied from working popup.js
 * Decodes Rune ID from OP_RETURN
 */

import { getRawTransaction } from './bitcoinRpc.js';
import * as bitcoin from 'bitcoinjs-lib';

export async function decodeRunesFromUTXO(txid, vout) {
  try {
    // Get transaction hex
    const txHex = await getRawTransaction(txid, false);
    const tx = bitcoin.Transaction.fromHex(txHex);
    
    // Find OP_RETURN with Runestone (6a5d)
    for (const output of tx.outs) {
      const script = output.script.toString('hex');
      
      if (script.startsWith('6a5d')) {
        // Decode Runestone
        const payload = script.substring(6);
        const buffer = [];
        for (let i = 0; i < payload.length; i += 2) {
          buffer.push(parseInt(payload.substring(i, i + 2), 16));
        }
        
        // Decode LEB128
        function decodeLEB128(bytes, offset = 0) {
          let result = 0;
          let shift = 0;
          let i = offset;
          while (i < bytes.length) {
            const byte = bytes[i++];
            result |= (byte & 0x7F) << shift;
            shift += 7;
            if (!(byte & 0x80)) break;
          }
          return { value: result, nextOffset: i };
        }
        
        // Decode values
        let offset = 0;
        const values = [];
        while (offset < buffer.length && values.length < 6) {
          const decoded = decodeLEB128(buffer, offset);
          values.push(decoded.value);
          offset = decoded.nextOffset;
        }
        
        const tag = values[0];
        if (tag === 0 && values.length >= 4) {
          const runeId = `${values[1]}:${values[2]}`;
          const amount = values[3] || 1; // Amount from edict
          
          console.log(`   ✅ Decoded: Rune ${runeId}, Amount: ${amount}`);
          
          return [{
            rune_id: runeId,
            amount: parseInt(amount)
          }];
        }
        
        console.log(`   ⚠️  Runestone found but couldn't decode (tag: ${tag})`);
        return [];
      }
    }
    
    return [];
  } catch (error) {
    console.error('Decode error:', error);
    return [];
  }
}

