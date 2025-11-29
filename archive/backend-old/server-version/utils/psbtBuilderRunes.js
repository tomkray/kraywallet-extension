import bitcoinRpc from './bitcoinRpc.js';
import runesDecoderOfficial from './runesDecoderOfficial.js';
import runesDecoder from './runesDecoder.js';
import utxoFilter from './utxoFilter.js';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

// Initialize ECC library
bitcoin.initEccLib(ecc);

/**
 * PSBT Builder para Runes
 * Segue o padrão oficial do repositório ordinals/ord
 * 
 * Referência: https://github.com/ordinals/ord
 */

class PSBTBuilderRunes {
    /**
     * Encode integers em LEB128 (Little Endian Base 128)
     * Formato usado pelo protocolo Runes
     * 
     * @param {Array<number>} integers - Array de inteiros para encodar
     * @returns {string} Hex string encoded
     */
    encodeLEB128(integers) {
        let hex = '';
        
        for (const num of integers) {
            let value = num;
            
            while (value >= 0x80) {
                // Pegar 7 bits inferiores e setar bit mais significativo
                hex += ((value & 0x7f) | 0x80).toString(16).padStart(2, '0');
                value >>= 7;
            }
            
            // Último byte (sem bit de continuação)
            hex += value.toString(16).padStart(2, '0');
        }
        
        return hex;
    }

    /**
     * Construir Runestone (OP_RETURN) - FORMATO OFICIAL COM TAGS
     * 
     * Formato oficial do protocolo Runes:
     * OP_RETURN (0x6a)
     * OP_13 (0x5d) - Protocol identifier
     * <tag_id> <tag_data> ... (LEB128 encoded)
     * 
     * Tags conhecidas:
     * - Tag 0: Edicts (lista de transferências)
     * - Tag 2: Default output
     * - Tag 4: Burn
     * 
     * Formato de um Edict (dentro da Tag 0):
     * [rune_id_delta, amount, output]
     * 
     * @param {Object} params - Parâmetros do runestone
     * @param {string} params.runeId - ID da rune (formato: blockHeight:txIndex)
     * @param {string|number} params.amount - Quantidade da rune a transferir
     * @param {number} params.outputIndex - Índice do output de destino
     * @returns {string} ScriptPubKey hex do OP_RETURN
     */
    buildRunestone({ runeId, amount, outputIndex }) {
        try {
            console.log('\n🔨 Building Runestone (OFFICIAL FORMAT - SINGLE EDICT)...');
            console.log('   Rune ID:', runeId);
            console.log('   Send Amount:', amount);
            console.log('   Send Output Index:', outputIndex);
            
            // Parse rune ID (formato: blockHeight:txIndex)
            const [blockHeight, txIndex] = runeId.split(':').map(Number);
            
            if (isNaN(blockHeight) || isNaN(txIndex)) {
                throw new Error(`Invalid rune ID format: ${runeId}`);
            }
            
            // FORMATO CORRETO segundo protocolo oficial Runes:
            // Tag 0 = Edicts (transferências)
            // Cada edict contém: [block_delta, tx_delta, amount, output]
            // 
            // Para o primeiro edict, os deltas são valores absolutos
            // Estrutura: [Tag 0, block_delta, tx_delta, amount, output]
            //
            // Referência: https://docs.ordinals.com/runes.html
            
            const values = [
                0,                // Tag 0 = Edicts (correto!)
                blockHeight,      // Block delta (absoluto para primeiro edict)
                txIndex,          // TX delta (absoluto para primeiro edict)
                parseInt(amount), // Quantidade a enviar
                outputIndex       // Output de destino
            ];
            
            console.log('   Values (Tag 0 Edicts + 1 edict):', values);
            
            // Encode em LEB128
            const encoded = this.encodeLEB128(values);
            
            console.log('   Encoded (LEB128):', encoded);
            
            // ✅ CRÍTICO: Calcular o tamanho do payload e incluir no OP_RETURN
            // Formato: OP_RETURN (6a) + OP_13 (5d) + TAMANHO + PAYLOAD
            const payloadBytes = Buffer.from(encoded, 'hex');
            const payloadSize = payloadBytes.length;
            const sizeHex = payloadSize.toString(16).padStart(2, '0');
            
            console.log('   Payload size:', payloadSize, 'bytes');
            console.log('   Size hex:', sizeHex);
            
            // Construir scriptPubKey completo com tamanho
            const scriptPubKey = '6a5d' + sizeHex + encoded;
            
            console.log('   ✅ Runestone built (SINGLE EDICT):', scriptPubKey);
            
            return scriptPubKey;
            
        } catch (error) {
            console.error('❌ Error building Runestone:', error);
            throw error;
        }
    }

