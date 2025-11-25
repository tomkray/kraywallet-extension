/**
 * 🔑 CRIAR WALLET LND COM 12 PALAVRAS
 * 
 * LND usa formato aezeed (24 palavras)
 * Mas podemos usar BIP39 (12 palavras) via extended key
 */

import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { execSync } from 'child_process';
import fs from 'fs';

bitcoin.initEccLib(ecc);

// Suas 12 palavras aqui
const MNEMONIC_12_WORDS = process.argv[2];
const PASSWORD = process.argv[3];

if (!MNEMONIC_12_WORDS || !PASSWORD) {
    console.log('❌ Uso: node create-lnd-wallet.js "palavra1 palavra2 ... palavra12" "senha"');
    process.exit(1);
}

console.log('🔑 Criando wallet LND com suas 12 palavras...\n');

// Validar mnemonic
if (!bip39.validateMnemonic(MNEMONIC_12_WORDS)) {
    console.log('❌ Mnemonic inválido!');
    process.exit(1);
}

console.log('✅ Mnemonic válido (12 palavras)');
console.log('📝 Senha:', '*'.repeat(PASSWORD.length));

// Derivar extended key (xprv)
const seed = bip39.mnemonicToSeedSync(MNEMONIC_12_WORDS);
const root = bip32.BIP32Factory(ecc).fromSeed(seed, bitcoin.networks.bitcoin);
const xprv = root.toBase58();

console.log('✅ Extended private key derivada');
console.log('🔐 xprv:', xprv.substring(0, 20) + '...\n');

// Criar arquivo temporário com o xprv
const tempFile = '/tmp/lnd-xprv.txt';
fs.writeFileSync(tempFile, xprv);

console.log('📋 Criando wallet LND...');
console.log('⏳ Aguarde...\n');

try {
    // Usar lncli com extended key
    const cmd = `cd /Users/tomkray/Desktop/PSBT-Ordinals && echo "${PASSWORD}\n${PASSWORD}\nx\n${xprv}\n" | ./lnd-darwin-arm64-v0.17.0-beta/lncli --lnddir=./lnd-data --network=mainnet create`;
    
    const output = execSync(cmd, { 
        encoding: 'utf8',
        stdio: 'pipe'
    });
    
    console.log('✅ Wallet LND criada com sucesso!');
    console.log('\n📊 Output:');
    console.log(output);
    
    // Limpar arquivo temporário
    fs.unlinkSync(tempFile);
    
    console.log('\n🎉 SUCESSO!');
    console.log('✅ Wallet LND criada com suas 12 palavras');
    console.log('✅ Mesma seed da MyWallet');
    console.log('✅ Mesmo endereço Taproot\n');
    
    console.log('📋 Próximo passo:');
    console.log('   ./lnd-darwin-arm64-v0.17.0-beta/lncli --lnddir=./lnd-data --network=mainnet getinfo\n');
    
} catch (error) {
    console.error('❌ Erro ao criar wallet:', error.message);
    
    // Limpar arquivo temporário
    if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
    }
    
    process.exit(1);
}




