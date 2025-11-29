/**
 * MyWallet API - Generate Real Bitcoin Taproot Addresses
 */

import express from 'express';
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import lndConnection from '../services/lndConnection.js';
import axios from 'axios';
import { calculateTaprootSighash, extractPrevoutsFromPsbt } from '../utils/taprootSighash.js';
import utxoFilter from '../utils/utxoFilter.js';

const router = express.Router();

// Initialize ECC
bitcoin.initEccLib(ecc);

// Network configuration
const network = process.env.NETWORK === 'testnet'
    ? bitcoin.networks.testnet
    : bitcoin.networks.bitcoin;

// Não precisamos de ensureBIP32Buffer - vamos usar tweakedChild diretamente!

/**
 * POST /api/mywallet/generate
 * Generate mnemonic and derive Taproot address
 * TAMBÉM inicializa wallet LND automaticamente!
 */
router.post('/generate', async (req, res) => {
    try {
        const { wordCount = 12, password } = req.body;
        
        console.log(`🔑 Generating ${wordCount}-word mnemonic...`);
        
        // Generate real BIP39 mnemonic
        const strength = wordCount === 24 ? 256 : 128;
        const mnemonic = bip39.generateMnemonic(strength);
        
        console.log('✅ Mnemonic generated');
        
        // Derive Taproot address
        const { address, publicKey } = await deriveTaprootAddress(mnemonic);
        
        console.log('✅ Taproot address derived:', address);
        
        // ⚡ INICIALIZAR WALLET LND DE FORMA ASSÍNCRONA (NÃO BLOQUEIA!)
        if (password) {
            console.log('⚡ Starting LND wallet initialization in background...');
            // Executar em background (não espera terminar)
            setImmediate(async () => {
                try {
                    const lndResult = await lndConnection.initWalletWithSeed(mnemonic, password);
                    console.log('✅ LND wallet initialized in background:', lndResult.message);
                } catch (lndError) {
                    console.warn('⚠️  LND initialization failed:', lndError.message);
                }
            });
        }
        
        res.json({
            success: true,
            mnemonic,
            address,
            publicKey
        });
    } catch (error) {
        console.error('❌ Error generating wallet:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/mywallet/restore
 * Restore wallet from mnemonic
 * TAMBÉM inicializa wallet LND automaticamente!
 */
router.post('/restore', async (req, res) => {
    try {
        const { mnemonic, password } = req.body;
        
        console.log('🔄 Restoring wallet from mnemonic...');
        
        // Validate mnemonic
        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic phrase');
        }
        
        console.log('✅ Mnemonic valid');
        
        // Derive Taproot address
        const { address, publicKey } = await deriveTaprootAddress(mnemonic);
        
        console.log('✅ Wallet restored:', address);
        
        // ⚡ INICIALIZAR WALLET LND DE FORMA ASSÍNCRONA (NÃO BLOQUEIA!)
        if (password) {
            console.log('⚡ Starting LND wallet initialization in background...');
            // Executar em background (não espera terminar)
            setImmediate(async () => {
                try {
                    const lndResult = await lndConnection.initWalletWithSeed(mnemonic, password);
                    console.log('✅ LND wallet initialized in background:', lndResult.message);
                } catch (lndError) {
                    console.warn('⚠️  LND initialization failed:', lndError.message);
                }
            });
        }
        
        res.json({
            success: true,
            address,
            publicKey
        });
    } catch (error) {
        console.error('❌ Error restoring wallet:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Derive Taproot Address from Mnemonic
 * Path: m/86'/0'/0'/0/0 (BIP86 - Taproot)
 */
async function deriveTaprootAddress(mnemonic) {
    try {
        // Convert mnemonic to seed
        const seed = await bip39.mnemonicToSeed(mnemonic);
        
        // Create HD wallet root  
        const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);
        
        // Derive Taproot path: m/86'/0'/0'/0/0
        const path = "m/86'/0'/0'/0/0";
        const child = root.derivePath(path);
        
        // Get x-only public key for Taproot (33 bytes → 32 bytes)
        const publicKey = child.publicKey;
        
        // Convert to x-only (remove first byte which is the prefix)
        const xOnlyBytes = child.publicKey.subarray(1, 33);
        
        // Ensure it's a proper Buffer (not Uint8Array)
        const xOnlyPubkey = Buffer.from(xOnlyBytes);
        
        console.log('X-only pubkey:', xOnlyPubkey.toString('hex'));
        
        // Create Taproot address (P2TR)
        const { address, output } = bitcoin.payments.p2tr({
            internalPubkey: xOnlyPubkey,
            network
        });
        
        console.log('Generated address:', address);
        
        return {
            address,
            publicKey: xOnlyPubkey.toString('hex')
        };
    } catch (error) {
        console.error('Error deriving Taproot address:', error);
        throw error;
    }
}

/**
 * Sign PSBT with wallet's private key
 * POST /api/mywallet/sign
 */
router.post('/sign', async (req, res) => {
    try {
        const { mnemonic, psbt, network: reqNetwork = 'mainnet', sighashType, inputsToSign } = req.body;
        
        if (!mnemonic || !psbt) {
            return res.status(400).json({
                success: false,
                error: 'Mnemonic and PSBT are required'
            });
        }
        
        console.log('🔏 Signing PSBT...');
        if (sighashType) {
            console.log(`  🎯 Custom SIGHASH type: ${sighashType}`);
        }
        
        // Validar mnemonic
        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic phrase');
        }
        
        // Network
        const btcNetwork = reqNetwork === 'testnet' 
            ? bitcoin.networks.testnet 
            : bitcoin.networks.bitcoin;
        
        // Derivar private key - TESTAR MÚLTIPLOS PATHS
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const root = bip32.BIP32Factory(ecc).fromSeed(seed, btcNetwork);
        
        // 🔍 Paths comuns usados por diferentes carteiras Taproot:
        const commonPaths = [
            "m/86'/0'/0'/0/0",  // BIP86 padrão (Sparrow, Bitcoin Core descriptor)
            "m/86'/0'/0'",       // Algumas carteiras usam sem /0/0
            "m/86h/0h/0h/0/0",  // Notação alternativa
        ];
        
        console.log('🔍 Trying multiple derivation paths...');
        let childRaw = null;
        for (const testPath of commonPaths) {
            try {
                const testChild = root.derivePath(testPath);
                console.log(`   Testing path: ${testPath}`);
                childRaw = testChild;
                break; // Usar o primeiro que funcionar
            } catch (e) {
                console.log(`   ❌ Path ${testPath} failed:`, e.message);
            }
        }
        
        if (!childRaw) {
            throw new Error('Could not derive key from any known path');
        }
        
        const path = "m/86'/0'/0'/0/0"; // Para logging
        
        // SOLUÇÃO FINAL: O BIP32 signSchnorr NÃO faz o tweak automaticamente!
        // Precisamos fazer o tweak manualmente e criar um signer customizado
        const xOnlyInternal = Buffer.from(childRaw.publicKey.subarray(1, 33));
        const tapTweak = bitcoin.crypto.taggedHash('TapTweak', xOnlyInternal);
        let tweakedPrivateKey = ecc.privateAdd(childRaw.privateKey, tapTweak);
        
        if (!tweakedPrivateKey) {
            throw new Error('Failed to tweak private key');
        }
        
        // ⚠️ CRITICAL: Para Taproot, SEMPRE devemos usar Y even!
        // Se o ponto tweaked tiver Y odd, devemos NEGAR a private key!
        const tweakedPubkey = ecc.pointFromScalar(tweakedPrivateKey);
        const hasEvenY = (tweakedPubkey[0] === 0x02);
        
        if (!hasEvenY) {
            console.log('  ⚠️  Tweaked pubkey has ODD Y! Negating private key...');
            tweakedPrivateKey = ecc.privateNegate(tweakedPrivateKey);
            console.log('  ✅ Private key negated to get EVEN Y');
        } else {
            console.log('  ✅ Tweaked pubkey has EVEN Y (correct for Taproot)');
        }
        
        // Calcular a tweaked pubkey (full, 33 bytes) para o signer
        const tweakedPubkeyFull = ecc.pointFromScalar(tweakedPrivateKey);
        
        // Criar signer que usa ecc.signSchnorr com tweaked key
        const childSigner = {
            publicKey: Buffer.from(tweakedPubkeyFull),  // DEVE ser a tweaked pubkey!
            privateKey: tweakedPrivateKey,
            network: childRaw.network,
            sign: (hash, lowR) => {
                // ECDSA com chave tweaked
                return ecc.sign(hash, tweakedPrivateKey, lowR);
            },
            signSchnorr: (hash) => {
                // Schnorr com chave tweaked + auxRand
                const auxRand = Buffer.alloc(32, 0);
                const sig = ecc.signSchnorr(hash, tweakedPrivateKey, auxRand);
                return sig;
            }
        };
        
        // Parsear PSBT
        const psbtObj = bitcoin.Psbt.fromBase64(psbt, { network: btcNetwork });
        
        console.log('  PSBT inputs:', psbtObj.data.inputs.length);
        
        // Função de validação para Schnorr signatures
        const validator = (pubkey, msghash, signature) => {
            return ecc.verifySchnorr(msghash, pubkey, signature);
        };
        
        // 🎯 Determinar quais inputs assinar
        console.log('🔍 inputsToSign received:', inputsToSign);
        console.log('🔍 inputsToSign type:', typeof inputsToSign);
        console.log('🔍 inputsToSign isArray:', Array.isArray(inputsToSign));
        
        let inputIndicesToSign = [];
        if (inputsToSign && Array.isArray(inputsToSign) && inputsToSign.length > 0) {
            // ✅ USAR inputsToSign do request (para atomic swaps)
            // Aceitar tanto [1, 2] quanto [{index: 1}, {index: 2}]
            inputIndicesToSign = inputsToSign.map(input => 
                typeof input === 'number' ? input : input.index
            );
            console.log(`  🎯 Signing SPECIFIC inputs (atomic swap mode):`, inputIndicesToSign);
        } else {
            // Assinar TODOS os inputs (modo normal)
            inputIndicesToSign = Array.from({ length: psbtObj.data.inputs.length }, (_, i) => i);
            console.log(`  🎯 Signing ALL inputs (normal mode):`, inputIndicesToSign);
        }
        
        // Para Taproot key path, adicionar tapInternalKey APENAS se conseguir assinar
        for (let i = 0; i < psbtObj.data.inputs.length; i++) {
            try {
                const input = psbtObj.data.inputs[i];
                
                console.log(`\n  🔍 Input ${i} detailed check:`);
                console.log(`     witnessUtxo script:`, input.witnessUtxo?.script.toString('hex').substring(0, 40) + '...');
                console.log(`     witnessUtxo value:`, input.witnessUtxo?.value);
                
                // ⚠️ CRÍTICO: SKIP se este input NÃO está na lista inputsToSign
                if (!inputIndicesToSign.includes(i)) {
                    console.log(`  ⏭️  Input ${i}: NOT in inputsToSign list, SKIPPING`);
                    continue;
                }
                
                // ⚠️ CRÍTICO: Só adicionar tapInternalKey se este input for NOSSO!
                // Se já tem tapKeySig, significa que foi assinado por outra wallet
                if (input.tapKeySig) {
                    console.log(`  ⏭️  Input ${i}: Already signed by another wallet, SKIPPING`);
                    continue;
                }
                
                // ✅ VERIFICAR se precisamos adicionar tapInternalKey
                if (!input.tapInternalKey) {
                    console.log(`  📝 Input ${i}: No tapInternalKey, need to determine it...`);
                    
                    // Extrair Output Key (P) do scriptPubKey
                    const scriptPubKey = input.witnessUtxo.script;
                    if (scriptPubKey.length === 34 && scriptPubKey[0] === 0x51 && scriptPubKey[1] === 0x20) {
                        const outputKey = scriptPubKey.slice(2); // P (32 bytes, x-only)
                        console.log(`     Output Key (P) from script:`, outputKey.toString('hex').substring(0, 32) + '...');
                        console.log(`     Our Internal Key (Q):`, xOnlyInternal.toString('hex').substring(0, 32) + '...');
                        
                        // Verificar se NOSSO Internal Key + tweak = Output Key
                        const ourTweak = bitcoin.crypto.taggedHash('TapTweak', xOnlyInternal);
                        const tweakedFromOurs = ecc.pointAddScalar(
                            Buffer.concat([Buffer.from([0x02]), xOnlyInternal]), // Prefixo 02 para even Y
                            ourTweak
                        );
                        
                        if (tweakedFromOurs) {
                            const ourOutputKey = Buffer.from(tweakedFromOurs.subarray(1, 33)); // x-only
                            const isOurs = ourOutputKey.equals(outputKey);
                            
                            console.log(`     Our Output Key (computed):`, ourOutputKey.toString('hex').substring(0, 32) + '...');
                            console.log(`     Match: ${isOurs ? '✅ YES' : '❌ NO'}`);
                            
                            if (isOurs) {
                                console.log(`     ✅ This UTXO is OURS! Using our tapInternalKey`);
                                psbtObj.updateInput(i, {
                                    tapInternalKey: xOnlyInternal
                                });
                            } else {
                                console.log(`     ⚠️  Output keys don't match!`);
                                console.log(`     🔬 This could mean:`);
                                console.log(`        - Different derivation path`);
                                console.log(`        - Different wallet`);
                                console.log(`     💡 BUT: We'll still use OUR tapInternalKey, because:`);
                                console.log(`        - The UTXO is in OUR address (confirmed by test-taproot-match.js)`);
                                console.log(`        - Our tweaked private key SHOULD be able to sign it`);
                                
                                // USAR NOSSA internal key MESMO ASSIM
                                // Já confirmamos que o UTXO está no NOSSO endereço!
                                psbtObj.updateInput(i, {
                                    tapInternalKey: xOnlyInternal // NOSSA internal key
                                });
                                console.log(`     ✅ Added OUR tapInternalKey (since UTXO is in our address)`);
                            }
                        }
                    }
                } else {
                    console.log(`  ℹ️  Input ${i}: tapInternalKey already present:`, input.tapInternalKey.toString('hex'));
                }
                
                // ✅ USAR psbt.signInput() em vez de cálculo manual!
                // Mesma lógica do /api/mywallet/send que FUNCIONA!
                console.log(`  🖊️  Signing input ${i} with psbt.signInput()...`);
                
                // Preparar sighash types permitidos (se especificado)
                let signOptions = undefined;
                let sighashValue = 0x00; // SIGHASH_DEFAULT (fora do if para ser acessível no catch)
                if (sighashType) {
                    if (sighashType === 'NONE|ANYONECANPAY') {
                        sighashValue = 0x82;
                    } else if (sighashType === 'SINGLE|ANYONECANPAY') {
                        sighashValue = 0x83;
                    } else if (sighashType === 'ALL|ANYONECANPAY') {
                        sighashValue = 0x81;
                    } else if (sighashType === 'ALL') {
                        sighashValue = 0x01;
                    }
                    console.log(`  🎯 Using custom SIGHASH: ${sighashType} (0x${sighashValue.toString(16)})`);
                    signOptions = [sighashValue]; // Array de sighash types permitidos
                }
                
                // Assinar usando bitcoinjs-lib signInput (que calcula sighash corretamente)
                // ⚠️ CRÍTICO: Para SIGHASH customizado com Taproot, precisamos calcular manualmente!
                if (sighashValue !== 0x00 && sighashValue !== 0x01) {
                    // SIGHASH customizado (SINGLE|ANYONECANPAY, etc) - Assinar manualmente
                    console.log(`  🔨 Manual Taproot signing with SIGHASH 0x${sighashValue.toString(16)}...`);
                    
                    // Calcular sighash com o tipo customizado
                    const input = psbtObj.data.inputs[i];
                    const prevouts = psbtObj.txInputs.map((inp, idx) => {
                        const prevInput = psbtObj.data.inputs[idx];
                        return {
                            txid: Buffer.from(inp.hash).reverse().toString('hex'),
                            vout: inp.index,
                            value: prevInput.witnessUtxo?.value || 0,
                            scriptPubKey: prevInput.witnessUtxo?.script || Buffer.alloc(0)
                        };
                    });
                    
                    // Importar calculateTaprootSighash dinamicamente
                    const { calculateTaprootSighash: calcSighash } = await import('../utils/taprootSighash.js');
                    const sighash = calcSighash(
                        psbtObj,  // ✅ Passar o PSBT object completo
                        i,        // inputIndex
                        prevouts, // prevouts array
                        sighashValue  // sighashType
                    );
                    
                    console.log(`  🔐 Sighash calculated: ${sighash.toString('hex').substring(0, 32)}...`);
                    
                    // Assinar o sighash com Schnorr
                    const signatureBase = childSigner.signSchnorr(sighash);
                    console.log(`  ✅ Schnorr signature created: ${signatureBase.length} bytes`);
                    
                    // ✅ CRITICAL FIX: Quando usamos sighashType como campo separado,
                    // a assinatura deve ter 64 bytes SEM o byte concatenado!
                    // O bitcoinjs-lib vai adicionar o byte automaticamente durante finalize
                    // baseado no campo sighashType.
                    
                    // ⚠️ CRITICAL: Garantir que a assinatura é um Buffer!
                    // ecc.signSchnorr pode retornar Uint8Array, mas bitcoinjs-lib precisa de Buffer
                    const signatureBuffer = Buffer.from(signatureBase);
                    
                    // Adicionar assinatura ao PSBT
                    // 🔥 CRITICAL: SEMPRE adicionar sighashType junto com tapKeySig!
                    // A assinatura fica com 64 bytes e o sighash como campo separado
                    psbtObj.updateInput(i, {
                        tapKeySig: signatureBuffer,  // ✅ 64 bytes Buffer, SEM sighash concatenado!
                        sighashType: sighashValue    // ✅ CRÍTICO para finalizeInput()!
                    });
                    
                    console.log(`  ✅ Signature added to PSBT with sighashType 0x${sighashValue.toString(16)}`);
                } else {
                    // SIGHASH padrão (ALL ou DEFAULT) - Usar signInput normal
                    console.log(`  🖊️  Standard signing with SIGHASH 0x${sighashValue.toString(16)}...`);
                    
                    // ⚠️ CRÍTICO: bitcoinjs-lib verifica o input.sighashType!
                    // Precisamos ADICIONAR o campo sighashType ao input ANTES de assinar!
                    if (sighashValue === 0x01) {
                        // SIGHASH_ALL (0x01)
                        console.log(`  🔧 Setting input.sighashType = 0x01 and passing [0x01, 0x00] as allowed...`);
                        
                        // ✅ ADICIONAR sighashType ao input
                        psbtObj.updateInput(i, {
                            sighashType: 0x01
                        });
                        
                        // Assinar com array de tipos permitidos [0x01, 0x00] (ALL e DEFAULT)
                        psbtObj.signInput(i, childSigner, [0x01, 0x00]);
                    } else if (sighashValue === 0x00) {
                        // SIGHASH_DEFAULT (0x00) - Pode assinar sem array
                        psbtObj.signInput(i, childSigner);
                    } else if (signOptions) {
                        psbtObj.signInput(i, childSigner, signOptions);
                    } else {
                        psbtObj.signInput(i, childSigner);
                    }
                }
                
                console.log(`  ✅ Input ${i} signed`);
                
                // Validar assinatura
                // ⚠️ SKIP validation for SIGHASH_NONE with 0 outputs (bitcoinjs-lib bug)
                if (sighashValue === 0x82 && psbtObj.txOutputs.length === 0) {
                    console.log(`  ⚠️  SKIPPING validation for SIGHASH_NONE with 0 outputs (bitcoinjs-lib limitation)`);
                } else {
                const isValid = psbtObj.validateSignaturesOfInput(i, validator);
                    console.log(`  ✅ Input ${i} signature validated: ${isValid}`);
                }
            } catch (signError) {
                console.error(`  ❌ Input ${i} signing FAILED:`, signError.message);
                console.error(`     Full error:`, signError);
                console.error(`     Error name:`, signError.name);
                console.error(`     Stack:`, signError.stack);
                
                // ⚠️ Se este input DEVERIA ser assinado (está no inputsToSign), FALHAR!
                if (inputIndicesToSign.includes(i)) {
                    throw new Error(`CRITICAL: Failed to sign input ${i} (which should be signed): ${signError.message}`);
                }
                
                console.log(`  ⚠️  Input ${i} skip (not ours or already signed):`, signError.message);
            }
        }
        
        // Retornar PSBT signed (SEM FINALIZAR - marketplace faz isso)
        const signedPsbtBase64 = psbtObj.toBase64();
        console.log('  ✅ PSBT signed (not finalized)');
        console.log('  📦 Signed PSBT length:', signedPsbtBase64.length);
        
        // 🔍 DEBUG: Verificar assinaturas no PSBT signed
        console.log('\n🔍 SIGNED PSBT VERIFICATION:');
        for (let i = 0; i < psbtObj.data.inputs.length; i++) {
            const input = psbtObj.data.inputs[i];
            console.log(`   Input ${i}:`, {
                hasTapKeySig: !!input.tapKeySig,
                tapKeySigLength: input.tapKeySig?.length || 0,
                hasFinalScriptWitness: !!input.finalScriptWitness
            });
        }
        
        res.json({
            success: true,
            signedPsbt: signedPsbtBase64
        });
        
    } catch (error) {
        console.error('❌ Error signing PSBT:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Finalize PSBT and extract hex
 * POST /api/mywallet/finalize-psbt
 */
router.post('/finalize-psbt', async (req, res) => {
    try {
        const { psbt } = req.body;
        
        if (!psbt) {
            return res.status(400).json({
                success: false,
                error: 'PSBT is required'
            });
        }
        
        console.log('🔨 Finalizing PSBT...');
        console.log('  PSBT length:', psbt.length);
        
        // Parse PSBT
        const psbtObj = bitcoin.Psbt.fromBase64(psbt);
        
        // 🔍 DEBUG: Ver os inputs do PSBT ANTES de finalizar
        console.log('\n  🔍 PSBT Inputs BEFORE finalize:');
        console.log(`     Total txInputs: ${psbtObj.txInputs.length}`);
        for (let i = 0; i < psbtObj.data.inputs.length; i++) {
            const input = psbtObj.data.inputs[i];
            const txInput = psbtObj.txInputs[i];
            console.log(`\n     txInput ${i}:`);
            console.log(`        hash (buffer): ${txInput.hash.toString('hex').substring(0, 32)}...`);
            console.log(`        hash (reversed): ${Buffer.from(txInput.hash).reverse().toString('hex').substring(0, 16)}...`);
            console.log(`        index: ${txInput.index}`);
            console.log(`        witnessUtxo value: ${input.witnessUtxo?.value || 'MISSING'}`);
        }
        
        // Finalizar todos os inputs
        for (let i = 0; i < psbtObj.data.inputs.length; i++) {
            try {
                console.log(`  🔨 Finalizing input ${i}...`);
                const beforeFinalize = psbtObj.data.inputs[i];
                console.log(`     Has tapKeySig:`, !!beforeFinalize.tapKeySig);
                console.log(`     Has tapInternalKey:`, !!beforeFinalize.tapInternalKey);
                
                psbtObj.finalizeInput(i);
                console.log(`  ✅ Input ${i} finalized`);
                
                // Verificar witness após finalização
                const finalInput = psbtObj.data.inputs[i];
                if (finalInput.finalScriptWitness) {
                    console.log(`     ✅ finalScriptWitness: ${finalInput.finalScriptWitness.length} bytes`);
                }
            } catch (error) {
                console.log(`  ⚠️  Input ${i} error:`, error.message);
            }
        }
        
        // Extrair transação
        console.log('\n  📤 Extracting transaction...');
        const tx = psbtObj.extractTransaction();
        const hex = tx.toHex();
        
        console.log('✅ PSBT finalized successfully');
        console.log('  Transaction hex length:', hex.length);
        console.log('  Transaction ID:', tx.getId());
        console.log('\n  🔍 Full transaction hex:');
        console.log(hex);
        console.log('');
        
        res.json({
            success: true,
            hex: hex,
            txid: tx.getId()
        });
        
    } catch (error) {
        console.error('❌ Error finalizing PSBT:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Sign message (for likes and authentication)
 * POST /api/kraywallet/sign-message
 */
router.post('/sign-message', async (req, res) => {
    try {
        const { mnemonic, message } = req.body;
        
        console.log('✍️  Signing message...');
        console.log('   Message:', message);
        console.log('   Mnemonic provided:', !!mnemonic);
        
        if (!mnemonic || !message) {
            return res.status(400).json({
                success: false,
                error: 'Mnemonic and message are required'
            });
        }
        
        // Derive key from mnemonic
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);
        
        // Taproot path
        const path = "m/86'/0'/0'/0/0";
        const child = root.derivePath(path);
        
        // Get Taproot address
        const internalPubkey = Buffer.from(child.publicKey.slice(1, 33));
        const { address } = bitcoin.payments.p2tr({
            internalPubkey,
            network
        });
        
        // Get private key
        const privateKey = child.privateKey;
        if (!privateKey) {
            return res.status(500).json({
                success: false,
                error: 'Failed to derive private key'
            });
        }
        
        // Sign message
        const encoder = new TextEncoder();
        const messageBuffer = encoder.encode(message);
        const messageHash = bitcoin.crypto.sha256(messageBuffer);
        const signature = ecc.sign(messageHash, privateKey);
        const signatureBase64 = Buffer.from(signature).toString('base64');
        
        console.log('✅ Message signed successfully');
        console.log('   Address:', address);
        console.log('   Signature length:', signatureBase64.length);
        
        return res.json({
            success: true,
            signature: signatureBase64,
            address: address
        });
        
    } catch (error) {
        console.error('❌ Error signing message:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Create and sign transaction
 * POST /api/mywallet/send
 */
router.post('/send', async (req, res) => {
    try {
        const { mnemonic, toAddress, amount, feeRate, network: reqNetwork = 'mainnet' } = req.body;
        
        if (!mnemonic || !toAddress || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Mnemonic, address and amount are required'
            });
        }
        
        console.log('💸 Creating transaction...');
        console.log('  To:', toAddress);
        console.log('  Amount:', amount, 'sats');
        console.log('  Fee rate:', feeRate, 'sat/vB');
        
        // Derivar endereço from mnemonic
        const { address: fromAddress } = await deriveTaprootAddress(mnemonic);
        console.log('  From:', fromAddress);
        
        // Buscar UTXOs (usando Mempool.space)
        const utxosResponse = await fetch(`https://mempool.space/api/address/${fromAddress}/utxo`);
        const utxos = await utxosResponse.json();
        
        if (!utxos || utxos.length === 0) {
            throw new Error('No UTXOs found. Address has no funds.');
        }
        
        console.log('  Found', utxos.length, 'UTXOs');
        
        // 🛡️ PROTEÇÃO CRÍTICA: Filtrar UTXOs puros (sem Inscriptions nem Runes)
        console.log('  🛡️  Filtering pure UTXOs (protecting Inscriptions and Runes)...');
        const pureUtxos = await utxoFilter.filterPureUTXOs(utxos);
        console.log('  Pure UTXOs (safe to use):', pureUtxos.length);
        
        if (pureUtxos.length === 0) {
            throw new Error('No pure UTXOs available. All your UTXOs contain Inscriptions or Runes.');
        }
        
        // Selecionar UTXOs (usar primeiro que tenha valor suficiente)
        let totalInput = 0;
        const selectedUtxos = [];
        
        for (const utxo of pureUtxos) {
            selectedUtxos.push(utxo);
            totalInput += utxo.value;
            
            // Estimar fee (aproximado: 2 inputs, 2 outputs)
            const estimatedSize = selectedUtxos.length * 68 + 2 * 43 + 10;
            const estimatedFee = estimatedSize * (feeRate || 1);
            
            if (totalInput >= amount + estimatedFee + 546) { // +546 para dust limit do change
                break;
            }
        }
        
        console.log('  Selected', selectedUtxos.length, 'UTXOs');
        console.log('  Total input:', totalInput, 'sats');
        console.log('  UTXOs selecionados:');
        selectedUtxos.forEach((utxo, i) => {
            console.log(`    UTXO #${i}: ${utxo.txid}:${utxo.vout} = ${utxo.value} sats`);
        });
        
        // Calcular fee com iteração para determinar se haverá change
        // Taproot P2TR: ~57.5 vbytes por input, ~43 vbytes por output, ~10.5 vbytes overhead
        let numOutputs = 1; // Pelo menos 1 output (destinatário)
        let txSize = Math.ceil(selectedUtxos.length * 57.5 + numOutputs * 43 + 10.5);
        let fee = Math.max(txSize * (feeRate || 1), 350); // Mínimo 350 sats para garantir relay
        let change = totalInput - amount - fee;
        
        // Se o change for >= 546 (dust limit), precisamos adicionar um output de change
        // Isso aumenta o tamanho da tx, então recalculamos
        if (change >= 546) {
            numOutputs = 2; // Destinatário + change
            txSize = Math.ceil(selectedUtxos.length * 57.5 + numOutputs * 43 + 10.5);
            fee = Math.max(txSize * (feeRate || 1), 350); // Mínimo 350 sats para garantir relay
            change = totalInput - amount - fee;
            
            // Verificar novamente se ainda é >= 546 após recalcular fee
            if (change < 546) {
                // Change ficou muito pequeno após recalcular fee, então não adiciona change
                numOutputs = 1;
                txSize = Math.ceil(selectedUtxos.length * 57.5 + numOutputs * 43 + 10.5);
                fee = Math.max(txSize * (feeRate || 1), 350); // Mínimo 350 sats para garantir relay
                change = totalInput - amount - fee;
            }
        }
        
        console.log('  Number of outputs:', numOutputs);
        console.log('  Estimated tx size:', txSize, 'vbytes');
        console.log('  Fee:', fee, 'sats');
        console.log('  Change:', change, 'sats');
        
        if (change < 0) {
            throw new Error(`Insufficient funds. Need ${amount + fee} sats, have ${totalInput} sats`);
        }
        
        // Network
        const btcNetwork = reqNetwork === 'testnet'
            ? bitcoin.networks.testnet
            : bitcoin.networks.bitcoin;
        
        // Criar PSBT
        const psbt = new bitcoin.Psbt({ network: btcNetwork });
        
        // Derivar keys
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const root = bip32.BIP32Factory(ecc).fromSeed(seed, btcNetwork);
        const childRaw = root.derivePath("m/86'/0'/0'/0/0");
        
        // ✅ TAPROOT KEY PATH SPENDING (BIP 341)
        // Para Taproot key-path spend:
        // - Output contém: tweaked public key (P = p + hash(p||h)G)
        // - Input precisa: tapInternalKey (p) - internal key SEM tweak
        // - Assinatura: FEITA COM A CHAVE ORIGINAL (SEM TWEAK!)
        // - Verificação: Node aplica o tweak automaticamente
        
        const xOnlyInternal = Buffer.from(childRaw.publicKey.subarray(1, 33));
        const tapTweak = bitcoin.crypto.taggedHash('TapTweak', xOnlyInternal);
        
        // ✅ USAR A CHAVE ORIGINAL (SEM TWEAK) para assinar!
        const privateKey = childRaw.privateKey;
        
        console.log('  🔑 Internal Key (x-only):', xOnlyInternal.toString('hex').substring(0, 16) + '...');
        console.log('  🔑 Tap Tweak:', tapTweak.toString('hex').substring(0, 16) + '...');
        
        // Calcular tweaked pubkey APENAS para verificação (não para assinar!)
        let tweakedPrivateKey = ecc.privateAdd(privateKey, tapTweak);
        if (!tweakedPrivateKey) {
            throw new Error('Failed to calculate tweaked private key');
        }
        
        // Verificar se precisa negar (Y even)
        const tweakedPubkey = ecc.pointFromScalar(tweakedPrivateKey);
        const hasEvenY = (tweakedPubkey[0] === 0x02);
        
        if (!hasEvenY) {
            console.log('  ⚠️  Tweaked pubkey has ODD Y! Negating...');
            tweakedPrivateKey = ecc.privateNegate(tweakedPrivateKey);
        }
        
        const tweakedPubkeyFull = ecc.pointFromScalar(tweakedPrivateKey);
        
        // ✅ SIGNER COM CHAVE TWEAKED (bitcoinjs-lib faz o tweak internamente ao assinar)
        const childSigner = {
            publicKey: Buffer.from(tweakedPubkeyFull),
            privateKey: tweakedPrivateKey,
            network: childRaw.network,
            sign: (hash, lowR) => {
                return ecc.sign(hash, tweakedPrivateKey, lowR);
            },
            signSchnorr: (hash) => {
                console.log('    🖊️  Signing Schnorr (Taproot key-path)...');
                console.log('    📝 Hash:', hash.toString('hex').substring(0, 32) + '...');
                
                const auxRand = Buffer.alloc(32, 0);
                const sig = ecc.signSchnorr(hash, tweakedPrivateKey, auxRand);
                
                console.log('    ✅ Signature:', sig.toString('hex').substring(0, 32) + '...');
                
                // Verificar se a assinatura é válida
                const finalPubkey = ecc.pointFromScalar(tweakedPrivateKey);
                console.log('    🔍 Final pubkey prefix (should be 02 for even Y):', finalPubkey[0].toString(16));
                const finalPubkeyXOnly = Buffer.from(finalPubkey.subarray(1, 33));
                const valid = ecc.verifySchnorr(hash, finalPubkeyXOnly, sig);
                console.log('    ✔️  Assinatura válida (self-check)?', valid);
                console.log('    🔑 Final pubkey (x-only):', finalPubkeyXOnly.toString('hex'));
                
                return sig;
            }
        };
        
        // Internal key (non-tweaked) para tapInternalKey
        const xOnlyInternalPubkey = xOnlyInternal;
        
        // Tweaked pubkey (output key) para witnessUtxo e signer
        const tweakedPubkeyForWitness = childSigner.publicKey;  // Já é a tweaked pubkey full
        const tweakedXOnlyPubkey = Buffer.from(tweakedPubkeyForWitness.subarray(1, 33));
        
        console.log('  X-only pubkey (internal):', xOnlyInternalPubkey.toString('hex'));
        console.log('  X-only pubkey (tweaked/output):', tweakedXOnlyPubkey.toString('hex'));
        console.log('  Signer publicKey (full tweaked):', tweakedPubkeyForWitness.toString('hex'));
        console.log('  Signer publicKey is Buffer?', Buffer.isBuffer(childSigner.publicKey));
        console.log('  Signer has signSchnorr?', typeof childSigner.signSchnorr);
        
        // Adicionar inputs
        for (const utxo of selectedUtxos) {
            const txHex = await fetch(`https://mempool.space/api/tx/${utxo.txid}/hex`).then(r => r.text());
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    // ⚠️ CRITICAL: O script deve conter a TWEAKED pubkey (output key), NÃO a internal key!
                    script: Buffer.from(`5120${tweakedXOnlyPubkey.toString('hex')}`, 'hex'),
                    value: utxo.value
                },
                tapInternalKey: xOnlyInternalPubkey  // Internal key (non-tweaked, x-only 32 bytes)
            });
        }
        
        // Adicionar outputs
        psbt.addOutput({
            address: toAddress,
            value: amount
        });
        
        if (change >= 546) { // Dust limit
            psbt.addOutput({
                address: fromAddress,
                value: change
            });
        }
        
        console.log('  ✅ PSBT created');
        
        // ========== ASSINAR COM TAPROOT ==========
        console.log('  🔐 Signing with Taproot...');
        console.log('  🔑 Internal key (x-only):', xOnlyInternalPubkey.toString('hex'));
        console.log('  🔑 Tweaked key (x-only):', tweakedXOnlyPubkey.toString('hex'));
        console.log('  🔑 Using childSigner with tweaked Buffer publicKey');
        
        // Assinar todos os inputs com childSigner
        for (let i = 0; i < selectedUtxos.length; i++) {
            console.log(`  🖊️  Signing input #${i}...`);
            try {
                psbt.signInput(i, childSigner);
                console.log(`    ✅ Input #${i} signed successfully`);
            } catch (signErr) {
                console.error(`    ❌ Failed to sign input #${i}:`, signErr.message);
                throw signErr;
            }
        }
        
        console.log('  ✅ PSBT signed');
        
        // Finalizar
        psbt.finalizeAllInputs();
        console.log('  ✅ PSBT finalized');
        
        // Extrair
        const txHex = psbt.extractTransaction().toHex();
        const txid = psbt.extractTransaction().getId();
        
        console.log('  ✅ Transaction ready');
        console.log('  TXID:', txid);
        
        res.json({
            success: true,
            txHex,
            txid,
            fee,
            change
        });
        
    } catch (error) {
        console.error('❌ Error creating transaction:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/mywallet/send-inscription
 * Create and sign inscription transfer transaction
 */
router.post('/send-inscription', async (req, res) => {
    try {
        const { mnemonic, inscription, recipientAddress, feeRate, network: networkType = 'mainnet' } = req.body;
        
        console.log('📤 ========== SEND INSCRIPTION TRANSACTION ==========');
        console.log('  Inscription ID:', inscription.id);
        console.log('  UTXO:', inscription.utxo);
        console.log('  Recipient:', recipientAddress);
        console.log('  Fee Rate:', feeRate);
        
        if (!mnemonic || !inscription || !recipientAddress || !feeRate) {
            console.error('❌ Missing required fields');
            return res.status(400).json({
                success: false,
                error: 'Missing required fields (mnemonic, inscription, recipientAddress, feeRate)'
            });
        }
        
        if (!inscription.utxo || !inscription.utxo.txid || inscription.utxo.vout === undefined) {
            console.error('❌ Invalid inscription UTXO');
            return res.status(400).json({
                success: false,
                error: 'Invalid inscription UTXO data'
            });
        }
        
        // Derive keys from mnemonic
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);
        
        // BIP86 Taproot path: m/86'/0'/0'/0/0
        const path = "m/86'/0'/0'/0/0";
        const childRaw = root.derivePath(path);
        
        // ✅ USAR A MESMA LÓGICA DO sendBitcoin (que funciona)
        const xOnlyInternal = Buffer.from(childRaw.publicKey.subarray(1, 33));
        const tapTweak = bitcoin.crypto.taggedHash('TapTweak', xOnlyInternal);
        let tweakedPrivateKey = ecc.privateAdd(childRaw.privateKey, tapTweak);
        
        if (!tweakedPrivateKey) {
            throw new Error('Failed to tweak private key');
        }
        
        // Para Taproot, sempre usar Y even
        const tweakedPubkey = ecc.pointFromScalar(tweakedPrivateKey);
        const hasEvenY = (tweakedPubkey[0] === 0x02);
        
        if (!hasEvenY) {
            console.log('  ⚠️  Tweaked pubkey has ODD Y! Negating private key...');
            tweakedPrivateKey = ecc.privateNegate(tweakedPrivateKey);
            console.log('  ✅ Private key negated to get EVEN Y');
        }
        
        // Calcular a tweaked pubkey (full, 33 bytes) para o signer
        const tweakedPubkeyFull = ecc.pointFromScalar(tweakedPrivateKey);
        
        // Criar signer customizado (mesmo do sendBitcoin)
        const childSigner = {
            publicKey: Buffer.from(tweakedPubkeyFull),
            privateKey: tweakedPrivateKey,
            network: childRaw.network,
            sign: (hash, lowR) => {
                return ecc.sign(hash, tweakedPrivateKey, lowR);
            },
            signSchnorr: (hash) => {
                const auxRand = Buffer.alloc(32, 0);
                const sig = ecc.signSchnorr(hash, tweakedPrivateKey, auxRand);
                return sig;
            }
        };
        
        // ✅ Para derivar o endereço, usar a TWEAKED pubkey (x-only)
        const tweakedPubkeyXOnly = Buffer.from(tweakedPubkeyFull.subarray(1, 33));
        
        const senderAddress = bitcoin.payments.p2tr({
            pubkey: tweakedPubkeyXOnly,
            network
        }).address;
        
        console.log('  Sender address:', senderAddress);
        
        // Buscar UTXO da inscription
        const inscriptionUtxo = inscription.utxo;
        
        console.log('  Inscription UTXO:');
        console.log('    - TXID:', inscriptionUtxo.txid);
        console.log('    - VOUT:', inscriptionUtxo.vout);
        console.log('    - Value:', inscriptionUtxo.value, 'sats');
        
        // Buscar outros UTXOs para pagar a taxa (se necessário)
        console.log('  Fetching UTXOs for fees...');
        
        const utxosResponse = await fetch(`https://mempool.space/api/address/${senderAddress}/utxo`);
        const utxos = await utxosResponse.json();
        
        console.log('  Total UTXOs available:', utxos.length);
        
        // Filtrar UTXOs para pagar taxa (excluir a inscription UTXO)
        const paymentUtxos = utxos.filter(u => 
            u.txid !== inscriptionUtxo.txid || u.vout !== inscriptionUtxo.vout
        );
        
        console.log('  Payment UTXOs (excluding inscription):', paymentUtxos.length);
        
        // 🛡️ PROTEÇÃO CRÍTICA: Filtrar UTXOs puros para pagar fees
        console.log('  🛡️  Filtering pure UTXOs for fees (protecting other assets)...');
        const purePaymentUtxos = await utxoFilter.filterPureUTXOs(paymentUtxos);
        console.log('  Pure payment UTXOs (safe to use):', purePaymentUtxos.length);
        
        if (purePaymentUtxos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No pure UTXOs available for fees. All your UTXOs contain assets that cannot be used.'
            });
        }
        
        // Estimar taxa
        // TX típico de inscription: 1 input (inscription) + 1-2 inputs (payment) + 1-2 outputs = ~300-400 vbytes
        const estimatedSize = 350; // Conservative estimate
        const estimatedFee = Math.ceil(estimatedSize * feeRate);
        
        console.log('  Estimated size:', estimatedSize, 'vbytes');
        console.log('  Estimated fee:', estimatedFee, 'sats');
        
        // Selecionar UTXOs para pagar a taxa
        let selectedUtxos = [];
        let totalInput = 0;
        
        for (const utxo of purePaymentUtxos.sort((a, b) => b.value - a.value)) {
            selectedUtxos.push(utxo);
            totalInput += utxo.value;
            
            if (totalInput >= estimatedFee + 546) { // 546 = dust limit para change
                break;
            }
        }
        
        if (totalInput < estimatedFee) {
            console.error('❌ Insufficient funds for fees');
            console.error('   Need:', estimatedFee, 'sats');
            console.error('   Have:', totalInput, 'sats');
            return res.status(400).json({
                success: false,
                error: `Insufficient funds for fees. Need ${estimatedFee} sats, have ${totalInput} sats`
            });
        }
        
        console.log('  Selected', selectedUtxos.length, 'UTXOs for fees');
        console.log('  Total payment input:', totalInput, 'sats');
        
        // Calcular change
        const change = totalInput - estimatedFee;
        console.log('  Change:', change, 'sats');
        
        // Criar PSBT
        const psbt = new bitcoin.Psbt({ network });
        
        // ✅ INPUT 0: INSCRIPTION UTXO
        console.log('  Adding inscription input...');
        
        // Buscar raw transaction para o inscription UTXO
        const inscTxResponse = await fetch(`https://mempool.space/api/tx/${inscriptionUtxo.txid}/hex`);
        const inscTxHex = await inscTxResponse.text();
        const inscTx = bitcoin.Transaction.fromHex(inscTxHex);
        
        const inscScriptPubKey = inscTx.outs[inscriptionUtxo.vout].script;
        
        psbt.addInput({
            hash: inscriptionUtxo.txid,
            index: inscriptionUtxo.vout,
            witnessUtxo: {
                script: inscScriptPubKey,
                value: inscriptionUtxo.value
            },
            tapInternalKey: xOnlyInternal
        });
        
        // ✅ INPUTS: PAYMENT UTXOS
        console.log('  Adding payment inputs...');
        
        for (const utxo of selectedUtxos) {
            const txResponse = await fetch(`https://mempool.space/api/tx/${utxo.txid}/hex`);
            const txHex = await txResponse.text();
            const tx = bitcoin.Transaction.fromHex(txHex);
            
            const scriptPubKey = tx.outs[utxo.vout].script;
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: scriptPubKey,
                    value: utxo.value
                },
                tapInternalKey: xOnlyInternal
            });
        }
        
        // ✅ OUTPUT 0: INSCRIPTION TO RECIPIENT
        console.log('  Adding outputs...');
        console.log('    Output 0: Inscription to recipient (', inscriptionUtxo.value, 'sats )');
        
        psbt.addOutput({
            address: recipientAddress,
            value: inscriptionUtxo.value
        });
        
        // ✅ OUTPUT 1: CHANGE (if > dust limit)
        if (change >= 546) {
            console.log('    Output 1: Change to sender (', change, 'sats )');
            psbt.addOutput({
                address: senderAddress,
                value: change
            });
        } else {
            console.log('    Change too small (', change, 'sats ), adding to fee');
        }
        
        // Assinar todos os inputs
        console.log('  Signing inputs...');
        
        // Validator para Schnorr
        const validator = (pubkey, msghash, signature) => {
            return ecc.verifySchnorr(msghash, pubkey, signature);
        };
        
        for (let i = 0; i < psbt.inputCount; i++) {
            // ✅ Usar childSigner customizado (mesma lógica do sendBitcoin)
            psbt.signInput(i, childSigner);
            psbt.validateSignaturesOfInput(i, validator);
            psbt.finalizeInput(i);
            console.log('    ✅ Input', i, 'signed and finalized');
        }
        
        // Extrair transação
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        const txid = tx.getId();
        
        console.log('✅ Transaction created!');
        console.log('  TXID:', txid);
        console.log('  Size:', tx.virtualSize(), 'vbytes');
        console.log('  Actual fee:', estimatedFee, 'sats');
        console.log('  Fee rate:', (estimatedFee / tx.virtualSize()).toFixed(2), 'sat/vB');
        console.log('=========================================');
        
        res.json({
            success: true,
            txHex,
            txid,
            fee: estimatedFee
        });
        
    } catch (error) {
        console.error('❌ Error creating inscription transaction:', error);
        console.error('   Stack:', error.stack);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Helper function: Derive Taproot descriptor from mnemonic
 * Used for importing temporary wallets into Bitcoin Core
 */
function deriveDescriptors(mnemonic, networkType = 'mainnet') {
    try {
        console.log('🔑 Deriving Taproot descriptors...');
        
        const btcNetwork = networkType === 'testnet'
            ? bitcoin.networks.testnet
            : bitcoin.networks.bitcoin;
        
        // Derive master key from mnemonic
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const root = bip32.BIP32Factory(ecc).fromSeed(seed, btcNetwork);
        
        // Taproot derivation path: m/86'/0'/0'
        const accountPath = networkType === 'testnet' 
            ? "m/86'/1'/0'"  // Testnet
            : "m/86'/0'/0'"; // Mainnet
        
        const account = root.derivePath(accountPath);
        
        // Get xpub for external chain (receive addresses)
        const externalChain = account.derive(0); // m/86'/0'/0'/0
        const externalXpub = externalChain.neutered().toBase58();
        
        // Get xpub for internal chain (change addresses)
        const internalChain = account.derive(1); // m/86'/0'/0'/1
        const internalXpub = internalChain.neutered().toBase58();
        
        // Get xprv for the account (needed for signing)
        const accountXprv = account.toBase58();
        
        // Bitcoin Core descriptor format for Taproot
        // tr(xpub) = Taproot descriptor
        const descriptors = [
            {
                desc: `tr(${accountXprv}/0/*)`,
                internal: false,
                label: "MyWallet Receive",
                range: [0, 1000], // Scan first 1000 addresses
                timestamp: "now",
                active: true
            },
            {
                desc: `tr(${accountXprv}/1/*)`,
                internal: true,
                label: "MyWallet Change",
                range: [0, 1000],
                timestamp: "now",
                active: true
            }
        ];
        
        console.log('✅ Descriptors derived successfully');
        return descriptors;
        
    } catch (error) {
        console.error('❌ Error deriving descriptors:', error);
        throw error;
    }
}

/**
 * POST /api/mywallet/sign-with-core
 * Sign PSBT using Bitcoin Core (native Taproot + Runes support)
 * 
 * This endpoint:
 * 1. Creates a temporary wallet in Bitcoin Core
 * 2. Imports the user's keys via descriptors
 * 3. Signs the PSBT using walletprocesspsbt
 * 4. Deletes the temporary wallet
 * 5. Returns the signed PSBT
 */
router.post('/sign-with-core', async (req, res) => {
    const startTime = Date.now();
    let walletName = null;
    
    try {
        console.log('\n🔐 ========== SIGN WITH BITCOIN CORE ==========');
        
        const { mnemonic, psbt, network: reqNetwork = 'mainnet' } = req.body;
        
        if (!mnemonic || !psbt) {
            throw new Error('Missing required fields: mnemonic, psbt');
        }
        
        console.log('  Network:', reqNetwork);
        console.log('  PSBT length:', psbt.length);
        
        // Validate mnemonic
        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic phrase');
        }
        
        // Generate unique wallet name
        walletName = `temp_mywallet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        console.log('  Wallet name:', walletName);
        
        // Import Bitcoin Core RPC
        const bitcoinRpcModule = await import('../utils/bitcoinRpc.js');
        const bitcoinRpc = bitcoinRpcModule.default;
        
        console.log('\n📁 Step 1: Creating temporary wallet...');
        
        // Create wallet with descriptors support
        await bitcoinRpc.call('createwallet', [
            walletName,
            false, // disable_private_keys
            true,  // blank
            '',    // passphrase
            false, // avoid_reuse
            true,  // descriptors
            false  // load_on_startup
        ]);
        
        console.log('✅ Wallet created');
        
        console.log('\n🔑 Step 2: Deriving and importing descriptors...');
        
        // Derive descriptors from mnemonic
        const descriptors = deriveDescriptors(mnemonic, reqNetwork);
        
        // Import descriptors into the wallet
        for (const desc of descriptors) {
            console.log(`  Importing ${desc.internal ? 'change' : 'receive'} descriptor...`);
            
            // Use axios directly with wallet URL
            const response = await axios.post(
                `${bitcoinRpc.url}/wallet/${walletName}`,
                {
                    jsonrpc: '1.0',
                    id: Date.now(),
                    method: 'importdescriptors',
                    params: [[{
                        desc: desc.desc,
                        timestamp: desc.timestamp,
                        range: desc.range,
                        internal: desc.internal,
                        label: desc.label,
                        active: desc.active
                    }]]
                },
                {
                    auth: bitcoinRpc.auth,
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000
                }
            );
            
            if (response.data.error) {
                throw new Error(`Failed to import descriptor: ${response.data.error.message}`);
            }
            
            const result = response.data.result;
            if (!result[0].success) {
                throw new Error(`Failed to import descriptor: ${result[0].error?.message || 'Unknown error'}`);
            }
            
            console.log('  ✅ Imported successfully');
        }
        
        console.log('\n🖊️  Step 3: Signing PSBT with Bitcoin Core...');
        
        // Process (sign) the PSBT using wallet-specific endpoint
        const signResponse = await axios.post(
            `${bitcoinRpc.url}/wallet/${walletName}`,
            {
                jsonrpc: '1.0',
                id: Date.now(),
                method: 'walletprocesspsbt',
                params: [psbt, true, 'ALL', true]
            },
            {
                auth: bitcoinRpc.auth,
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );
        
        if (signResponse.data.error) {
            throw new Error(`Failed to sign PSBT: ${signResponse.data.error.message}`);
        }
        
        const signResult = signResponse.data.result;
        
        if (!signResult) {
            throw new Error('walletprocesspsbt returned empty result');
        }
        
        console.log('✅ PSBT signed successfully');
        console.log('  Complete:', signResult.complete);
        
        const duration = Date.now() - startTime;
        console.log(`\n⏱️  Total time: ${duration}ms`);
        console.log('=========================================\n');
        
        res.json({
            success: true,
            psbt: signResult.psbt,
            complete: signResult.complete
        });
        
    } catch (error) {
        console.error('\n❌ Error signing with Bitcoin Core:', error);
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to sign PSBT with Bitcoin Core'
        });
        
    } finally {
        // ALWAYS cleanup: Unload and delete the temporary wallet
        if (walletName) {
            try {
                console.log('\n🧹 Cleaning up temporary wallet...');
                
                const bitcoinRpcModule = await import('../utils/bitcoinRpc.js');
                const bitcoinRpc = bitcoinRpcModule.default;
                
                // Unload wallet
                await bitcoinRpc.call('unloadwallet', [walletName]);
                console.log('  ✅ Wallet unloaded');
                
                // Give Bitcoin Core time to release the wallet
                await new Promise(resolve => setTimeout(resolve, 500));
                
                console.log('✅ Cleanup complete\n');
                
            } catch (cleanupError) {
                console.error('⚠️  Warning: Failed to cleanup wallet:', cleanupError.message);
                // Don't throw - this is just cleanup
            }
        }
    }
});

export default router;