    /**
     * Construir Runestone com 2 edicts (change + send)
     * Usado quando sobram runes após o envio
     */
    buildRunestoneWith2Edicts({ runeId, changeAmount, changeOutput, sendAmount, sendOutput }) {
        try {
            console.log('\n🔨 Building Runestone with 2 EDICTS (change + send)...');
            
            const [blockHeight, txIndex] = runeId.split(':').map(Number);
            
            if (isNaN(blockHeight) || isNaN(txIndex)) {
                throw new Error(`Invalid rune ID format: ${runeId}`);
            }
            
            // Formato correto com 2 edicts (Tag 0):
            // Tag 0 = Edicts
            // Edict 1: [blockHeight, txIndex, changeAmount, changeOutput]
            // Edict 2: [0, 0, sendAmount, sendOutput]  (delta 0,0 = mesma rune)
            
            const values = [
                0,                           // Tag 0 = Edicts (correto!)
                blockHeight,                 // Edict 1: Block height (absoluto)
                txIndex,                     // Edict 1: TX index (absoluto)
                parseInt(changeAmount),      // Edict 1: Change amount
                changeOutput,                // Edict 1: Change output
                0,                           // Edict 2: Block delta (0 = mesma rune)
                0,                           // Edict 2: TX delta (0 = mesma rune)
                parseInt(sendAmount),        // Edict 2: Send amount
                sendOutput                   // Edict 2: Send output
            ];
            
            console.log('   Values:', values);
            
            const encoded = this.encodeLEB128(values);
            const scriptPubKey = '6a5d' + encoded;
            
            console.log('   ✅ Runestone built (2 EDICTS):', scriptPubKey);
            
            return scriptPubKey;
            
        } catch (error) {
            console.error('❌ Error building Runestone with 2 edicts:', error);
            throw error;
        }
    }

    /**
     * ✨ Construir Runestone com Tag 2 (Default Output)
     * Simplifica o envio com change - runes não alocadas vão para default output
     * 
     * @param {Object} params
     * @param {string} params.runeId - ID da rune
     * @param {number} params.amount - Quantidade a enviar
     * @param {number} params.outputIndex - Output do destinatário
     * @param {number} params.defaultOutput - Output para change/runes restantes
     * @returns {string} ScriptPubKey hex do OP_RETURN
     */
    buildRunestoneWithDefaultOutput({ runeId, amount, outputIndex, defaultOutput }) {
        try {
            console.log('\n🔨 Building Runestone with DEFAULT OUTPUT (Tag 2)...');
            console.log('   Rune ID:', runeId);
            console.log('   Amount:', amount);
            console.log('   Output Index:', outputIndex);
            console.log('   Default Output:', defaultOutput);
            
            const [blockHeight, txIndex] = runeId.split(':').map(Number);
            
            if (isNaN(blockHeight) || isNaN(txIndex)) {
                throw new Error(`Invalid rune ID format: ${runeId}`);
            }
            
            // Formato: [Tag 0, block, tx, amount, output, Tag 2, default_output_index]
            const values = [
                0,                     // ✅ Tag 0 = Body (edicts) - PROTOCOLO OFICIAL
                blockHeight,           // Block height
                txIndex,               // TX index
                parseInt(amount),      // Amount
                outputIndex,           // Output destino
                2,                     // Tag 2 = Pointer (Default Output)
                defaultOutput          // Output para runes restantes
            ];
            
            console.log('   Values (with Tag 2):', values);
            
            const encoded = this.encodeLEB128(values);
            const scriptPubKey = '6a5d' + encoded;
            
            console.log('   ✅ Runestone with Default Output built:', scriptPubKey);
            
            return scriptPubKey;
            
        } catch (error) {
            console.error('❌ Error building Runestone with Default Output:', error);
            throw error;
        }
    }

    /**
     * 🔥 Construir Runestone para BURN (queimar runes intencionalmente)
     * Queima/destrói runes permanentemente enviando para output inexistente
     * 
     * Método 1: Enviar para output index muito alto (ex: 99)
     * Método 2: Usar Cenotaph explícito
     * 
     * @param {Object} params
     * @param {string} params.runeId - ID da rune a queimar
     * @param {number} params.amount - Quantidade a queimar
     * @returns {string} ScriptPubKey hex do OP_RETURN
     */
    buildRunestoneBurn({ runeId, amount }) {
        try {
            console.log('\n🔥 Building Runestone for BURN...');
            console.log('   Rune ID:', runeId);
            console.log('   Amount to burn:', amount);
            
            const [blockHeight, txIndex] = runeId.split(':').map(Number);
            
            if (isNaN(blockHeight) || isNaN(txIndex)) {
                throw new Error(`Invalid rune ID format: ${runeId}`);
            }
            
            // MÉTODO: Enviar para output inexistente (99)
            // Quando o output não existe, as runes são queimadas
            // Formato: [Tag 0 (Edicts), block, tx, amount, output_inexistente]
            const values = [
                0,                     // Tag 0 = Edicts
                blockHeight,           // Block height
                txIndex,               // TX index
                parseInt(amount),      // Amount to burn
                99                     // Output 99 (inexistente = burn)
            ];
            
            console.log('   Values (burn via invalid output):', values);
            
            const encoded = this.encodeLEB128(values);
            
            // Adicionar tamanho do payload
            const payloadBytes = Buffer.from(encoded, 'hex');
            const payloadSize = payloadBytes.length;
            const sizeHex = payloadSize.toString(16).padStart(2, '0');
            
            const scriptPubKey = '6a5d' + sizeHex + encoded;
            
            console.log('   ✅ Runestone for BURN built:', scriptPubKey);
            console.log('   ⚠️  WARNING: This will PERMANENTLY destroy', amount, 'runes!');
            
            return scriptPubKey;
            
        } catch (error) {
            console.error('❌ Error building Runestone for Burn:', error);
            throw error;
        }
    }

