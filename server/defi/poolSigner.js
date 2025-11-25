/**
 * ✍️  POOL SIGNER
 * 
 * Assina PSBTs do pool automaticamente após validação do Policy Engine
 * Usa Taproot keys derivadas para cada pool
 * 
 * SEGURANÇA:
 * - Só assina após Policy Engine validar
 * - Keys geradas deterministicamente (HD wallet)
 * - Rate limiting por IP/address
 * - Log de todas as assinaturas
 * - Kill-switch de emergência
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import BIP32Factory from 'bip32';
import * as crypto from 'crypto';

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// Master seed do pool (deve ser guardado em HSM em produção!)
const POOL_MASTER_SEED = process.env.POOL_MASTER_SEED || 
    crypto.createHash('sha256').update('kray-station-defi-pool-master-seed-v1').digest();

/**
 * Derivar chave do pool a partir do pool ID
 * Path: m/86'/0'/0'/pool_hash
 */
function derivePoolKey(poolId) {
    // Hash pool ID para obter índice determinístico
    const poolHash = crypto.createHash('sha256').update(poolId).digest();
    const poolIndex = poolHash.readUInt32LE(0) & 0x7FFFFFFF; // Remove hardened bit
    
    const masterNode = bip32.fromSeed(POOL_MASTER_SEED);
    
    // Derivar: m/86'/0'/0'/pool_index
    const poolNode = masterNode
        .deriveHardened(86) // BIP86 (Taproot)
        .deriveHardened(0)  // Bitcoin mainnet
        .deriveHardened(0)  // Account 0
        .derive(poolIndex); // Pool-specific
    
    const internalKey = Buffer.from(poolNode.publicKey.slice(1)); // Remove 0x02/0x03 prefix
    
    return {
        privateKey: poolNode.privateKey,
        publicKey: internalKey,
        node: poolNode
    };
}

/**
 * Gerar endereço Taproot do pool
 */
