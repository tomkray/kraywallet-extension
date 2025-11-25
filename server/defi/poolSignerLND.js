/**
 * ✍️  POOL SIGNER (LND Integration)
 * 
 * Assina PSBTs do pool usando LND (Lightning Network Daemon)
 * 
 * VANTAGENS vs HD Wallet:
 * - Lightning-native (mesmo endereço L1 e Lightning!)
 * - MuSig2 support nativo
 * - Backup automático via SCB
 * - Zero custos (vs ICP ciclos)
 * - Schnorr signatures nativas
 * 
 * COMPATIBILIDADE:
 * - Fallback para HD Wallet se LND não disponível
 * - Mesmos endereços Taproot (BIP86)
 * - Mesmas assinaturas Schnorr (BIP340)
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import BIP32Factory from 'bip32';
import * as crypto from 'crypto';
import { getLNDPoolClient } from '../lightning/lndPoolClient.js';

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const USE_LND = process.env.USE_LND_FOR_POOLS === 'true';
const POOL_MASTER_SEED = process.env.POOL_MASTER_SEED || 
    crypto.createHash('sha256').update('kray-station-defi-pool-master-seed-v1').digest();

console.log(`\n⚡ Pool Signer Mode: ${USE_LND ? 'LND' : 'HD Wallet'}`);

// ═══════════════════════════════════════════════════════════════════════════════
// 🔑 KEY DERIVATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Derivar chave do pool (HD Wallet fallback)
 */
function derivePoolKeyLocal(poolId) {
    const poolHash = crypto.createHash('sha256').update(poolId).digest();
    const poolIndex = poolHash.readUInt32LE(0) & 0x7FFFFFFF;
    
    const masterNode = bip32.fromSeed(POOL_MASTER_SEED);
    const poolNode = masterNode
        .deriveHardened(86)
        .deriveHardened(0)
        .deriveHardened(0)
        .derive(poolIndex);
    
    const internalKey = Buffer.from(poolNode.publicKey.slice(1));
    
    return {
        privateKey: poolNode.privateKey,
        publicKey: internalKey,
        node: poolNode
    };
}

/**
 * Derivar chave do pool via LND
 */
async function derivePoolKeyViaLND(poolId) {
    try {
        const lnd = getLNDPoolClient();
        return await lnd.derivePoolKey(poolId);
    } catch (error) {
        console.warn('⚠️  LND derivation failed, falling back to HD Wallet:', error.message);
        return derivePoolKeyLocal(poolId);
    }
}

/**
 * Gerar endereço Taproot do pool
 */
