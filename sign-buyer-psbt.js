#!/usr/bin/env node

/**
 * 🛍️ SCRIPT: Assinar PSBT do Buyer
 * 
 * USO:
 *   node sign-buyer-psbt.js <BUYER_PSBT_BASE64> <BUYER_WIF>
 * 
 * EXEMPLO:
 *   node sign-buyer-psbt.js "cHNidP8BAFUCA..." "cT1...buyer-wif..."
 */

import bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// 🌐 Network (altere se necessário)
const NETWORK = bitcoin.networks.testnet; // ou bitcoin.networks.bitcoin

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDAR ARGUMENTOS
// ═══════════════════════════════════════════════════════════════════════════════

if (process.argv.length < 4) {
    console.error('\n❌ Uso incorreto!\n');
    console.error('USO:');
    console.error('  node sign-buyer-psbt.js <BUYER_PSBT_BASE64> <BUYER_WIF>\n');
    console.error('EXEMPLO:');
    console.error('  node sign-buyer-psbt.js "cHNidP8BAFUCA..." "cT1...buyer-wif..."\n');
    process.exit(1);
}

const buyerPsbtBase64 = process.argv[2];
const buyerWIF = process.argv[3];

console.log('\n🛍️  ═══════════════════════════════════════════════════════');
console.log('   BUYER PSBT SIGNER');
console.log('   SIGHASH: ALL (default)');
console.log('═══════════════════════════════════════════════════════\n');

// ═══════════════════════════════════════════════════════════════════════════════
// CARREGAR PSBT
// ═══════════════════════════════════════════════════════════════════════════════

let psbt;
try {
    psbt = bitcoin.Psbt.fromBase64(buyerPsbtBase64, { network: NETWORK });
    console.log('✅ PSBT carregada com sucesso\n');
} catch (error) {
    console.error('❌ Erro ao carregar PSBT:', error.message);
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARREGAR CHAVE PRIVADA
// ═══════════════════════════════════════════════════════════════════════════════

let keyPair;
try {
    keyPair = ECPair.fromWIF(buyerWIF, NETWORK);
    const publicKey = keyPair.publicKey.toString('hex');
    console.log('✅ Chave privada do buyer carregada');
    console.log(`   Public Key: ${publicKey}\n`);
} catch (error) {
    console.error('❌ Erro ao carregar chave privada:', error.message);
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICAR PSBT
// ═══════════════════════════════════════════════════════════════════════════════

console.log('📊 PSBT INFO:');
console.log(`   Inputs: ${psbt.data.inputs.length}`);
console.log(`   Outputs: ${psbt.txOutputs.length}\n`);

if (psbt.data.inputs.length < 2) {
    console.error('❌ PSBT deve ter pelo menos 2 inputs (seller + buyer)!');
    process.exit(1);
}

console.log('📊 OUTPUTS:');
psbt.txOutputs.forEach((output, idx) => {
    console.log(`   Output[${idx}]: ${output.value} sats`);
});
console.log('\n');

// ═══════════════════════════════════════════════════════════════════════════════
// ASSINAR INPUTS DO BUYER (input[1] em diante)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('🖊️  Assinando inputs do buyer...\n');

let signedCount = 0;

for (let i = 1; i < psbt.data.inputs.length; i++) {
    console.log(`   [${i}] Assinando input ${i}...`);
    
    try {
        // Verificar se já está assinado
        if (psbt.data.inputs[i].partialSig && psbt.data.inputs[i].partialSig.length > 0) {
            console.log(`       ⚠️  Input ${i} já está assinado, pulando...`);
            continue;
        }

        // Assinar com SIGHASH_ALL (padrão)
        psbt.signInput(i, keyPair);
        
        // Validar assinatura
        const validated = psbt.validateSignaturesOfInput(i, (pubkey, msghash, signature) => {
            return ECPair.fromPublicKey(pubkey, { network: NETWORK }).verify(msghash, signature);
        });

        if (validated) {
            console.log(`       ✅ Input ${i} assinado e validado`);
            signedCount++;
        } else {
            console.log(`       ❌ Input ${i} assinatura inválida`);
        }
    } catch (error) {
        console.log(`       ⚠️  Erro ao assinar input ${i}: ${error.message}`);
        // Continuar mesmo com erro (pode ser input do seller)
    }
}

console.log(`\n   ✅ Total de inputs assinados: ${signedCount}\n`);

if (signedCount === 0) {
    console.error('❌ Nenhum input foi assinado! Verifique a chave privada.');
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR PSBT ASSINADA
// ═══════════════════════════════════════════════════════════════════════════════

const signedPsbt = psbt.toBase64();

console.log('═══════════════════════════════════════════════════════');
console.log('✅ BUYER PSBT ASSINADA COM SUCESSO!');
console.log('═══════════════════════════════════════════════════════\n');

console.log('📋 SIGNED PSBT (Base64):\n');
console.log(signedPsbt);
console.log('\n');

// Salvar em arquivo
import fs from 'fs';
const outputFile = 'signed-buyer-psbt.txt';
fs.writeFileSync(outputFile, signedPsbt);

console.log(`💾 Salvo em: ${outputFile}\n`);
console.log('═══════════════════════════════════════════════════════');
console.log('🚀 PRÓXIMO PASSO:');
console.log('   Enviar para: POST /api/atomic-swap/:id/buy/finalize');
console.log('═══════════════════════════════════════════════════════\n');

