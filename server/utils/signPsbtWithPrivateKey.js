import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

/**
 * Assina PSBT com chave privada e SIGHASH_SINGLE | ANYONECANPAY
 * 
 * ⚠️ APENAS PARA DESENVOLVIMENTO/TESTE!
 * NUNCA use em produção com chaves reais!
 * 
 * @param {string} psbtBase64 - PSBT em base64
 * @param {string} privateKeyWIF - Chave privada em formato WIF
 * @param {number} inputIndex - Índice do input para assinar (default: 0)
 * @param {string} networkType - 'mainnet' ou 'testnet'
 * @returns {string} PSBT assinado em base64
 */
export function signPsbtWithPrivateKey(psbtBase64, privateKeyWIF, inputIndex = 0, networkType = 'mainnet') {
    try {
        console.log('\n🔐 ========== SIGNING WITH PRIVATE KEY ==========');
        console.log('⚠️  DEV MODE - Never use in production!');
        
        // Selecionar network
        const network = networkType === 'testnet' 
            ? bitcoin.networks.testnet 
            : bitcoin.networks.bitcoin;
        
        // Decodificar PSBT
        const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network });
        
        console.log('📊 PSBT Info:');
        console.log('  Inputs:', psbt.inputCount);
        console.log('  Outputs:', psbt.txOutputs.length);
        
        // Decodificar chave privada
        let keyPair;
        try {
            keyPair = ECPair.fromWIF(privateKeyWIF, network);
            console.log('✅ Private key decoded');
        } catch (error) {
            throw new Error('Invalid private key format: ' + error.message);
        }
        
        // Verificar se input existe
        if (inputIndex >= psbt.inputCount) {
            throw new Error(`Input index ${inputIndex} out of range (max: ${psbt.inputCount - 1})`);
        }
        
        const input = psbt.data.inputs[inputIndex];
        
        // Verificar se tem tapInternalKey (necessário para Taproot)
        if (!input.tapInternalKey) {
            throw new Error('Input does not have tapInternalKey (required for Taproot)');
        }
        
        console.log(`\n🔏 Signing Input ${inputIndex} with SIGHASH_SINGLE | ANYONECANPAY...`);
        
        // SIGHASH_SINGLE (0x03) | SIGHASH_ANYONECANPAY (0x80) = 0x83 (131)
        const sighashType = bitcoin.Transaction.SIGHASH_SINGLE | 
                           bitcoin.Transaction.SIGHASH_ANYONECANPAY;
        
        console.log('  SIGHASH Type:', sighashType, '(0x' + sighashType.toString(16) + ')');
        console.log('  SIGHASH_SINGLE: 0x03 (Input N → Output N)');
        console.log('  SIGHASH_ANYONECANPAY: 0x80 (Allow adding inputs)');
        
        // Assinar input com sighashType
        try {
            // Para Taproot (P2TR), usar tweaked key
            const tweakedSigner = keyPair.tweak(
                bitcoin.crypto.taggedHash('TapTweak', input.tapInternalKey)
            );
            
            psbt.signInput(inputIndex, tweakedSigner, [sighashType]);
            
            console.log('✅ Input signed successfully!');
            
        } catch (signError) {
            console.error('❌ Signing failed:', signError.message);
            throw new Error('Failed to sign input: ' + signError.message);
        }
        
        // Verificar assinatura
        try {
            const validated = psbt.validateSignaturesOfInput(inputIndex, tweakedSigner.publicKey);
            if (validated) {
                console.log('✅ Signature validated!');
            } else {
                console.warn('⚠️  Signature validation returned false');
            }
        } catch (validateError) {
            console.warn('⚠️  Could not validate signature:', validateError.message);
            // Continuar mesmo assim
        }
        
        const signedPsbt = psbt.toBase64();
        
        console.log('\n📊 RESULT:');
        console.log('  Input', inputIndex, 'signed with SIGHASH_SINGLE|ANYONECANPAY');
        console.log('  PSBT size:', signedPsbt.length, 'chars');
        console.log('  Ready for atomic swap!');
        console.log('==========================================\n');
        
        return signedPsbt;
        
    } catch (error) {
        console.error('\n❌ ERROR signing PSBT:', error.message);
        console.error(error.stack);
        throw error;
    }
}

/**
 * Extrair tapInternalKey do endereço Taproot
 * @param {string} address - Endereço Taproot (bc1p...)
 * @param {string} networkType - 'mainnet' ou 'testnet'
 * @returns {Buffer} tapInternalKey
 */
export function extractTapInternalKeyFromAddress(address, networkType = 'mainnet') {
    try {
        const network = networkType === 'testnet' 
            ? bitcoin.networks.testnet 
            : bitcoin.networks.bitcoin;
        
        // Decodificar endereço
        const scriptPubKey = bitcoin.address.toOutputScript(address, network);
        
        // Verificar se é P2TR
        if (scriptPubKey.length !== 34 || scriptPubKey[0] !== 0x51 || scriptPubKey[1] !== 0x20) {
            throw new Error('Address is not Taproot (P2TR)');
        }
        
        // Extrair os 32 bytes da chave pública
        return scriptPubKey.slice(2);
        
    } catch (error) {
        throw new Error('Failed to extract tapInternalKey: ' + error.message);
    }
}

export default {
    signPsbtWithPrivateKey,
    extractTapInternalKeyFromAddress
};



