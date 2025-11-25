/**
 * Script para testar qual é o erro EXATO do broadcast
 * Vamos capturar o último purchase_attempt FAILED e ver o que aconteceu
 */

import { db } from './server/db/init.js';

console.log('\n🔍 INVESTIGATING LAST BROADCAST FAILURE\n');

// Buscar último attempt FAILED
const lastAttempt = db.prepare(`
    SELECT * FROM purchase_attempts 
    WHERE state = 'FAILED' 
    ORDER BY created_at DESC 
    LIMIT 1
`).get();

if (!lastAttempt) {
    console.log('❌ No failed attempts found in database');
    process.exit(0);
}

console.log('📋 Last Failed Attempt:');
console.log(`   Attempt ID: ${lastAttempt.attempt_id}`);
console.log(`   Order ID: ${lastAttempt.order_id}`);
console.log(`   Buyer Address: ${lastAttempt.buyer_address}`);
console.log(`   Created: ${new Date(lastAttempt.created_at * 1000).toISOString()}`);
console.log(`   State: ${lastAttempt.state}`);
console.log(`   Buyer PSBT: ${lastAttempt.buyer_psbt_base64?.substring(0, 100)}...`);

// Buscar listing relacionado
const listing = db.prepare(`
    SELECT * FROM atomic_listings 
    WHERE order_id = ?
`).get(lastAttempt.order_id);

console.log('\n📦 Related Listing:');
console.log(`   Inscription ID: ${listing.inscription_id}`);
console.log(`   Price: ${listing.price_sats} sats`);
console.log(`   Seller: ${listing.seller_payout_address.substring(0, 20)}...`);
console.log(`   Status: ${listing.status}`);
console.log(`   Listing PSBT: ${listing.listing_psbt_base64?.substring(0, 100)}...`);

console.log('\n🔍 Analysis:');
console.log('   The error happened during broadcast (sendrawtransaction)');
console.log('   Possible causes:');
console.log('     1. Transaction validation failed (bad signatures)');
console.log('     2. Double-spend detected');
console.log('     3. Fees too low');
console.log('     4. Script verification failed');
console.log('\n   To debug further, we need to see the actual Bitcoin Core RPC error');
console.log('   The error message should be in the console logs when the server tries to broadcast');

process.exit(0);

