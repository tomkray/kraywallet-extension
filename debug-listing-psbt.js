/**
 * Debug: Verificar se o listing PSBT tem assinatura do seller
 */

import { db } from './server/db/init.js';
import * as bitcoin from 'bitcoinjs-lib';

const listing = db.prepare(`
    SELECT * FROM atomic_listings 
    WHERE order_id = 'ord_7fe30eda8e97c214de85ad5d2568577d'
`).get();

if (!listing) {
    console.log('❌ Listing not found');
    process.exit(1);
}

console.log('\n📦 Listing Details:');
console.log(`   Order ID: ${listing.order_id}`);
console.log(`   Status: ${listing.status}`);
console.log(`   Price: ${listing.price_sats} sats`);
console.log(`   Inscription: ${listing.inscription_id}`);

// Parse PSBT
const psbtBase64 = listing.listing_psbt_base64;

if (!psbtBase64) {
    console.log('❌ No PSBT in listing');
    process.exit(1);
}

try {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    
    console.log(`\n✅ PSBT parsed successfully`);
    console.log(`   Inputs: ${psbt.inputCount}`);
    console.log(`   Outputs: ${psbt.txOutputs.length}`);
    
    // Check input[0] (seller input)
    const input0 = psbt.data.inputs[0];
    
    console.log('\n📋 Input[0] (Seller Input):');
    console.log(`   Has tapKeySig: ${!!input0.tapKeySig}`);
    console.log(`   Has sighashType: ${!!input0.sighashType}`);
    console.log(`   Has witnessUtxo: ${!!input0.witnessUtxo}`);
    console.log(`   Has tapInternalKey: ${!!input0.tapInternalKey}`);
    
    if (input0.tapKeySig) {
        console.log(`   tapKeySig length: ${input0.tapKeySig.length} bytes`);
        console.log(`   tapKeySig (hex): ${input0.tapKeySig.toString('hex')}`);
    } else {
        console.log('   ❌ NO SIGNATURE! Seller needs to sign first!');
    }
    
    if (input0.sighashType !== undefined) {
        console.log(`   sighashType: ${input0.sighashType} (0x${input0.sighashType.toString(16)})`);
    } else {
        console.log('   ❌ NO sighashType!');
    }
    
} catch (error) {
    console.error('❌ Error parsing PSBT:', error.message);
    process.exit(1);
}

process.exit(0);

