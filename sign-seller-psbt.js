#!/usr/bin/env node

/**
 * 🔐 SCRIPT: Assinar PSBT do Seller
 * 
 * USO:
 *   node sign-seller-psbt.js <TEMPLATE_PSBT_BASE64> <SELLER_WIF>
 * 
 * EXEMPLO:
 *   node sign-seller-psbt.js "cHNidP8BAF..." "cT1...your-wif..."
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
    console.error('  node sign-seller-psbt.js <TEMPLATE_PSBT_BASE64> <SELLER_WIF>\n');
    console.error('EXEMPLO:');
    console.error('  node sign-seller-psbt.js "cHNidP8BAF..." "cT1...your-wif..."\n');
    process.exit(1);
}

const templatePsbtBase64 = process.argv[2];
const sellerWIF = process.argv[3];

console.log('\n🔐 ═══════════════════════════════════════════════════════');
console.log('   SELLER PSBT SIGNER');
console.log('   SIGHASH: SINGLE | ANYONECANPAY (0x83)');
console.log('═══════════════════════════════════════════════════════\n');

// ═══════════════════════════════════════════════════════════════════════════════
// CARREGAR PSBT
// ═══════════════════════════════════════════════════════════════════════════════

let psbt;
try {
    psbt = bitcoin.Psbt.fromBase64(templatePsbtBase64, { network: NETWORK });
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
    keyPair = ECPair.fromWIF(sellerWIF, NETWORK);
    const publicKey = keyPair.publicKey.toString('hex');
    console.log('✅ Chave privada carregada');
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

if (psbt.data.inputs.length === 0) {
    console.error('❌ PSBT não tem inputs!');
    process.exit(1);
}

if (psbt.txOutputs.length === 0) {
    console.error('❌ PSBT não tem outputs!');
    process.exit(1);
}

console.log('📤 Output[0] (Seller Payout):');
console.log(`   Value: ${psbt.txOutputs[0].value} sats`);
console.log(`   Script: ${psbt.txOutputs[0].script.toString('hex')}\n`);

// ═══════════════════════════════════════════════════════════════════════════════
// ASSINAR INPUT[0] COM SIGHASH_SINGLE | ANYONECANPAY
// ═══════════════════════════════════════════════════════════════════════════════

console.log('🖊️  Assinando input[0] com SIGHASH_SINGLE|ANYONECANPAY (0x83)...\n');

const SIGHASH_SINGLE_ANYONECANPAY = 
    bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY;

console.log(`   SIGHASH value: 0x${SIGHASH_SINGLE_ANYONECANPAY.toString(16)} (${SIGHASH_SINGLE_ANYONECANPAY})`);

try {
    psbt.signInput(0, keyPair, [SIGHASH_SINGLE_ANYONECANPAY]);
    console.log('   ✅ Input[0] assinado\n');
} catch (error) {
    console.error('   ❌ Erro ao assinar:', error.message);
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDAR ASSINATURA
// ═══════════════════════════════════════════════════════════════════════════════

console.log('🔍 Validando assinatura...\n');

try {
    const validated = psbt.validateSignaturesOfInput(0, (pubkey, msghash, signature) => {
        return ECPair.fromPublicKey(pubkey, { network: NETWORK }).verify(msghash, signature);
    });
    
    if (validated) {
        console.log('   ✅ Assinatura válida!\n');
    } else {
        console.error('   ❌ Assinatura inválida!');
        process.exit(1);
    }
} catch (error) {
    console.error('   ❌ Erro ao validar:', error.message);
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR PSBT ASSINADA
// ═══════════════════════════════════════════════════════════════════════════════

const signedPsbt = psbt.toBase64();

console.log('═══════════════════════════════════════════════════════');
console.log('✅ SELLER PSBT ASSINADA COM SUCESSO!');
console.log('═══════════════════════════════════════════════════════\n');

console.log('📋 SIGNED PSBT (Base64):\n');
console.log(signedPsbt);
console.log('\n');

// Salvar em arquivo
import fs from 'fs';
const outputFile = 'signed-seller-psbt.txt';
fs.writeFileSync(outputFile, signedPsbt);

console.log(`💾 Salvo em: ${outputFile}\n`);
console.log('═══════════════════════════════════════════════════════');
console.log('🚀 PRÓXIMO PASSO:');
console.log('   Enviar para: POST /api/atomic-swap/:id/seller-signature');
console.log('═══════════════════════════════════════════════════════\n');