export async function generatePoolAddress(poolId, network = 'mainnet') {
    const btcNetwork = network === 'testnet' 
        ? bitcoin.networks.testnet 
        : bitcoin.networks.bitcoin;
    
    let publicKey;
    
    if (USE_LND) {
        const poolKey = await derivePoolKeyViaLND(poolId);
        publicKey = poolKey.publicKey;
    } else {
        const poolKey = derivePoolKeyLocal(poolId);
        publicKey = poolKey.publicKey;
    }
    
    const { address } = bitcoin.payments.p2tr({
        internalPubkey: publicKey,
        network: btcNetwork
    });
    
    return {
        address,
        pubkey: publicKey.toString('hex'),
        method: USE_LND ? 'LND' : 'HD Wallet'
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ✍️  SIGNING (LND + HD Wallet)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Assinar input do pool na PSBT (LND)
 */
async function signPoolInputLND(psbtBase64, poolId, poolInputIndex = 0) {
    console.log('\n⚡ ═══ SIGNING WITH LND ═══');
    
    try {
        const lnd = getLNDPoolClient();
        const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
        
        // 1. Derivar chave do pool via LND
        const poolKey = await lnd.derivePoolKey(poolId);
        
        console.log(`   🔑 Pool key derived via LND`);
        console.log(`   Key Locator: ${poolKey.keyLocator.keyFamily}:${poolKey.keyLocator.keyIndex}`);
        
        // 2. Obter sighash para assinar
        const input = psbt.data.inputs[poolInputIndex];
        
        if (!input.witnessUtxo) {
            throw new Error('witnessUtxo not found in PSBT input');
        }
        
        // Compute taproot sighash
        const sighash = psbt.__CACHE.__TX.hashForWitnessV1(
            poolInputIndex,
            [input.witnessUtxo.script],
            [input.witnessUtxo.value],
            bitcoin.Transaction.SIGHASH_DEFAULT
        );
        
        console.log(`   📝 Sighash: ${sighash.toString('hex').slice(0, 20)}...`);
        
        // 3. Computar Taproot tweak
        const taprootTweak = bitcoin.crypto.taggedHash('TapTweak', poolKey.publicKey);
        
        // 4. Assinar com LND (Schnorr)
        const signature = await lnd.signSchnorr(
            sighash,
            poolKey.keyLocator,
            taprootTweak
        );
        
        console.log(`   ✅ Schnorr signature: ${signature.length} bytes`);
        
        // 5. Adicionar ao PSBT
        psbt.updateInput(poolInputIndex, {
            tapKeySig: signature
        });
        
        // 6. Finalizar input
        psbt.finalizeInput(poolInputIndex);
        
        console.log(`   ✅ Pool input finalized (LND)`);
        console.log('═══════════════════════════════════════════════════\n');
        
        return {
            psbtSigned: psbt.toBase64(),
            psbtHex: psbt.toHex(),
            method: 'LND',
            poolInputFinalized: true
        };
        
    } catch (error) {
        console.error('   ❌ LND signing error:', error);
        console.log('   🔄 Falling back to HD Wallet...');
        return signPoolInputLocal(psbtBase64, poolId, poolInputIndex);
    }
}

/**
 * Assinar input do pool na PSBT (HD Wallet fallback)
 */
function signPoolInputLocal(psbtBase64, poolId, poolInputIndex = 0) {
    console.log('\n🔑 ═══ SIGNING WITH HD WALLET (Fallback) ═══');
    
    try {
        const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
        const poolKey = derivePoolKeyLocal(poolId);
        
        console.log(`   🔑 Pool pubkey: ${poolKey.publicKey.toString('hex').slice(0, 20)}...`);
        
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
        psbt.signInput(poolInputIndex, signer);
        
        console.log(`   ✅ Pool input #${poolInputIndex} signed`);
        
        // Verificar assinatura
        const validated = psbt.validateSignaturesOfInput(poolInputIndex, signer.publicKey);
        
        if (!validated) {
            throw new Error('Signature validation failed');
        }
        
        console.log(`   ✅ Signature validated`);
        
        // Finalizar input do pool
        psbt.finalizeInput(poolInputIndex);
        
        console.log(`   ✅ Pool input finalized (HD Wallet)`);
        console.log('═══════════════════════════════════════════════════\n');
        
        return {
            psbtSigned: psbt.toBase64(),
            psbtHex: psbt.toHex(),
            method: 'HD Wallet',
            poolInputFinalized: true
        };
        
    } catch (error) {
        console.error('   ❌ HD Wallet signing error:', error);
        console.log('═══════════════════════════════════════════════════\n');
        throw error;
    }
}

/**
 * Assinar input do pool (auto-detecta LND ou HD Wallet)
 */
export async function signPoolInput(psbtBase64, poolId, poolInputIndex = 0) {
    if (USE_LND) {
        return await signPoolInputLND(psbtBase64, poolId, poolInputIndex);
    } else {
        return signPoolInputLocal(psbtBase64, poolId, poolInputIndex);
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
                    console.log(`   ⚠️  Input #${i} already finalized or cannot finalize`);
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

function logSigning({ poolId, txid, inputIndex, userAddress, amount, type, method }) {
    const entry = {
        timestamp: Date.now(),
        poolId,
        txid,
        inputIndex,
        userAddress,
        amount,
        type,
        method // 'LND' or 'HD Wallet'
    };
    
    signingLog.push(entry);
    
    if (signingLog.length > MAX_LOG_SIZE) {
        signingLog.shift();
    }
    
    console.log(`📝 Signing logged: ${type} ${amount} for ${userAddress} (${method})`);
}

export function getSigningLog({ limit = 100, poolId = null }) {
    let logs = signingLog.slice(-limit);
    
    if (poolId) {
        logs = logs.filter(l => l.poolId === poolId);
    }
    
    return logs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔴 KILL SWITCH
// ═══════════════════════════════════════════════════════════════════════════════

let KILL_SWITCH_ACTIVE = false;

export function activateKillSwitch(reason = 'Unknown') {
    KILL_SWITCH_ACTIVE = true;
    console.error(`\n🚨 KILL SWITCH ACTIVATED: ${reason}\n`);
}

export function deactivateKillSwitch() {
    KILL_SWITCH_ACTIVE = false;
    console.log(`\n✅ Kill switch deactivated\n`);
}

export function isKillSwitchActive() {
    return KILL_SWITCH_ACTIVE;
}

export async function signPoolInputSafe(...args) {
    if (KILL_SWITCH_ACTIVE) {
        throw new Error('KILL SWITCH ACTIVE: Pool signing is disabled');
    }
    
    return signPoolInput(...args);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🧪 TESTING & STATUS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Testar conexão LND
 */
export async function testLNDIntegration() {
    if (!USE_LND) {
        return {
            enabled: false,
            message: 'LND integration disabled (USE_LND_FOR_POOLS=false)'
        };
    }
    
    try {
        const lnd = getLNDPoolClient();
        const status = await lnd.testConnection();
        
        return {
            enabled: true,
            connected: status.connected,
            ...status
        };
    } catch (error) {
        return {
            enabled: true,
            connected: false,
            error: error.message
        };
    }
}

/**
 * Get pool signer status
 */
export async function getPoolSignerStatus() {
    const lndTest = await testLNDIntegration();
    
    return {
        mode: USE_LND ? 'LND' : 'HD Wallet',
        lnd: lndTest,
        killSwitch: KILL_SWITCH_ACTIVE,
        signingLog: signingLog.length
    };
}

export default {
    generatePoolAddress,
    signPoolInput,
    signPoolInputSafe,
    finalizeAndExtract,
    logSigning,
    getSigningLog,
    activateKillSwitch,
    deactivateKillSwitch,
    isKillSwitchActive,
    testLNDIntegration,
    getPoolSignerStatus
};

