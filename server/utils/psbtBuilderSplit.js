import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

// Initialize ECC library
bitcoin.initEccLib(ecc);

/**
 * PSBT Builder para Split/Consolidação de UTXOs
 * 
 * Permite:
 * - Consolidar múltiplos UTXOs em um só
 * - Dividir um UTXO em múltiplos outputs
 * - Separar Inscriptions, Runes e BTC puros
 */
class PSBTBuilderSplit {
    /**
     * Construir PSBT para split/consolidação de UTXOs
     * 
     * @param {Object} params
     * @param {string} params.address - Endereço (todos outputs voltam para o mesmo endereço)
     * @param {Array} params.inputs - Array de UTXOs para usar como inputs
     * @param {Array} params.outputs - Array de outputs desejados {value: number}
     * @param {number} params.feeRate - Taxa em sat/vB
     * @returns {Object} PSBT construído
     */
    async buildSplitPSBT({ address, inputs, outputs, feeRate = 1 }) {
        try {
            console.log('\n🔀 ========== BUILD SPLIT/CONSOLIDATE PSBT ==========');
            console.log('Address:', address);
            console.log('Inputs:', inputs.length);
            console.log('Desired Outputs:', outputs.length);
            console.log('Fee Rate:', feeRate, 'sat/vB');
            
            // Validar endereço
            const network = bitcoin.networks.bitcoin;
            try {
                bitcoin.address.toOutputScript(address, network);
                console.log('   ✅ Address valid');
            } catch (e) {
                throw new Error(`Invalid address: ${address}`);
            }
            
            // Calcular total de inputs
            let totalInput = 0;
            for (const input of inputs) {
                totalInput += input.value;
            }
            
            console.log('\n💰 Total Input:', totalInput, 'sats');
            
            // Calcular total de outputs desejados
            let totalOutput = 0;
            for (const output of outputs) {
                totalOutput += output.value;
            }
            
            console.log('💰 Total Output (desired):', totalOutput, 'sats');
            
            // Estimar fee
            // Inputs: P2TR = ~57.5 vB por input
            // Outputs: P2TR = ~43 vB por output
            // Overhead: ~10.5 vB
            const estimatedSize = Math.ceil(
                10.5 + 
                (inputs.length * 57.5) + 
                (outputs.length * 43)
            );
            
            const estimatedFee = estimatedSize * feeRate;
            
            console.log('💸 Estimated Size:', estimatedSize, 'vB');
            console.log('💸 Estimated Fee:', estimatedFee, 'sats');
            
            // Verificar se temos saldo suficiente
            const required = totalOutput + estimatedFee;
            
            if (totalInput < required) {
                throw new Error(`Insufficient balance. Have: ${totalInput}, Need: ${required} (output: ${totalOutput} + fee: ${estimatedFee})`);
            }
            
            // Criar PSBT
            const psbt = new bitcoin.Psbt({ network });
            
            // Adicionar inputs
            console.log('\n📥 Adding inputs...');
            
            const axios = (await import('axios')).default;
            
            for (let i = 0; i < inputs.length; i++) {
                const input = inputs[i];
                
                console.log(`   Input ${i}: ${input.txid.substring(0, 16)}...:${input.vout}`);
                console.log(`      Value: ${input.value} sats`);
                
                // Buscar script do UTXO
                const txResponse = await axios.get(
                    `https://mempool.space/api/tx/${input.txid}`,
                    { timeout: 10000 }
                );
                
                const vout = txResponse.data.vout[input.vout];
                const scriptHex = vout.scriptpubkey;
                const script = Buffer.from(scriptHex, 'hex');
                
                const txidBuffer = Buffer.from(input.txid, 'hex');
                
                psbt.addInput({
                    hash: txidBuffer,
                    index: input.vout,
                    witnessUtxo: {
                        script: script,
                        value: input.value
                    }
                });
            }
            
            console.log(`   ✅ Added ${inputs.length} inputs`);
            
            // Adicionar outputs
            console.log('\n📤 Adding outputs...');
            
            const addressScript = bitcoin.address.toOutputScript(address, network);
            
            for (let i = 0; i < outputs.length; i++) {
                const output = outputs[i];
                
                console.log(`   Output ${i}: ${output.value} sats → ${address.substring(0, 20)}...`);
                
                psbt.addOutput({
                    script: addressScript,
                    value: output.value
                });
            }
            
            console.log(`   ✅ Added ${outputs.length} outputs`);
            
            // Calcular fee real
            const actualFee = totalInput - totalOutput;
            
            console.log('\n💸 Fee Calculation:');
            console.log('   Total Input:', totalInput, 'sats');
            console.log('   Total Output:', totalOutput, 'sats');
            console.log('   Actual Fee:', actualFee, 'sats');
            console.log('   Fee Rate:', (actualFee / estimatedSize).toFixed(2), 'sat/vB');
            
            // Retornar PSBT base64
            const psbtBase64 = psbt.toBase64();
            
            console.log('\n✅ ========== SPLIT PSBT BUILT SUCCESSFULLY ==========');
            console.log('Inputs:', inputs.length);
            console.log('Outputs:', outputs.length);
            console.log('Fee:', actualFee, 'sats');
            console.log('PSBT Base64 length:', psbtBase64.length);
            
            return {
                success: true,
                psbt: psbtBase64,
                fee: actualFee,
                estimatedSize: estimatedSize
            };
            
        } catch (error) {
            console.error('❌ Error building split PSBT:', error);
            throw error;
        }
    }
}

export default new PSBTBuilderSplit();

