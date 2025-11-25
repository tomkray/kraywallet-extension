import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';

bitcoin.initEccLib(ecc);

// Do log
const xOnlyInternal = Buffer.from('e8a7c10aeb91761b2ae874a88ae6ffc0449187258ee7d46357d29628ed9b752c', 'hex');

// Output key esperado (do endereço bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx)
const expectedOutputKey = Buffer.from('609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a', 'hex');

console.log('🔑 Verificando chaves Taproot...\n');
console.log('Internal Key (x-only):', xOnlyInternal.toString('hex'));
console.log('Expected Output Key:', expectedOutputKey.toString('hex'));
console.log('');

// Calcular tweak
const tapTweak = bitcoin.crypto.taggedHash('TapTweak', xOnlyInternal);
console.log('Tap Tweak:', tapTweak.toString('hex'));
console.log('');

// Adicionar tweak ao internal key (point addition)
// Internal key precisa estar no formato de ponto (33 bytes com prefixo)
const internalPubkey = Buffer.concat([Buffer.from([0x02]), xOnlyInternal]); // Assume Y even
const tweakedPubkey = ecc.pointAddScalar(internalPubkey, tapTweak);

if (!tweakedPubkey) {
    console.log('❌ Failed to calculate tweaked pubkey!');
    process.exit(1);
}

console.log('Tweaked Pubkey (full):', tweakedPubkey.toString('hex'));

// Get x-only (remove first byte which is the parity)
const calculatedOutputKey = Buffer.from(tweakedPubkey.slice(1));
console.log('Tweaked Pubkey (x-only):', calculatedOutputKey.toString('hex'));
console.log('');

if (Buffer.compare(calculatedOutputKey, expectedOutputKey) === 0) {
    console.log('✅ OUTPUT KEY MATCHES!');
    console.log('   Internal key is CORRECT!');
} else {
    console.log('❌ OUTPUT KEY MISMATCH!');
    console.log('   Expected:', expectedOutputKey.toString('hex'));
    console.log('   Calculated:', calculatedOutputKey.toString('hex'));
    console.log('');
    console.log('   This means either:');
    console.log('   1. Wrong internal key is being used');
    console.log('   2. Tweak calculation is wrong');
    console.log('   3. Y parity assumption is wrong');
}

