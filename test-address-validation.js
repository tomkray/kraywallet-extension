import bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

const addresses = [
    'bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx', // from
    'bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag'  // to
];

const network = bitcoin.networks.bitcoin;

console.log('🔍 Testing Address Validation...\n');

addresses.forEach((addr, i) => {
    console.log(`Address ${i + 1}: ${addr}`);
    
    try {
        const script = bitcoin.address.toOutputScript(addr, network);
        console.log(`  ✅ Valid!`);
        console.log(`  Script (hex): ${script.toString('hex')}`);
        console.log(`  Script length: ${script.length} bytes`);
        
        // Verificar se é Taproot (P2TR)
        if (script.length === 34 && script[0] === 0x51 && script[1] === 0x20) {
            console.log(`  Type: P2TR (Taproot)`);
            const pubkey = script.slice(2);
            console.log(`  Pubkey (hex): ${pubkey.toString('hex')}`);
            console.log(`  Pubkey length: ${pubkey.length} bytes`);
        }
        
    } catch (error) {
        console.log(`  ❌ Invalid: ${error.message}`);
    }
    console.log('');
});

// Testar criação de PSBT simples
console.log('\n🔨 Testing PSBT Creation...\n');

try {
    const psbt = new bitcoin.Psbt({ network });
    
    // Adicionar output de teste
    psbt.addOutput({
        address: addresses[1], // to address
        value: 546
    });
    
    console.log('✅ PSBT output added successfully');
    console.log('Output script:', psbt.txOutputs[0].script.toString('hex'));
    console.log('Output value:', psbt.txOutputs[0].value);
    
} catch (error) {
    console.error('❌ Error creating PSBT:', error.message);
}

