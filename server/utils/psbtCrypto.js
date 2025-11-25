/**
 * 🔐 PSBT ENCRYPTION MODULE
 * 
 * Sistema de criptografia híbrida para proteger PSBTs assinados:
 * - AES-256-GCM para criptografar o PSBT (simétrico, rápido)
 * - RSA-OAEP para criptografar a chave AES (assimétrico, seguro)
 * 
 * SEGURANÇA:
 * - PSBTs NUNCA são armazenados em texto claro
 * - Atacantes que acessam o DB veem apenas dados criptografados
 * - Apenas o marketplace server pode descriptografar (RSA private key)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// 🔑 CONFIGURAÇÃO: RSA Key Pair do Marketplace
// ═══════════════════════════════════════════════════════════════

const KEYS_DIR = path.join(__dirname, '../keys');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'marketplace-public.pem');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'marketplace-private.pem');

// Criar diretório de chaves se não existir
if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
}

// Gerar ou carregar chaves RSA
let publicKey, privateKey;

if (fs.existsSync(PUBLIC_KEY_PATH) && fs.existsSync(PRIVATE_KEY_PATH)) {
    // Carregar chaves existentes
    publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
    privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    console.log('✅ Marketplace RSA keys loaded');
} else {
    // Gerar novas chaves RSA (4096 bits para máxima segurança)
    console.log('🔑 Generating new RSA key pair for marketplace...');
    const { publicKey: pubKey, privateKey: privKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
            cipher: 'aes-256-cbc',
            passphrase: process.env.MARKETPLACE_KEY_PASSPHRASE || 'kraystation-secure-2024'
        }
    });
    
    publicKey = pubKey;
    privateKey = privKey;
    
    // Salvar chaves
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
    
    // Proteger chaves (somente owner pode ler)
    fs.chmodSync(PUBLIC_KEY_PATH, 0o600);
    fs.chmodSync(PRIVATE_KEY_PATH, 0o600);
    
    console.log('✅ New RSA key pair generated and saved');
}

// ═══════════════════════════════════════════════════════════════
// 🔐 CRIPTOGRAFIA: AES-256-GCM (Simétrico)
// ═══════════════════════════════════════════════════════════════

/**
 * Criptografa dados usando AES-256-GCM
 * @param {string} plaintext - Texto a ser criptografado (ex: PSBT base64)
 * @param {Buffer} key - Chave de 32 bytes (256 bits)
 * @returns {string} JSON stringified: { encrypted, iv, authTag }
 */
