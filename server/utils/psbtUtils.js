import * as bitcoin from 'bitcoinjs-lib';

// Configurar network
export const network = process.env.NETWORK === 'testnet' 
    ? bitcoin.networks.testnet 
    : bitcoin.networks.bitcoin;

/**
 * Converte pubkey para x-only (32 bytes) necessário para Taproot
 */
export function toXOnly(pubkey) {
    if (!Buffer.isBuffer(pubkey)) {
        pubkey = Buffer.from(pubkey, 'hex');
    }
    return pubkey.length === 32 ? pubkey : pubkey.subarray(1, 33);
}

/**
 * Valida se um PSBT está pronto para finalizar
 */
export function validatePsbt(psbt) {
    const issues = [];
    const warnings = [];
    
    // Verificar cada input
    for (let i = 0; i < psbt.inputCount; i++) {
        const input = psbt.data.inputs[i];
        
        if (!input.witnessUtxo) {
            issues.push(`Input ${i}: witnessUtxo obrigatório para SegWit/Taproot`);
        }
        
        // tapInternalKey não é obrigatório se já tiver finalScriptWitness
        if (!input.tapInternalKey && !input.redeemScript && !input.finalScriptWitness) {
            warnings.push(`Input ${i}: tapInternalKey ausente (pode falhar na finalização)`);
        }
        
        // Verificar se está assinado OU já finalizado
        const isSigned = !!(input.tapKeySig || (input.partialSig && input.partialSig.length > 0));
        const isFinalized = !!(input.finalScriptWitness || input.finalScriptSig);
        
        if (!isSigned && !isFinalized) {
            issues.push(`Input ${i}: não está assinado nem finalizado`);
        }
    }
    
    // Verificar fee
    const totalIn = psbt.data.inputs.reduce((sum, inp) => 
        sum + (inp.witnessUtxo?.value || 0), 0
    );
    const totalOut = psbt.txOutputs.reduce((sum, out) => sum + out.value, 0);
    const fee = totalIn - totalOut;
    
    if (fee <= 0) {
        issues.push(`Fee inválida: ${fee} (deve ser positiva)`);
    }
    
    if (fee > 100000) {
        warnings.push(`Fee muito alta: ${fee} sats (verifique se está correto)`);
    }
    
    return {
        valid: issues.length === 0,
        issues,
        warnings,
        fee,
        totalIn,
        totalOut
    };
}

/**
 * Deriva scriptPubKey de um endereço
 */
export function getScriptPubKeyFromAddress(address, network) {
    try {
        const decoded = bitcoin.address.toOutputScript(address, network);
        return decoded;
    } catch (error) {
        throw new Error(`Endereço inválido: ${address}`);
    }
}

/**
 * Extrai tapInternalKey de um scriptPubKey Taproot
 * @param {Buffer} scriptPubKey - Script pub key
 * @returns {Buffer|null} tapInternalKey ou null
 */
export function extractTapInternalKey(scriptPubKey) {
    try {
        // Converter para Buffer se necessário
        if (!Buffer.isBuffer(scriptPubKey)) {
            scriptPubKey = Buffer.from(scriptPubKey, 'hex');
        }
        
        // Verificar se é P2TR (Taproot)
        if (!scriptPubKey || scriptPubKey.length !== 34) {
            return null;
        }
        
        if (scriptPubKey[0] !== 0x51 || scriptPubKey[1] !== 0x20) {
            return null;
        }
        
        // Extrair os 32 bytes da chave pública (bytes 2-34)
        return scriptPubKey.slice(2);
    } catch (error) {
        console.error('Error extracting tapInternalKey:', error.message);
        return null;
    }
}

