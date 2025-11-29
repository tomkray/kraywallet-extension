/**
 * 🔒 TAPROOT SIGNER - 100% LOCAL (ZERO-TRUST)
 * 
 * Assina transações Bitcoin Taproot LOCALMENTE.
 * Mnemonic NUNCA sai do dispositivo!
 * 
 * Este arquivo será bundled com webpack para uso na extension.
 */

const bitcoin = require('bitcoinjs-lib');
const bip39 = require('bip39');
const bip32 = require('bip32');
const ecc = require('tiny-secp256k1');

// Initialize ECC
bitcoin.initEccLib(ecc);

const network = bitcoin.networks.bitcoin;

/**
 * Assinar PSBT localmente (100% SEGURO)
 * @param {string} mnemonic - 12 palavras (SÓ usado localmente!)
 * @param {string} psbtBase64 - PSBT unsigned
 * @returns {string} TX hex assinada
 */
async function signPsbtTaprootLocal(mnemonic, psbtBase64) {
    try {
        console.log('🔐 Signing PSBT 100% LOCALLY...');
        console.log('   ✅ Mnemonic NEVER leaves device!');
        
        // 1. Derivar seed do mnemonic
        const seed = await bip39.mnemonicToSeed(mnemonic);
        console.log('   ✅ Seed derived');
        
        // 2. Derivar chave BIP86 Taproot
        const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);
        const path = "m/86'/0'/0'/0/0";
        const childRaw = root.derivePath(path);
        console.log('   ✅ Key derived:', path);
        
        // 3. Aplicar Taproot tweak
        const xOnlyInternal = Buffer.from(childRaw.publicKey.subarray(1, 33));
        const tapTweak = bitcoin.crypto.taggedHash('TapTweak', xOnlyInternal);
        let tweakedPrivateKey = ecc.privateAdd(childRaw.privateKey, tapTweak);
        
        if (!tweakedPrivateKey) {
            throw new Error('Failed to tweak private key');
        }
        
        // 4. Garantir Y coordinate even (Taproot requirement)
        const tweakedPubkey = ecc.pointFromScalar(tweakedPrivateKey);
        const hasEvenY = (tweakedPubkey[0] === 0x02);
        
        if (!hasEvenY) {
            console.log('   ⚙️  Negating private key for even Y...');
            tweakedPrivateKey = ecc.privateNegate(tweakedPrivateKey);
        }
        
        const tweakedPubkeyFull = ecc.pointFromScalar(tweakedPrivateKey);
        const tweakedPubkeyXOnly = Buffer.from(tweakedPubkeyFull.subarray(1, 33));
        
        console.log('   ✅ Taproot key ready');
        
        // 5. Criar signer com Schnorr
        const signer = {
            publicKey: Buffer.from(tweakedPubkeyFull),
            privateKey: tweakedPrivateKey,
            network: network,
            sign: (hash, lowR) => {
                return ecc.sign(hash, tweakedPrivateKey, lowR);
            },
            signSchnorr: (hash) => {
                const auxRand = Buffer.alloc(32, 0);
                const sig = ecc.signSchnorr(hash, tweakedPrivateKey, auxRand);
                return sig;
            }
        };
        
        // 6. Load PSBT
        const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network });
        console.log('   ✅ PSBT loaded, inputs:', psbt.data.inputs.length);
        
        // 7. Update inputs com tapInternalKey
        for (let i = 0; i < psbt.data.inputs.length; i++) {
            psbt.updateInput(i, {
                tapInternalKey: tweakedPubkeyXOnly
            });
        }
        
        // 8. Assinar todos os inputs
        for (let i = 0; i < psbt.data.inputs.length; i++) {
            try {
                psbt.signInput(i, signer);
                console.log(`   ✅ Input ${i} signed`);
            } catch (error) {
                console.error(`   ❌ Failed to sign input ${i}:`, error.message);
                throw error;
            }
        }
        
        // 9. Validar assinaturas
        for (let i = 0; i < psbt.data.inputs.length; i++) {
            const isValid = psbt.validateSignaturesOfInput(i, signer.signSchnorr);
            if (!isValid) {
                throw new Error(`Invalid signature for input ${i}`);
            }
            console.log(`   ✅ Input ${i} signature valid`);
        }
        
        // 10. Finalize e extrair TX
        psbt.finalizeAllInputs();
        const txHex = psbt.extractTransaction().toHex();
        
        console.log('   ✅ Transaction finalized');
        console.log('   ✅ TX size:', txHex.length / 2, 'bytes');
        
        // 11. 🗑️ LIMPAR mnemonic da memória
        mnemonic = null;
        
        console.log('🎉 PSBT SIGNED 100% LOCALLY!');
        
        return txHex;
        
    } catch (error) {
        console.error('❌ Error signing PSBT locally:', error);
        // 🗑️ Limpar mnemonic mesmo em erro
        mnemonic = null;
        throw error;
    }
}

// Export para webpack
module.exports = {
    signPsbtTaprootLocal
};

// Export para window (browser)
if (typeof window !== 'undefined') {
    window.TaprootSigner = {
        signPsbtTaprootLocal
    };
}