export function encryptAES(plaintext, key) {
    try {
        // Gerar IV (Initialization Vector) aleatório
        const iv = crypto.randomBytes(16);
        
        // Criar cipher AES-256-GCM
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        
        // Criptografar
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        // Obter authentication tag (previne adulteração)
        const authTag = cipher.getAuthTag();
        
        // Retornar tudo em JSON
        return JSON.stringify({
            encrypted: encrypted,
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64')
        });
        
    } catch (error) {
        console.error('❌ AES encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Descriptografa dados usando AES-256-GCM
 * @param {string} encryptedJson - JSON stringified do encryptAES
 * @param {Buffer} key - Chave de 32 bytes (256 bits)
 * @returns {string} Texto descriptografado
 */
export function decryptAES(encryptedJson, key) {
    try {
        const { encrypted, iv, authTag } = JSON.parse(encryptedJson);
        
        // Criar decipher AES-256-GCM
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            key,
            Buffer.from(iv, 'base64')
        );
        
        // Definir authentication tag
        decipher.setAuthTag(Buffer.from(authTag, 'base64'));
        
        // Descriptografar
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
        
    } catch (error) {
        console.error('❌ AES decryption error:', error);
        throw new Error('Failed to decrypt data (wrong key or corrupted data)');
    }
}

// ═══════════════════════════════════════════════════════════════
// 🔐 CRIPTOGRAFIA: RSA-OAEP (Assimétrico)
// ═══════════════════════════════════════════════════════════════

/**
 * Criptografa dados usando RSA-OAEP com a chave pública do marketplace
 * @param {Buffer} data - Dados a serem criptografados (max 470 bytes para RSA 4096)
 * @returns {string} Base64 encoded encrypted data
 */
export function encryptRSA(data) {
    try {
        const encrypted = crypto.publicEncrypt(
            {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            data
        );
        
        return encrypted.toString('base64');
        
    } catch (error) {
        console.error('❌ RSA encryption error:', error);
        throw new Error('Failed to encrypt with RSA');
    }
}

/**
 * Descriptografa dados usando RSA-OAEP com a chave privada do marketplace
 * @param {string} encryptedBase64 - Base64 encoded encrypted data
 * @returns {Buffer} Decrypted data
 */
export function decryptRSA(encryptedBase64) {
    try {
        const decrypted = crypto.privateDecrypt(
            {
                key: privateKey,
                passphrase: process.env.MARKETPLACE_KEY_PASSPHRASE || 'kraystation-secure-2024',
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            Buffer.from(encryptedBase64, 'base64')
        );
        
        return decrypted;
        
    } catch (error) {
        console.error('❌ RSA decryption error:', error);
        throw new Error('Failed to decrypt with RSA (wrong key or corrupted data)');
    }
}

// ═══════════════════════════════════════════════════════════════
// 🔐 HIGH-LEVEL API: Criptografar/Descriptografar PSBT
// ═══════════════════════════════════════════════════════════════

/**
 * Criptografa um PSBT para armazenamento seguro
 * @param {string} psbtBase64 - PSBT em base64
 * @returns {Object} { encryptedPsbt, encryptedKey }
 */
export function encryptPSBT(psbtBase64) {
    console.log('🔐 Encrypting PSBT...');
    
    // 1. Gerar chave efêmera AES (32 bytes = 256 bits)
    const ephemeralKey = crypto.randomBytes(32);
    console.log('   ✅ Ephemeral AES key generated (256 bits)');
    
    // 2. Criptografar PSBT com AES-256-GCM
    const encryptedPsbt = encryptAES(psbtBase64, ephemeralKey);
    console.log('   ✅ PSBT encrypted with AES-256-GCM');
    
    // 3. Criptografar a chave efêmera com RSA-OAEP
    const encryptedKey = encryptRSA(ephemeralKey);
    console.log('   ✅ Ephemeral key encrypted with RSA-OAEP');
    
    console.log('✅ PSBT encryption complete');
    
    return {
        encryptedPsbt,  // JSON string com encrypted, iv, authTag
        encryptedKey    // Base64 string
    };
}

/**
 * Descriptografa um PSBT criptografado
 * @param {string} encryptedPsbt - Resultado de encryptAES
 * @param {string} encryptedKey - Resultado de encryptRSA
 * @returns {string} PSBT em base64
 */
export function decryptPSBT(encryptedPsbt, encryptedKey) {
    console.log('🔓 Decrypting PSBT...');
    
    // 1. Descriptografar a chave efêmera com RSA-OAEP
    const ephemeralKey = decryptRSA(encryptedKey);
    console.log('   ✅ Ephemeral key decrypted with RSA-OAEP');
    
    // 2. Descriptografar PSBT com AES-256-GCM
    const psbtBase64 = decryptAES(encryptedPsbt, ephemeralKey);
    console.log('   ✅ PSBT decrypted with AES-256-GCM');
    
    console.log('✅ PSBT decryption complete');
    
    return psbtBase64;
}

// ═══════════════════════════════════════════════════════════════
// 🔐 ADVANCED: Separar e Criptografar APENAS a Assinatura
// ═══════════════════════════════════════════════════════════════

/**
 * Separa a assinatura do seller e criptografa (ATOMIC SWAP SECURITY)
 * 
 * @param {string} signedPsbtBase64 - PSBT assinado pelo seller
 * @returns {Object} { unsignedPsbt, encryptedSignature, encryptedKey, sighashType }
 */
export async function extractAndEncryptSignature(signedPsbtBase64) {
    console.log('\n🔐 ===== EXTRACTING AND ENCRYPTING SIGNATURE =====');
    
    const bitcoin = await import('bitcoinjs-lib');
    const psbt = bitcoin.Psbt.fromBase64(signedPsbtBase64);
    
    // 🔍 DEBUG: Ver TODOS os campos do input 0
    console.log('\n🔍 DEBUG: Input 0 contents:');
    const sellerInput = psbt.data.inputs[0];
    console.log('   Keys in input 0:', Object.keys(sellerInput));
    console.log('   tapKeySig:', sellerInput.tapKeySig ? '✅ EXISTS (' + sellerInput.tapKeySig.length + ' bytes)' : '❌ MISSING');
    console.log('   partialSig:', sellerInput.partialSig ? '✅ EXISTS' : '❌ MISSING');
    console.log('   tapScriptSig:', sellerInput.tapScriptSig ? '✅ EXISTS' : '❌ MISSING');
    console.log('   finalScriptWitness:', sellerInput.finalScriptWitness ? '✅ EXISTS' : '❌ MISSING');
    console.log('   finalScriptSig:', sellerInput.finalScriptSig ? '✅ EXISTS' : '❌ MISSING');
    console.log('   tapInternalKey:', sellerInput.tapInternalKey ? '✅ EXISTS' : '❌ MISSING');
    console.log('   witnessUtxo:', sellerInput.witnessUtxo ? '✅ EXISTS' : '❌ MISSING');
    
    // Verificar se Input 0 tem assinatura
    if (!sellerInput.tapKeySig) {
        throw new Error('PSBT is not signed (no tapKeySig in input 0)');
    }
    
    console.log('   ✅ Signature found in Input 0');
    console.log('   Signature length:', sellerInput.tapKeySig.length, 'bytes');
    
    // 🔧 CRÍTICO: Extrair SIGHASH type da assinatura
    // Para Taproot Schnorr, se assinatura tem 65 bytes, o último byte É o sighash
    // Se tem 64 bytes, o sighash é 0x00 (SIGHASH_DEFAULT)
    const signature = sellerInput.tapKeySig;
    let sighashType;
    
    if (signature.length === 65) {
        // Assinatura tem 64 bytes + 1 byte de sighash
        sighashType = signature[64]; // Último byte é o SIGHASH
        console.log('   🎯 SIGHASH extracted from 65-byte signature:', '0x' + sighashType.toString(16));
    } else if (signature.length === 64) {
        // Assinatura de 64 bytes = SIGHASH_DEFAULT (0x00)
        sighashType = 0x00;
        console.log('   🎯 SIGHASH is DEFAULT (64-byte signature):', '0x00');
    } else {
        console.warn('   ⚠️  Unexpected signature length:', signature.length);
        sighashType = sellerInput.sighashType || 0x00;
    }
    
    console.log('   Final SIGHASH type:', '0x' + sighashType.toString(16));
    
    // Criar objeto com assinatura completa
    const signatureData = {
        tapKeySig: signature.toString('hex'),
        sighashType: sighashType
    };
    
    // 1. Gerar chave efêmera para a assinatura
    const ephemeralKey = crypto.randomBytes(32);
    console.log('   ✅ Ephemeral key generated for signature');
    
    // 2. Criptografar assinatura
    const signatureJson = JSON.stringify(signatureData);
    const encryptedSignature = encryptAES(signatureJson, ephemeralKey);
    console.log('   ✅ Signature encrypted with AES-256-GCM');
    
    // 3. Criptografar chave efêmera
    const encryptedKey = encryptRSA(ephemeralKey);
    console.log('   ✅ Ephemeral key encrypted with RSA-OAEP');
    
    // 4. Remover assinatura do PSBT (criar versão "unsigned")
    const unsignedPsbt = psbt.clone();
    delete unsignedPsbt.data.inputs[0].tapKeySig;
    delete unsignedPsbt.data.inputs[0].sighashType;
    delete unsignedPsbt.data.inputs[0].finalScriptWitness;
    
    const unsignedPsbtBase64 = unsignedPsbt.toBase64();
    console.log('   ✅ Unsigned PSBT created (signature removed)');
    console.log('   Unsigned PSBT length:', unsignedPsbtBase64.length);
    
    console.log('✅ Signature extraction and encryption complete\n');
    
    return {
        unsignedPsbt: unsignedPsbtBase64,
        encryptedSignature,
        encryptedKey,
        sighashType
    };
}

/**
 * Descriptografa e adiciona a assinatura do seller ao PSBT do buyer
 * 
 * @param {string} buyerPsbtBase64 - PSBT assinado pelo buyer (sem seller signature)
 * @param {string} encryptedSignature - Assinatura criptografada do seller
 * @param {string} encryptedKey - Chave criptografada
 * @returns {string} PSBT completo (seller + buyer assinados)
 */
export async function decryptAndAddSignature(buyerPsbtBase64, encryptedSignature, encryptedKey) {
    console.log('\n🔓 ===== DECRYPTING AND ADDING SIGNATURE =====');
    
    const bitcoin = await import('bitcoinjs-lib');
    
    // 1. Descriptografar chave efêmera
    const ephemeralKey = decryptRSA(encryptedKey);
    console.log('   ✅ Ephemeral key decrypted');
    
    // 2. Descriptografar assinatura
    const signatureJson = decryptAES(encryptedSignature, ephemeralKey);
    const signatureData = JSON.parse(signatureJson);
    console.log('   ✅ Signature decrypted');
    console.log('   Signature length:', signatureData.tapKeySig.length / 2, 'bytes (hex)');
    console.log('   SIGHASH type:', signatureData.sighashType);
    
    // 3. Adicionar assinatura ao PSBT do buyer
    const psbt = bitcoin.Psbt.fromBase64(buyerPsbtBase64);
    
    // ⚠️ CRÍTICO: A assinatura pode vir COM ou SEM o byte do sighash
    // Se vem de 65 bytes, o último byte É o sighash
    // Se vem de 64 bytes, precisamos ADICIONAR o byte do sighash
    
    let finalSignature = Buffer.from(signatureData.tapKeySig, 'hex');
    const signatureLength = finalSignature.length;
    
    console.log('   📏 Signature from storage:', signatureLength, 'bytes');
    console.log('   🎯 SIGHASH type from storage:', signatureData.sighashType);
    
    // 🔥 CRITICAL: bitcoinjs-lib behavior for Taproot signatures:
    // - If input.sighashType is SET: expects 64-byte signature (WITHOUT sighash byte)
    // - If input.sighashType is NOT SET: expects 65-byte signature (WITH sighash byte)
    //
    // Since we ALWAYS set input.sighashType, we need 64-byte signatures!
    
    if (signatureLength === 65) {
        // Remove the last byte (sighash) from the signature
        finalSignature = finalSignature.slice(0, 64);
        console.log('   🔧 Removed sighash byte from signature (65 → 64 bytes)');
        console.log('   📝 Will use input.sighashType instead');
    } else if (signatureLength === 64) {
        console.log('   ✅ Signature already has 64 bytes (correct!)');
    } else {
        console.log('   ⚠️  Unexpected signature length:', signatureLength);
    }
    
    // Always use 64-byte signature + input.sighashType
    psbt.data.inputs[0].tapKeySig = finalSignature;
    psbt.data.inputs[0].sighashType = signatureData.sighashType;
    
    console.log('   ✅ Set input.sighashType:', signatureData.sighashType, '(0x' + signatureData.sighashType.toString(16) + ')');
    
    console.log('   ✅ Seller signature added to Input 0');
    console.log('   📦 Final tapKeySig length:', psbt.data.inputs[0].tapKeySig.length, 'bytes');
    console.log('✅ Complete PSBT ready for broadcast\n');
    
    return psbt.toBase64();
}

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTAR: Chave pública (para frontend)
// ═══════════════════════════════════════════════════════════════

/**
 * Retorna a chave pública do marketplace (para o frontend usar)
 * @returns {string} PEM formatted public key
 */
export function getMarketplacePublicKey() {
    return publicKey;
}

// ═══════════════════════════════════════════════════════════════
// 🧪 TESTES AUTOMATIZADOS
// ═══════════════════════════════════════════════════════════════

export function testEncryption() {
    console.log('\n🧪 Testing PSBT encryption/decryption...\n');
    
    const testPsbt = 'cHNidP8BAIkCAAAAAY7zMm+YszN/Gs8fqtMJmSUIrpRK4LY04CiSiARHRpsGAAAAAAD/////AgsDAAAAAAAAACJRIEIx/Eca5U3a8e+UH3ySqdg1c9jFj9fQuQCb42E8NozO6AMAAAAAAAAiUSBgnqacWsVb4at1Ewx4ipNFEIN4Nrm8XV2raXuUnpf9igAAAAAAAQErKwIAAAAAAAAiUSBgnqacWsVb4at1Ewx4ipNFEIN4Nrm8XV2raXuUnpf9ig==';
    
    try {
        // Criptografar
        const { encryptedPsbt, encryptedKey } = encryptPSBT(testPsbt);
        console.log('Encrypted PSBT length:', encryptedPsbt.length);
        console.log('Encrypted Key length:', encryptedKey.length);
        
        // Descriptografar
        const decryptedPsbt = decryptPSBT(encryptedPsbt, encryptedKey);
        
        // Verificar
        if (decryptedPsbt === testPsbt) {
            console.log('\n✅ TEST PASSED: Encryption/Decryption working correctly!\n');
            return true;
        } else {
            console.log('\n❌ TEST FAILED: Decrypted PSBT does not match original!\n');
            return false;
        }
        
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message, '\n');
        return false;
    }
}

// Executar teste automaticamente na primeira vez
if (process.env.NODE_ENV !== 'production') {
    testEncryption();
}