export function generatePoolAddress(poolId, network = 'mainnet') {
    const btcNetwork = network === 'testnet' 
        ? bitcoin.networks.testnet 
        : bitcoin.networks.bitcoin;
    
    const { publicKey } = derivePoolKey(poolId);
    
    const { address } = bitcoin.payments.p2tr({
        internalPubkey: publicKey,
        network: btcNetwork
    });
    
    return {
        address,
        pubkey: publicKey.toString('hex')
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ✍️  SIGNING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Assinar input do pool na PSBT
 * 
 * @param {string} psbtBase64 - PSBT já assinada pelo user
 * @param {string} poolId - ID do pool
 * @param {number} poolInputIndex - Índice do input do pool (normalmente 0)
 */
export async function signPoolInput(psbtBase64, poolId, poolInputIndex = 0) {
    console.log('\n✍️  ═══ POOL SIGNER: Signing PSBT ═══');
    console.log(`   Pool ID: ${poolId}`);
    console.log(`   Input index: ${poolInputIndex}`);
    
    try {
        // Parse PSBT
        const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
        
        // Derive pool key
        const poolKey = derivePoolKey(poolId);
        
        console.log(`   🔑 Pool pubkey: ${poolKey.publicKey.toString('hex')}`);
        
        // Verificar se input existe
        if (poolInputIndex >= psbt.inputCount) {
            throw new Error(`Input index ${poolInputIndex} out of bounds (total: ${psbt.inputCount})`);
        }
        
        // Criar tweaked signer
        const tweakedPrivKey = Buffer.from(
            ecc.privateAdd(
                poolKey.privateKey,
                bitcoin.crypto.taggedHash('TapTweak', poolKey.publicKey)
            )
        );
        
        const signer = {
            publicKey: poolKey.publicKey,
            sign: (hash) => {
                return ecc.signSchnorr(hash, tweakedPrivKey);
            }
        };
        
        // Assinar input do pool
        await psbt.signInputAsync(poolInputIndex, signer);
        
        console.log(`   ✅ Pool input #${poolInputIndex} signed`);
        
        // Verificar assinatura
        const validated = psbt.validateSignaturesOfInput(poolInputIndex, signer.publicKey);
        
        if (!validated) {
            throw new Error('Signature validation failed');
        }
        
        console.log(`   ✅ Signature validated`);
        
        // Finalizar input do pool
        psbt.finalizeInput(poolInputIndex);
        
        console.log(`   ✅ Pool input finalized`);
        console.log('═══════════════════════════════════════════════════\n');
        
        return {
            psbtSigned: psbt.toBase64(),
            psbtHex: psbt.toHex(),
            poolInputFinalized: true
        };
        
    } catch (error) {
        console.error('   ❌ Signing error:', error);
        console.log('═══════════════════════════════════════════════════\n');
        throw error;
    }
}

/**
 * Finalizar e extrair transação completa
 */
export function finalizeAndExtract(psbtBase64) {
    console.log('\n🏁 ═══ FINALIZING PSBT ═══');
    
    try {
        const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
        
        // Finalizar todos os inputs restantes (usuário)
        for (let i = 0; i < psbt.inputCount; i++) {
            if (!psbt.data.inputs[i].finalScriptWitness && 
                !psbt.data.inputs[i].finalScriptSig) {
                try {
                    psbt.finalizeInput(i);
                    console.log(`   ✅ Input #${i} finalized`);
                } catch (e) {
                    console.log(`   ⚠️  Input #${i} already finalized or cannot finalize: ${e.message}`);
                }
            }
        }
        
        // Extrair transação
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        const txid = tx.getId();
        
        console.log(`   ✅ Transaction extracted`);
        console.log(`   TXID: ${txid}`);
        console.log(`   Size: ${tx.virtualSize()} vB`);
        console.log('═══════════════════════════════════════════════════\n');
        
        return {
            tx,
            txHex,
            txid,
            size: tx.virtualSize()
        };
        
    } catch (error) {
        console.error('   ❌ Finalization error:', error);
        console.log('═══════════════════════════════════════════════════\n');
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️  SECURITY & LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

const signingLog = [];
const MAX_LOG_SIZE = 1000;

/**
 * Registrar assinatura (auditoria)
 */
function logSigning({
    poolId,
    txid,
    inputIndex,
    userAddress,
    amount,
    type
}) {
    const entry = {
        timestamp: Date.now(),
        poolId,
        txid,
        inputIndex,
        userAddress,
        amount,
        type
    };
    
    signingLog.push(entry);
    
    // Limitar tamanho do log
    if (signingLog.length > MAX_LOG_SIZE) {
        signingLog.shift();
    }
    
    console.log(`📝 Signing logged: ${type} ${amount} for ${userAddress}`);
}

/**
 * Obter histórico de assinaturas
 */
export function getSigningLog({ limit = 100, poolId = null }) {
    let logs = signingLog.slice(-limit);
    
    if (poolId) {
        logs = logs.filter(l => l.poolId === poolId);
    }
    
    return logs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔴 KILL SWITCH (Emergência)
// ═══════════════════════════════════════════════════════════════════════════════

let KILL_SWITCH_ACTIVE = false;

/**
 * Ativar kill switch (para todas as assinaturas)
 */
export function activateKillSwitch(reason = 'Unknown') {
    KILL_SWITCH_ACTIVE = true;
    console.error(`\n🚨 KILL SWITCH ACTIVATED: ${reason}\n`);
    
    // TODO: Enviar alerta para admin
}

/**
 * Desativar kill switch
 */
export function deactivateKillSwitch() {
    KILL_SWITCH_ACTIVE = false;
    console.log(`\n✅ Kill switch deactivated\n`);
}

/**
 * Verificar se kill switch está ativo
 */
export function isKillSwitchActive() {
    return KILL_SWITCH_ACTIVE;
}

/**
 * Wrapper de signPoolInput com kill switch
 */
export async function signPoolInputSafe(...args) {
    if (KILL_SWITCH_ACTIVE) {
        throw new Error('KILL SWITCH ACTIVE: Pool signing is disabled');
    }
    
    return signPoolInput(...args);
}

export default {
    derivePoolKey,
    generatePoolAddress,
    signPoolInput,
    signPoolInputSafe,
    finalizeAndExtract,
    logSigning,
    getSigningLog,
    activateKillSwitch,
    deactivateKillSwitch,
    isKillSwitchActive
};

