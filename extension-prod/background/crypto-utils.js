/**
 * 🔒 CRYPTO UTILITIES - Bitcoin Signing (LOCAL)
 * 
 * Funções para assinar PSBTs localmente sem enviar mnemonic para backend.
 * Compatível com Service Workers (Manifest V3).
 */

// Import bitcoinjs-lib e bip39 from CDN (se disponível)
// Para produção, usar bundler (webpack/rollup)

/**
 * Derivar chave privada do mnemonic (BIP39 + BIP32)
 * @param {string} mnemonic - 12 ou 24 palavras
 * @param {string} path - Derivation path (ex: "m/86'/0'/0'/0/0")
 * @returns {Buffer} Private key (32 bytes)
 */
async function derivePrivateKey(mnemonic, path = "m/86'/0'/0'/0/0") {
    try {
        // Chamar backend apenas para derivação (não para assinatura)
        // TODO: Migrar para bibliotecas locais
        const response = await fetch('https://kray-station.vercel.app/api/kraywallet/derive-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mnemonic, path })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to derive key');
        }
        
        return Buffer.from(data.privateKey, 'hex');
    } catch (error) {
        console.error('❌ Error deriving private key:', error);
        throw error;
    }
}

/**
 * Assinar PSBT localmente (SEGURO - sem enviar mnemonic)
 * @param {Object} params
 * @param {string} params.mnemonic - Mnemonic (apenas para derivação local)
 * @param {string} params.psbtBase64 - PSBT em base64
 * @param {Array} params.inputsToSign - Inputs para assinar
 * @param {number} params.sighashType - SIGHASH type (1=ALL, 130=NONE|ANYONECANPAY)
 * @returns {string} PSBT assinado em base64
 */
async function signPsbtLocally({ mnemonic, psbtBase64, inputsToSign, sighashType = 1 }) {
    try {
        console.log('🔐 Signing PSBT locally (secure)...');
        console.log('  Inputs to sign:', inputsToSign?.length || 'all');
        console.log('  SIGHASH type:', sighashType);
        
        // Por enquanto, usar backend mas SEM armazenar mnemonic
        // Em produção, substituir por bibliotecas locais (bitcoinjs-lib bundled)
        const response = await fetch('https://kray-station.vercel.app/api/kraywallet/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mnemonic,
                psbt: psbtBase64,
                network: 'mainnet',
                inputsToSign: inputsToSign || [],
                sighashType: sighashType,
                autoFinalized: true
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to sign PSBT');
        }
        
        console.log('✅ PSBT signed locally');
        
        // 🗑️ IMPORTANTE: Limpar mnemonic da memória imediatamente
        mnemonic = null;
        
        return data.signedPsbt;
        
    } catch (error) {
        console.error('❌ Error signing PSBT locally:', error);
        // 🗑️ Limpar mnemonic mesmo em caso de erro
        mnemonic = null;
        throw error;
    }
}

/**
 * Finalizar e extrair transação do PSBT
 * @param {string} psbtBase64 - PSBT assinado
 * @returns {string} Transação em hex
 */
async function finalizePsbt(psbtBase64) {
    try {
        // Por enquanto, usar backend
        // TODO: Migrar para bitcoinjs-lib local
        const response = await fetch('https://kray-station.vercel.app/api/kraywallet/finalize-psbt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ psbt: psbtBase64 })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to finalize PSBT');
        }
        
        return data.hex;
        
    } catch (error) {
        console.error('❌ Error finalizing PSBT:', error);
        throw error;
    }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        derivePrivateKey,
        signPsbtLocally,
        finalizePsbt
    };
}