    /**
     * 🎨 Construir Runestone para ETCHING (criar nova Rune)
     * Tag 6 (Mint) + outras tags de etching
     * 
     * @param {Object} params
     * @param {string} params.name - Nome da rune (ex: "MY•AWESOME•RUNE")
     * @param {string} params.symbol - Símbolo/emoji (ex: "🚀")
     * @param {number} params.decimals - Casas decimais (0-38)
     * @param {number} params.supply - Supply inicial (pode ser 0 para mintável)
     * @param {number} params.premine - Quantidade pré-minerada
     * @param {boolean} params.turbo - Permite mint rápido
     * @returns {string} ScriptPubKey hex do OP_RETURN
     */
    buildRunestoneEtching({ name, symbol, decimals = 0, supply = 0, premine = 0, turbo = false }) {
        try {
            console.log('\n🎨 Building Runestone for ETCHING (Create New Rune)...');
            console.log('   Name:', name);
            console.log('   Symbol:', symbol);
            console.log('   Decimals:', decimals);
            console.log('   Supply:', supply);
            console.log('   Premine:', premine);
            console.log('   Turbo:', turbo);
            
            // Converter nome para formato oficial (remover bullets e converter)
            const cleanName = name.replace(/•/g, '').toUpperCase();
            
            // Encode do nome em inteiro (A=0, Z=25)
            let nameValue = 0n;
            for (let i = 0; i < cleanName.length; i++) {
                const charCode = cleanName.charCodeAt(i) - 65; // A=0
                if (charCode >= 0 && charCode < 26) {
                    nameValue = nameValue * 26n + BigInt(charCode);
                }
            }
            
            console.log('   Name encoded:', nameValue.toString());
            
            // Tags para etching (formato oficial)
            const values = [
                // Tag 20: Flags (turbo, etc)
                20, turbo ? 1 : 0,
                // Tag 4: Divisibility (decimals)
                8, decimals,
                // Tag 10: Premine
                12, premine,
                // Tag 14: Rune (name)
                16, Number(nameValue),
                // Tag 18: Supply
                22, supply,
                // Tag 22: Symbol
                26, symbol.codePointAt(0) || 0,
                // Delimiter
                0
            ];
            
            console.log('   Etching values:', values);
            
            const encoded = this.encodeLEB128(values);
            const scriptPubKey = '6a5d' + encoded;
            
            console.log('   ✅ Runestone for ETCHING built:', scriptPubKey);
            
            return scriptPubKey;
            
        } catch (error) {
            console.error('❌ Error building Runestone for Etching:', error);
            throw error;
        }
    }

    /**
     * 📍 Construir Runestone com Tag 8 (Pointer)
     * Especifica qual output receberá runes não alocadas
     * 
     * @param {Object} params
     * @param {string} params.runeId - ID da rune
     * @param {number} params.amount - Quantidade a enviar
     * @param {number} params.outputIndex - Output do destinatário
     * @param {number} params.pointer - Output para runes não especificadas
     * @returns {string} ScriptPubKey hex do OP_RETURN
     */
    buildRunestoneWithPointer({ runeId, amount, outputIndex, pointer }) {
        try {
            console.log('\n📍 Building Runestone with POINTER (Tag 8)...');
            console.log('   Rune ID:', runeId);
            console.log('   Amount:', amount);
            console.log('   Output Index:', outputIndex);
            console.log('   Pointer:', pointer);
            
            const [blockHeight, txIndex] = runeId.split(':').map(Number);
            
            if (isNaN(blockHeight) || isNaN(txIndex)) {
                throw new Error(`Invalid rune ID format: ${runeId}`);
            }
            
            // Formato: [Tag Body, delimiter, block, tx, amount, output, Tag Pointer, pointer_index]
            const values = [
                10,                    // Tag: Body (edicts)
                0,                     // Delimiter
                blockHeight,           // Block height
                txIndex,               // TX index
                parseInt(amount),      // Amount
                outputIndex,           // Output destino
                8,                     // Tag: Pointer
                pointer                // Output para runes não alocadas
            ];
            
            console.log('   Values (with Tag 8):', values);
            
            const encoded = this.encodeLEB128(values);
            const scriptPubKey = '6a5d' + encoded;
            
            console.log('   ✅ Runestone with Pointer built:', scriptPubKey);
            
            return scriptPubKey;
            
        } catch (error) {
            console.error('❌ Error building Runestone with Pointer:', error);
            throw error;
        }
    }

    /**
     * Construir Runestone com MÚLTIPLOS edicts
     * Usado quando há change de runes
     * 
     * FORMATO CORRETO SEGUNDO ORD:
     * Cada edict = 4 valores: [blockHeight, txIndex, amount, output]
     * Para mesma rune (múltiplos edicts), REPETIR blockHeight e txIndex!
     * 
     * @param {Array} edicts - Array de edicts [{runeId, amount, outputIndex}]
     * @returns {string} ScriptPubKey hex
     */
    buildRunestoneMultiEdict(edicts) {
        try {
            console.log('\n🔨 Building Runestone with multiple edicts...');
            console.log('   Number of edicts:', edicts.length);
            
            // Construir array com TODOS os edicts
            // IMPORTANTE: Cada edict precisa de blockHeight + txIndex + amount + output
            const allValues = [];
            
            edicts.forEach((edict, idx) => {
                const [blockHeight, txIndex] = edict.runeId.split(':').map(Number);
                
                if (isNaN(blockHeight) || isNaN(txIndex)) {
                    throw new Error(`Invalid rune ID format: ${edict.runeId}`);
                }
                
                console.log(`   Edict ${idx + 1}:`);
                console.log(`      Rune ID: ${blockHeight}:${txIndex}`);
                console.log(`      Amount: ${edict.amount}`);
                console.log(`      Output: ${edict.outputIndex}`);
                
                // Adicionar os 4 valores do edict
                allValues.push(blockHeight);
                allValues.push(txIndex);
                allValues.push(parseInt(edict.amount));
                allValues.push(edict.outputIndex);
            });
            
            console.log('   All values:', allValues);
            
            // Encode em LEB128
            const encoded = this.encodeLEB128(allValues);
            
            console.log('   Encoded (LEB128):', encoded);
            
            // Construir scriptPubKey completo
            // OP_RETURN + OP_13 + data
            const scriptPubKey = '6a5d' + encoded;
            
            console.log('   ✅ Runestone built:', scriptPubKey);
            
            return scriptPubKey;
            
        } catch (error) {
            console.error('❌ Error building Runestone:', error);
            throw error;
        }
    }

