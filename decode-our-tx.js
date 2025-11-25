import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

// Nossa TX mais recente (com 2 edicts)
const ourTxHex = '02000000000102211b44209e9b41ca05739160184ae436dd677e6ede6b19129df12cf4202b95b10000000000ffffffff59c623677a88bd5d101c889c97083b903c0ec9174ac7086f2f4284260f897e790000000000ffffffff040000000000000000106a5d0a00c0a23303f403010000f403022202000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a22020000000000002251204231fc471ae54ddaf1ef941f7c92a9d83573d8c58fd7d0b9009be3613c368cce3421000000000000225120609ea69c5ac55be1ab75130c788a934510837836b9bc5d5dab697b949e97fd8a0140d2e7e39953f02f75bccb8a291fb311383acbdd6647434571b3fda61ad695733eb42eb80ad18a2321d9babe23f8e7422d8a2ea7b336cc970a52916b9fe10fc63f014095506f465870f92ff10114b4a18ce909a81b218bf74a3467803d47126f813445358ea144e44dce14f828c0c876ae358b8003929aeb36acfc496b130e2ca0d3bb00000000';

const tx = bitcoin.Transaction.fromHex(ourTxHex);

console.log('🔬 ANÁLISE COMPLETA DA TRANSAÇÃO\n');

console.log('📊 ESTRUTURA:');
console.log('  Version:', tx.version);
console.log('  Inputs:', tx.ins.length);
console.log('  Outputs:', tx.outs.length);
console.log('  Locktime:', tx.locktime);
console.log('  Has witnesses:', tx.hasWitnesses());

console.log('\n\n📤 OUTPUTS:');
tx.outs.forEach((out, i) => {
    console.log(`\n  Output ${i}:`);
    console.log(`    Value: ${out.value} sats`);
    console.log(`    Script hex: ${out.script.toString('hex')}`);
    console.log(`    Script length: ${out.script.length} bytes`);
    
    if (i === 0) {
        // OP_RETURN
        console.log(`    Type: OP_RETURN (Runestone)`);
        const runestoneData = out.script.toString('hex').substring(4); // Remove 6a5d
        console.log(`    Runestone data: ${runestoneData}`);
        
        // Decode LEB128
        function decodeLeb128(hex) {
            const bytes = Buffer.from(hex, 'hex');
            const values = [];
            let i = 0;
            
            while (i < bytes.length) {
                let value = 0;
                let shift = 0;
                
                while (i < bytes.length) {
                    const byte = bytes[i++];
                    value |= (byte & 0x7f) << shift;
                    
                    if ((byte & 0x80) === 0) {
                        break;
                    }
                    shift += 7;
                }
                
                values.push(value);
            }
            
            return values;
        }
        
        const values = decodeLeb128(runestoneData);
        console.log(`    Decoded: ${JSON.stringify(values)}`);
        console.log(`    Interpretation:`);
        console.log(`      [0] ${values[0]} = Tag (10 = Body)`);
        console.log(`      [1] ${values[1]} = Delimiter`);
        console.log(`      [2] ${values[2]} = blockHeight (edict 1)`);
        console.log(`      [3] ${values[3]} = txIndex (edict 1)`);
        console.log(`      [4] ${values[4]} = amount (edict 1) = ${values[4]} units`);
        console.log(`      [5] ${values[5]} = output (edict 1) = output ${values[5]}`);
        console.log(`      [6] ${values[6]} = blockDelta (edict 2)`);
        console.log(`      [7] ${values[7]} = txDelta (edict 2)`);
        console.log(`      [8] ${values[8]} = amount (edict 2) = ${values[8]} units`);
        console.log(`      [9] ${values[9]} = output (edict 2) = output ${values[9]}`);
    } else {
        try {
            const address = bitcoin.address.fromOutputScript(out.script, bitcoin.networks.bitcoin);
            console.log(`    Address: ${address}`);
        } catch (e) {
            console.log(`    Address: (unable to decode)`);
        }
    }
});

console.log('\n\n💡 ANÁLISE:');
console.log('  Runestone aponta:');
console.log('    Edict 1: 500 units → output 1');
console.log('    Edict 2: 500 units → output 2');
console.log('  ');
console.log('  Outputs físicos:');
console.log('    Output 0: OP_RETURN');
console.log('    Output 1: 546 sats (change address)');
console.log('    Output 2: 546 sats (recipient)');
console.log('    Output 3: 8500 sats (BTC change)');
console.log('  ');
console.log('  ✅ ESTRUTURA PARECE CORRETA!');
console.log('  ');
console.log('  🤔 POSSÍVEIS PROBLEMAS:');
console.log('  1. Ordem dos edicts pode estar incorreta?');
console.log('  2. Change de runes deve ir para output específico?');
console.log('  3. Protocolo espera apenas 1 edict quando tem change?');

