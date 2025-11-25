import bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

const address = 'bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx';
const network = bitcoin.networks.bitcoin;

console.log('🔍 Verifying Taproot Address and Key...\n');
console.log('Address:', address);

try {
    // Decodificar o endereço
    const script = bitcoin.address.toOutputScript(address, network);
    console.log('ScriptPubKey:', script.toString('hex'));
    
    // Para P2TR, o formato é: OP_1 (0x51) + 32 bytes do X-only public key
    if (script.length === 34 && script[0] === 0x51 && script[1] === 0x20) {
        const xOnlyPubkey = script.slice(2);
        console.log('✅ Valid P2TR address');
        console.log('X-only Pubkey:', xOnlyPubkey.toString('hex'));
        console.log('Pubkey length:', xOnlyPubkey.length, 'bytes');
        
        // Este deveria ser o tapInternalKey usado no PSBT
        console.log('\n✅ This X-only pubkey should be used as tapInternalKey in PSBT');
        
        // Reconstruir o endereço a partir do pubkey
        const reconstructedScript = Buffer.concat([Buffer.from([0x51, 0x20]), xOnlyPubkey]);
        const reconstructedAddress = bitcoin.address.fromOutputScript(reconstructedScript, network);
        
        console.log('\n🔄 Verification:');
        console.log('Reconstructed address:', reconstructedAddress);
        console.log('Match:', reconstructedAddress === address ? '✅' : '❌');
        
    } else {
        console.log('❌ Not a valid P2TR address');
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
}