    /**
     * Selecionar UTXOs suficientes para transferir a quantidade desejada
     * 
     * @param {Array} utxos - Array de UTXOs disponíveis
     * @param {string|number} targetAmount - Quantidade alvo
     * @returns {Object} {selected: Array, totalAmount: BigInt, change: BigInt}
     */
    selectRuneUtxos(utxos, targetAmount, divisibility = 0) {
        const target = BigInt(targetAmount);
        let selected = [];
        let totalAmount = 0n;
        
        // ✅ Converter amounts de strings (com decimais) para raw BigInt
        const convertToRaw = (amount) => {
            // Se for string com decimais (ex: "999.995"), converter para raw
            const amountNum = parseFloat(amount);
            const rawAmount = amountNum * Math.pow(10, divisibility);
            return BigInt(Math.floor(rawAmount));
        };
        
        // Ordenar UTXOs por amount (menores primeiro para minimizar change)
        const sortedUtxos = [...utxos].sort((a, b) => {
            const amountA = convertToRaw(a.amount || 0);
            const amountB = convertToRaw(b.amount || 0);
            return amountA < amountB ? -1 : 1;
        });
        
        for (const utxo of sortedUtxos) {
            selected.push(utxo);
            totalAmount += convertToRaw(utxo.amount || 0);
            
            if (totalAmount >= target) {
                break;
            }
        }
        
        if (totalAmount < target) {
            throw new Error(`Insufficient rune balance. Have: ${totalAmount}, Need: ${target}`);
        }
        
        const change = totalAmount - target;
        
        console.log('📊 UTXO Selection:');
        console.log('   Selected:', selected.length, 'UTXOs');
        console.log('   Total Amount:', totalAmount.toString());
        console.log('   Target:', target.toString());
        console.log('   Change:', change.toString());
        
        return {
            selected,
            totalAmount,
            change
        };
    }

