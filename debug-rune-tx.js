import bitcoin from 'bitcoinjs-lib';

const txHex = '020000000001033e74f661214c384c30bab02629eee685b53494030df719f22fa3caab7715e6420000000000ffffffffeda29da2f39ecf397a2c97ecf39da2ed052a2c97ecf39da2ed717500e896d0390be33ff1052a2c97ecf39da2ed0200000000ffffffff797e890f2684422f6f08c74a17c90e3c903b08979c881c105dbd887a6723c6590000000000ffffffff0400000000000000096a5dc0a23303f403012202000000000000225120423dc471ae54ddaf1ef941f7c92a9d8357d8c58fd7d0b9009be3613c368cce22020000000000002251206a79e69c5ac55be1ab75130c788a935508837836b9bc5d5dab697b949e97fd8a1d23000000000000225120609ea69c5ac55be1ab75130c788a935150837836b9bc5d5dab697b949e97fd8a01406e1a5c3b8f2d4e7a6b9c0f8a7e6d5c4b3a29180f0e1d2c3b4a5968778695a4b3c2d1e0f918273645566778899aabbccddeeff00112233445566778899aabbcc014098765432109876543210987654321098765432109876543210987654321098765432109876543210987654321098765432109876543210987654321098765432109876543210140abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef00000000';

console.log('🔍 Decoding Rune Transaction...\n');

try {
    const tx = bitcoin.Transaction.fromHex(txHex);
    
    console.log('Transaction ID:', tx.getId());
    console.log('Version:', tx.version);
    console.log('Inputs:', tx.ins.length);
    console.log('Outputs:', tx.outs.length);
    console.log('\n📤 OUTPUTS:\n');
    
    tx.outs.forEach((output, i) => {
        console.log(`Output ${i}:`);
        console.log(`  Value: ${output.value} sats`);
        console.log(`  Script (hex): ${output.script.toString('hex')}`);
        console.log(`  Script length: ${output.script.length} bytes`);
        
        // Tentar decodificar o endereço
        try {
            const address = bitcoin.address.fromOutputScript(output.script, bitcoin.networks.bitcoin);
            console.log(`  Address: ${address}`);
        } catch (e) {
            if (output.script[0] === 0x6a) {
                console.log(`  Type: OP_RETURN (Runestone)`);
                // Decodificar runestone
                const runeData = output.script.slice(1).toString('hex');
                console.log(`  Runestone data: ${runeData}`);
            } else {
                console.log(`  ⚠️  Cannot decode address: ${e.message}`);
            }
        }
        console.log('');
    });
    
} catch (error) {
    console.error('❌ Error decoding transaction:', error.message);
}