    /**
     * Construir PSBT completo para envio de runes
     * 
     * @param {Object} params
     * @param {string} params.fromAddress - Endereço de origem
     * @param {string} params.toAddress - Endereço de destino
     * @param {string} params.runeName - Nome da rune
     * @param {string|number} params.amount - Quantidade a enviar
     * @param {number} params.feeRate - Taxa em sat/vB
     * @returns {Object} PSBT construído
     */
    async buildRuneSendPSBT({ fromAddress, toAddress, runeName, amount, feeRate = 10 }) {
        try {
            console.log('\n🚀 ========== BUILD RUNE SEND PSBT ==========');
            console.log('From:', fromAddress);
            console.log('To:', toAddress);
            console.log('Rune:', runeName);
            console.log('Amount:', amount);
            console.log('Fee Rate:', feeRate, 'sat/vB');
            
            // Validar endereços
            const network = bitcoin.networks.bitcoin;
            try {
                bitcoin.address.toOutputScript(fromAddress, network);
                console.log('   ✅ From address valid');
            } catch (e) {
                throw new Error(`Invalid from address: ${fromAddress}`);
            }
            
            try {
                bitcoin.address.toOutputScript(toAddress, network);
                console.log('   ✅ To address valid');
            } catch (e) {
                throw new Error(`Invalid to address: ${toAddress}`);
            }
            
            // 1. Obter Rune ID E DIVISIBILITY do ORD server
            console.log('\n📡 Step 1: Getting Rune details from ORD server...');
            const runeId = await runesDecoderOfficial.getRuneIdByName(runeName);
            
            if (!runeId) {
                throw new Error(`Could not find Rune ID for "${runeName}"`);
            }
            
            console.log('   ✅ Rune ID:', runeId);
            
            // ✅ CRÍTICO: Buscar DIVISIBILITY para converter amount corretamente
            const runeDetails = await runesDecoder.getRuneDetails(runeName);
            const divisibility = runeDetails.divisibility || 0;
            
            console.log('   ✅ Divisibility:', divisibility, 'decimals');
            
            // ✅ CONVERTER AMOUNT: usuário digita em unidades "humanas" (ex: 500 DOG)
            // Mas precisamos enviar em unidades RAW (ex: 500 × 10^5 = 50000000)
            let rawAmount = amount * Math.pow(10, divisibility);
            
            console.log('   📊 Amount conversion:');
            console.log('      User input (display):', amount);
            console.log('      Divisibility:', divisibility);
            console.log('      Raw amount (calculated):', rawAmount);
            
            // ✅ CRÍTICO: Validar que rawAmount é um INTEIRO
            // Bitcoin/Runes protocol requer inteiros no edict
            if (!Number.isInteger(rawAmount)) {
                console.log('      ⚠️  Raw amount is not integer, rounding down...');
                rawAmount = Math.floor(rawAmount);
                console.log('      Raw amount (rounded):', rawAmount);
            }
            
            console.log('      ✅ Raw amount (final):', rawAmount);
            
            if (rawAmount <= 0) {
                throw new Error(`Amount too small: ${amount} results in 0 atomic units`);
            }
            
            if (rawAmount > Number.MAX_SAFE_INTEGER) {
                throw new Error(`Amount too large: ${rawAmount} exceeds MAX_SAFE_INTEGER`);
            }
            
            // 2. Buscar runes do endereço (usando decoder simples que já funciona)
            console.log('\n📡 Step 2: Fetching runes from address...');
            const runes = await runesDecoder.getRunesForAddress(fromAddress);
            
            console.log(`   Found ${runes.length} runes`);
            
            // 3. Encontrar a rune específica
            const targetRune = runes.find(r => r.name === runeName);
            
            if (!targetRune) {
                throw new Error(`Rune "${runeName}" not found in address. Available: ${runes.map(r => r.name).join(', ')}`);
            }
            
            console.log('   ✅ Target rune found:', targetRune.name);
            console.log('   Available:', targetRune.amount);
            
            // Adicionar runeId
            targetRune.runeId = runeId;
            
            // 3.5. Buscar UTXOs que contêm essa rune específica (via ORD server)
            console.log('\n📡 Step 2.5: Fetching UTXOs with this rune via ORD server...');
            const runeUtxos = await runesDecoder.getRuneUtxos(fromAddress, runeName);
            
            console.log(`   UTXOs with "${runeName}": ${runeUtxos.length}`);
            
            if (!runeUtxos || runeUtxos.length === 0) {
                throw new Error(`No UTXOs found containing rune "${runeName}"`);
            }
            
            // ✅ CRÍTICO: Validar se os UTXOs ainda existem E enriquecer com dados da blockchain
            console.log('\n🔍 Step 2.6: Validating and enriching UTXOs from blockchain...');
            const axios = (await import('axios')).default;
            
            // Buscar TODOS os UTXOs do endereço DIRETO DA BLOCKCHAIN
            const response = await axios.get(
                `https://mempool.space/api/address/${fromAddress}/utxo`,
                { timeout: 10000 }
            );
            
            const blockchainUtxos = response.data;
            console.log(`   Found ${blockchainUtxos.length} UTXOs on blockchain`);
            
            // Validar e enriquecer cada UTXO de rune com dados da blockchain
            const validRuneUtxos = [];
            for (const runeUtxo of runeUtxos) {
                // Buscar UTXO correspondente na blockchain
                const blockchainUtxo = blockchainUtxos.find(u => 
                    u.txid === runeUtxo.txid && u.vout === runeUtxo.vout
                );
                
                if (blockchainUtxo && blockchainUtxo.status && blockchainUtxo.status.confirmed) {
                    console.log(`   ✅ UTXO ${runeUtxo.txid.substring(0, 16)}...:${runeUtxo.vout} is CONFIRMED and unspent`);
                    console.log(`      Value: ${blockchainUtxo.value} sats`);
                    
                    // Enriquecer com dados da blockchain
                    validRuneUtxos.push({
                        ...runeUtxo,
                        value: blockchainUtxo.value, // ✅ CRÍTICO: usar value da blockchain
                        confirmed: true
                    });
                } else if (blockchainUtxo && !blockchainUtxo.status.confirmed) {
                    console.log(`   ⚠️  UTXO ${runeUtxo.txid.substring(0, 16)}...:${runeUtxo.vout} is UNCONFIRMED - skipping for safety`);
                } else {
                    console.log(`   ❌ UTXO ${runeUtxo.txid.substring(0, 16)}...:${runeUtxo.vout} is SPENT or doesn't exist`);
                }
            }
            
            console.log(`   Valid & Confirmed UTXOs: ${validRuneUtxos.length}/${runeUtxos.length}`);
            
            if (validRuneUtxos.length === 0) {
                throw new Error(
                    `No valid (confirmed & unspent) UTXOs found for rune "${runeName}".\n` +
                    `This can happen if:\n` +
                    `  1. The rune was recently transferred and is still unconfirmed\n` +
                    `  2. The ord server data is outdated\n` +
                    `  3. All UTXOs have been spent\n\n` +
                    `💡 Try again in a few minutes after the transaction confirms.`
                );
            }
            
            // Adicionar UTXOs enriquecidos ao targetRune
            targetRune.utxos = validRuneUtxos;
            
            // 3. Selecionar UTXOs suficientes
            console.log('\n📊 Step 2: Selecting UTXOs...');
            const { selected, totalAmount, change } = this.selectRuneUtxos(
                targetRune.utxos,
                rawAmount,  // ✅ USAR rawAmount (já multiplicado por 10^divisibility)
                divisibility  // ✅ Passar divisibility para converter UTXOs
            );
            
            // 4. Construir Runestone
            console.log('\n🔨 Step 3: Building Runestone...');
            
            // ✅ SEMPRE usar 1 EDICT (apontando para o destinatário)!
            // As runes não especificadas no edict voltam AUTOMATICAMENTE para o primeiro output compatível (change)
            // Isso é o comportamento padrão do protocolo Runes!
            const hasRuneChange = change > 0n;
            
            console.log('   Sending (display):', amount.toString(), 'units');
            console.log('   Sending (raw):', rawAmount.toString(), 'atomic units to output 2 (recipient)');
            if (hasRuneChange) {
                console.log('   Change:', change.toString(), 'units (will go to output 1 automatically)');
            }
            console.log('   ✅ Creating 1 edict: send to output 2');
            
            const runestone = this.buildRunestone({
                runeId: targetRune.runeId,
                amount: rawAmount,  // ✅ USAR RAW AMOUNT (multiplicado por 10^divisibility)
                outputIndex: 2  // SEMPRE output 2 (recipient)!
            });
            
            // 5. Construir outputs
            const outputs = [];
            
            // Output 0: OP_RETURN (Runestone)
            console.log('\n📤 Adding OP_RETURN output (Runestone)');
            console.log('   ScriptPubKey:', runestone);
            outputs.push({
                scriptPubKey: runestone,
                value: 0
            });
            
            // ✅ SEMPRE CRIAR 4 OUTPUTS (mesmo sem change)!
            // Output 1: Rune CHANGE (volta para origem) - SEMPRE!
            console.log('\n📤 Adding rune CHANGE output (output 1)');
            console.log('   Address:', fromAddress);
            console.log('   Value: 546 sats (dust limit)');
            console.log('   Rune amount:', change.toString(), 'units');
            outputs.push({
                address: fromAddress,
                value: 546
            });
            
            // Output 2: Rune para destino - SEMPRE!
            console.log('\n📤 Adding rune RECIPIENT output (output 2)');
            console.log('   Address:', toAddress);
            console.log('   Value: 546 sats (dust limit)');
            console.log('   Rune amount:', amount.toString(), 'units');
            outputs.push({
                address: toAddress,
                value: 546
            });
            
            // Próximo output: BTC change (será adicionado depois)
            
            // 6. Buscar UTXOs de BTC para fees (usando mempool.space API)
            console.log('\n💰 Step 4: Fetching BTC UTXOs for fees...');
            
            let btcUtxos = [];
            try {
                // Tentar usar Bitcoin Core primeiro
                btcUtxos = await bitcoinRpc.listUnspent(1, 9999999, [fromAddress]);
            } catch (btcCoreError) {
                console.log('   ⚠️  Bitcoin Core not available, using mempool.space API...');
                
                // Fallback: usar mempool.space API
                const axios = (await import('axios')).default;
                const mempoolResponse = await axios.get(
                    `https://mempool.space/api/address/${fromAddress}/utxo`,
                    { timeout: 10000 }
                );
                
                btcUtxos = mempoolResponse.data.map(utxo => ({
                    txid: utxo.txid,
                    vout: utxo.vout,
                    amount: utxo.value / 100000000, // Converter de sats para BTC
                    confirmations: utxo.status.confirmed ? 1 : 0
                }));
                
                console.log('   ✅ Fetched UTXOs from mempool.space');
            }
            
            // 6.5. CRÍTICO: Filtrar UTXOs que NÃO contêm runes NEM inscriptions
            console.log('\n🛡️  Step 4.5: Protecting inscriptions and runes...');
            
            // Remover UTXOs que já estão sendo usados para runes
            const runeUtxoIds = selected.map(u => `${u.txid}:${u.vout}`);
            const btcOnlyUtxos = btcUtxos.filter(u => 
                !runeUtxoIds.includes(`${u.txid}:${u.vout}`)
            );
            
            console.log('   UTXOs not used for runes:', btcOnlyUtxos.length);
            
            // 🛡️ PROTEÇÃO ADICIONAL: Filtrar UTXOs puros (sem Inscriptions nem Runes extras)
            console.log('   🛡️ Applying UTXO filter to protect inscriptions...');
            const pureUtxos = await utxoFilter.filterPureUTXOs(btcOnlyUtxos);
            console.log('   Pure BTC UTXOs (safe to use):', pureUtxos.length);
            
            if (pureUtxos.length === 0) {
                throw new Error('No pure UTXOs available for fees! All UTXOs contain inscriptions or runes. Please send some pure BTC to this address.');
            }
            
            console.log('   ✅ Pure UTXOs available for fees:', pureUtxos.length);
            
            // 7. Selecionar MÚLTIPLOS UTXOs PUROS de BTC (suficientes para fees)
            console.log('\n💰 Step 6.5: Selecting MULTIPLE pure BTC UTXOs for fees...');
            
            // Calcular quanto precisamos
            const outputsCost = outputs.reduce((sum, out) => sum + (out.value || 0), 0);
            
            // Estimar fee inicial (com número mínimo de inputs)
            const minInputs = selected.length + 1; // Rune inputs + pelo menos 1 BTC input
            const initialFeeEstimate = Math.ceil((minInputs * 148 + outputs.length * 34 + 10) * feeRate);
            const initialNeeded = outputsCost + initialFeeEstimate;
            
            console.log('   Outputs cost:', outputsCost, 'sats');
            console.log('   Initial fee estimate:', initialFeeEstimate, 'sats');
            console.log('   Initial total needed:', initialNeeded, 'sats');
            
            let totalBtc = 0;
            const selectedBtcUtxos = [];
            
            for (const utxo of pureUtxos) {
                selectedBtcUtxos.push(utxo);
                const utxoValue = Math.floor((utxo.amount || 0) * 100000000);
                totalBtc += utxoValue;
                console.log(`   Selected BTC UTXO: ${utxo.txid}:${utxo.vout} = ${utxoValue} sats`);
                
                // Recalcular fee com número atual de inputs
                const currentInputs = selected.length + selectedBtcUtxos.length;
                const currentFee = Math.ceil((currentInputs * 148 + outputs.length * 34 + 10) * feeRate);
                const currentNeeded = outputsCost + currentFee;
                
                // Continuar até ter suficiente (+ margem para change se possível)
                if (totalBtc >= currentNeeded + 546) {
                    console.log(`   ✅ Sufficient! Total: ${totalBtc} sats, Needed: ${currentNeeded} sats`);
                    break;
                }
            }
            
            console.log('   Total BTC selected:', totalBtc, 'sats');
            console.log('   From', selectedBtcUtxos.length, 'UTXO(s)');
            
            // 8. Construir inputs com TODOS os UTXOs selecionados
            const inputs = [
                // Inputs com runes (vêm primeiro)
                ...selected.map(utxo => ({
                    txid: utxo.txid,
                    vout: utxo.vout
                })),
                // TODOS os inputs de BTC puro selecionados
                ...selectedBtcUtxos.map(utxo => ({
                    txid: utxo.txid,
                    vout: utxo.vout
                }))
            ];
            
            console.log('\n📊 Total inputs:', inputs.length);
            console.log('   Rune inputs:', selected.length);
            console.log('   BTC inputs:', selectedBtcUtxos.length);
            
            // 9. Recalcular fee com número correto de inputs
            const actualSize = inputs.length * 148 + outputs.length * 34 + 10;
            const actualFee = Math.ceil(actualSize * feeRate);
            
            console.log('\n💸 Fee Calculation (Final):');
            console.log('   Actual Size:', actualSize, 'vB');
            console.log('   Fee Rate:', feeRate, 'sat/vB');
            console.log('   Actual Fee:', actualFee, 'sats');
            
            // 10. Calcular BTC change com TODOS os inputs
            const btcChange = totalBtc - actualFee - outputsCost;
            
            console.log('\n💰 BTC Change Calculation:');
            console.log('   Total BTC Input:', totalBtc, 'sats');
            console.log('   Actual Fee:', actualFee, 'sats');
            console.log('   Outputs Cost:', outputsCost, 'sats');
            console.log('   BTC Change:', btcChange, 'sats');
            
            // Verificar se temos suficiente
            if (btcChange < 0) {
                const needed = actualFee + outputsCost;
                const shortage = needed - totalBtc;
                throw new Error(
                    `Insufficient BTC for fees.\n` +
                    `Need: ${needed} sats (${outputsCost} for outputs + ${actualFee} fee)\n` +
                    `Have: ${totalBtc} sats\n` +
                    `Short: ${shortage} sats\n\n` +
                    `💡 Solution: Send at least ${Math.ceil(shortage + 1000)} sats of pure Bitcoin to your address.\n` +
                    `⚠️  Note: ${pureUtxos.length} pure UTXO(s) found with total of ${totalBtc} sats.`
                );
            }
            
            // Adicionar change output COMBINADO (rune change + BTC change)
            if (hasRuneChange || btcChange > 546) {
                const changeValue = hasRuneChange ? Math.max(546, btcChange) : btcChange;
                console.log('\n   ✅ Adding COMBINED change output:');
                console.log('      Address:', fromAddress);
                console.log('      Value:', changeValue, 'sats');
                if (hasRuneChange) {
                    console.log('      Contains: Rune change (' + change.toString() + ' units) + BTC');
                }
                outputs.push({
                    address: fromAddress,
                    value: changeValue
                });
            } else {
                console.log('   ⚠️  Change too small (dust), will be added to fee');
                
                // 🛡️ VALIDAÇÃO CRÍTICA: Verificar se adicionar change ao fee não causa fee negativo
                const dustAddedToFee = btcChange;
                const newTotalOutputs = outputs.reduce((sum, out) => sum + (out.value || 0), 0);
                const wouldBeFee = totalBtc - newTotalOutputs; // Fee incluindo dust
                
                if (wouldBeFee < 0) {
                    console.error('   ❌ CRITICAL: Adding dust to fee would cause NEGATIVE fee!');
                    console.error(`      Total BTC: ${totalBtc} sats`);
                    console.error(`      Total Outputs: ${newTotalOutputs} sats`);
                    console.error(`      Would-be Fee: ${wouldBeFee} sats`);
                    throw new Error(
                        `Transaction would have negative fee after discarding dust change (${dustAddedToFee} sats).\n` +
                        `This should not happen. Please report this bug.`
                    );
                }
                
                console.log(`      Dust (${dustAddedToFee} sats) will increase fee from ${actualFee} to ${wouldBeFee} sats`);
            }
            
            // 10. Construir PSBT real usando bitcoinjs-lib
            console.log('\n🔨 Step 5: Building actual PSBT...');
            
            // network já foi declarado no início da função
            const psbt = new bitcoin.Psbt({ network });
            
            // Adicionar inputs
            console.log('   Adding inputs...');
            console.log(`   Total inputs to add: ${inputs.length}`);
            for (let idx = 0; idx < inputs.length; idx++) {
                const input = inputs[idx];
                console.log(`   📍 Adding input ${idx}: ${input.txid.substring(0, 16)}...:${input.vout}`);
                // Buscar transação completa (com fallback para mempool.space)
                let tx;
                try {
                    // Tentar Bitcoin Core primeiro
                    const rawTx = await bitcoinRpc.getRawTransaction(input.txid, true);
                    tx = bitcoin.Transaction.fromHex(rawTx.hex);
                } catch (error) {
                    console.log(`   ⚠️  Bitcoin Core unavailable, fetching from mempool.space...`);
                    
                    // Fallback: buscar de mempool.space
                    const axios = (await import('axios')).default;
                    const txResponse = await axios.get(
                        `https://mempool.space/api/tx/${input.txid}/hex`,
                        { timeout: 10000 }
                    );
                    
                    tx = bitcoin.Transaction.fromHex(txResponse.data);
                    console.log(`   ✅ Transaction fetched from mempool.space`);
                }
                
                const vout = tx.outs[input.vout];
                
                // ✅ CORREÇÃO CRÍTICA: bitcoinjs-lib espera hash em LITTLE-ENDIAN (reversed)
                // TXIDs são exibidos em big-endian, mas internamente armazenados em little-endian
                const txidBuffer = Buffer.from(input.txid, 'hex').reverse();
                
                // Detectar tipo de endereço pelo tamanho do script
                let addressType = 'Unknown';
                if (vout.script.length === 22 && vout.script[0] === 0x00 && vout.script[1] === 0x14) {
                    addressType = 'P2WPKH (SegWit v0)';
                } else if (vout.script.length === 34 && vout.script[0] === 0x51 && vout.script[1] === 0x20) {
                    addressType = 'P2TR (Taproot/SegWit v1)';
                } else if (vout.script.length === 25 && vout.script[0] === 0x76 && vout.script[1] === 0xa9) {
                    addressType = 'P2PKH (Legacy)';
                } else if (vout.script.length === 23 && vout.script[0] === 0xa9 && vout.script[1] === 0x14) {
                    addressType = 'P2SH (Script Hash)';
                }
                
                console.log(`      TXID (display): ${input.txid.substring(0, 16)}...`);
                console.log(`      Hash (LE): ${txidBuffer.toString('hex').substring(0, 16)}...`);
                console.log(`      Value: ${vout.value} sats`);
                console.log(`      Script length: ${vout.script.length} bytes`);
                console.log(`      Address type: ${addressType}`);
                
                const inputData = {
                    hash: txidBuffer,  // Buffer em little-endian (reversed)
                    index: input.vout,
                    witnessUtxo: {
                        script: vout.script,  // Script EXATO do UTXO
                        value: vout.value
                    }
                };
                
                // ⚠️ NÃO adicionar tapInternalKey aqui!
                // O tapInternalKey deve ser derivado da seed/mnemonic no momento da assinatura
                // porque precisamos da INTERNAL KEY (non-tweaked), não da OUTPUT KEY (tweaked)
                // que está no script.
                // O endpoint /api/kraywallet/sign irá adicionar o tapInternalKey correto.
                
                psbt.addInput(inputData);
            }
            
            console.log(`   ✅ Added ${inputs.length} inputs`);
            
            // Adicionar outputs
            console.log('   Adding outputs...');
            for (let i = 0; i < outputs.length; i++) {
                const output = outputs[i];
                console.log(`   Output ${i}:`, output.address || 'OP_RETURN', 'value:', output.value);
                
                if (output.scriptPubKey) {
                    // OP_RETURN (Runestone)
                    const script = Buffer.from(output.scriptPubKey, 'hex');
                    console.log(`     Script length: ${script.length} bytes`);
                    console.log(`     Script hex: ${output.scriptPubKey}`);
                    
                    psbt.addOutput({
                        script: script,
                        value: output.value
                    });
                } else {
                    // Output normal (address)
                    // Validar endereço primeiro
                    try {
                        bitcoin.address.toOutputScript(output.address, network);
                    } catch (e) {
                        throw new Error(`Invalid output address: ${output.address} - ${e.message}`);
                    }
                    
                    psbt.addOutput({
                        address: output.address,
                        value: Math.floor(output.value) // Garantir que é inteiro
                    });
                }
            }
            
            console.log(`   ✅ Added ${outputs.length} outputs`);
            
            const psbtBase64 = psbt.toBase64();
            
            // Verificar o PSBT construído
            console.log('\n🔍 Verifying PSBT...');
            console.log('   Total Inputs:', psbt.inputCount);
            console.log('   Total Outputs:', psbt.txOutputs.length);
            
            // Calcular valores totais
            let totalIn = 0;
            for (let i = 0; i < psbt.inputCount; i++) {
                const input = psbt.data.inputs[i];
                if (input.witnessUtxo) {
                    totalIn += input.witnessUtxo.value;
                }
            }
            
            let totalOut = 0;
            for (const output of psbt.txOutputs) {
                totalOut += output.value;
            }
            
            const finalFee = totalIn - totalOut;
            
            console.log('   Total Input Value:', totalIn, 'sats');
            console.log('   Total Output Value:', totalOut, 'sats');
            console.log('   Final Fee:', finalFee, 'sats');
            console.log('   Estimated Fee:', actualFee, 'sats');
            
            if (finalFee < 0) {
                throw new Error(`Negative fee detected! Input: ${totalIn}, Output: ${totalOut}`);
            }
            
            console.log('\n✅ ========== PSBT BUILT SUCCESSFULLY ==========');
            console.log('Inputs:', inputs.length);
            console.log('Outputs:', outputs.length);
            console.log('Fee:', finalFee, 'sats');
            console.log('PSBT Base64 length:', psbtBase64.length);
            
            return {
                psbt: psbtBase64,
                fee: finalFee,
                runestone: runestone,
                runeId: targetRune.runeId,
                runeName: targetRune.name,
                amount: amount.toString(),
                change: change.toString()
            };
            
        } catch (error) {
            console.error('\n❌ Error building PSBT:', error);
            throw error;
        }
    }
}

export default new PSBTBuilderRunes();

