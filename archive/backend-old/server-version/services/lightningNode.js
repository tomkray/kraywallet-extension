/**
 * ⚡ LIGHTNING NETWORK NODE SERVICE
 * 
 * Gerencia nodes Lightning baseados em Ordinal Inscriptions
 * Cada Inscription representa um Lightning Node único
 */

import * as bitcoin from 'bitcoinjs-lib';
import crypto from 'crypto';

class LightningNodeService {
    constructor() {
        this.nodes = new Map(); // inscriptionId -> nodeData
        this.channels = new Map(); // channelId -> channelData
    }

    /**
     * 🎯 CRIAR NODE LIGHTNING BASEADO EM ORDINAL INSCRIPTION
     * 
     * Deriva identidade única do node a partir da inscription
     * 
     * @param {Object} inscription - Dados da inscription
     * @param {string} inscription.id - ID da inscription
     * @param {string} inscription.inscriptionId - Hash da inscription
     * @param {number} inscription.inscriptionNumber - Número da inscription
     * @param {string} inscription.utxo - UTXO da inscription (txid:vout)
     * @returns {Object} Node Lightning criado
     */
    async createNodeFromInscription(inscription) {
        console.log('⚡ Creating Lightning Node from Ordinal:', inscription.inscriptionNumber);

        // 1. Derivar chave privada do node a partir da inscription
        const nodePrivateKey = this.deriveNodeKey(inscription.inscriptionId);
        
        // 2. Calcular chave pública (identity do node)
        const nodePublicKey = this.getPublicKey(nodePrivateKey);
        
        // 3. Gerar Node ID (hash da pubkey)
        const nodeId = crypto
            .createHash('sha256')
            .update(nodePublicKey)
            .digest('hex');

        // 4. Criar estrutura do node
        const node = {
            // Identity
            nodeId: nodeId,
            nodePubkey: nodePublicKey.toString('hex'),
            
            // Inscription linkage
            inscriptionId: inscription.inscriptionId,
            inscriptionNumber: inscription.inscriptionNumber,
            inscriptionUtxo: inscription.utxo,
            
            // Lightning specific
            alias: `POOL-${inscription.inscriptionNumber}`,
            color: this.generateColorFromInscription(inscription),
            
            // Network info
            addresses: [],
            features: {
                wumbo: true,          // Canais grandes
                staticRemoteKey: true, // Segurança
                anchorCommitments: true // Taproot compatibility
            },
            
            // State
            channels: [],
            capacity: 0,
            totalCapacity: 0,
            
            // Timestamps
            createdAt: Date.now(),
            lastUpdated: Date.now()
        };

        // 5. Armazenar node
        this.nodes.set(inscription.inscriptionId, node);

        console.log('✅ Lightning Node created:', {
            nodeId: nodeId.substring(0, 16) + '...',
            alias: node.alias,
            inscription: inscription.inscriptionNumber
        });

        return node;
    }

    /**
     * 🔑 DERIVAR CHAVE DO NODE A PARTIR DA INSCRIPTION
     * 
     * Usa o inscriptionId como seed para gerar chave determinística
     * IMPORTANTE: Em produção, usar BIP32/BIP39 adequado
     */
    deriveNodeKey(inscriptionId) {
        // Usar inscriptionId como seed
        const seed = crypto
            .createHash('sha256')
            .update(inscriptionId)
            .digest();
        
        // Em produção, usar: bip32.fromSeed(seed).derivePath("m/44'/0'/0'/0/0")
        return seed;
    }

    /**
     * 🔑 OBTER CHAVE PÚBLICA DO NODE
     */
    getPublicKey(privateKey) {
        // Simples exemplo - em produção usar secp256k1
        return crypto
            .createHash('sha256')
            .update(privateKey)
            .digest();
    }

    /**
     * 🎨 GERAR COR ÚNICA PARA O NODE
     */
    generateColorFromInscription(inscription) {
        const hash = crypto
            .createHash('md5')
            .update(inscription.inscriptionId)
            .digest('hex');
        
        return '#' + hash.substring(0, 6);
    }

    /**
     * 📡 ABRIR CANAL LIGHTNING (POOL CREATION)
     * 
     * Cria canal Lightning que representa a liquidity pool
     * 
     * @param {string} inscriptionId - ID da inscription (node)
     * @param {Object} capacity - Capacidade do canal
     * @param {number} capacity.btc - Sats para BTC
     * @param {Object} capacity.runes - Runes para o pool
     * @returns {Object} Canal criado
     */
    async openChannel(inscriptionId, capacity) {
        console.log('⚡ Opening Lightning Channel for pool...');
        
        const node = this.nodes.get(inscriptionId);
        if (!node) {
            throw new Error('Node not found for inscription');
        }

        // 1. Gerar Channel ID único
        const channelId = this.generateChannelId(node.nodeId, capacity);
        
        // 2. Criar estrutura do canal
        const channel = {
            // Identity
            channelId: channelId,
            shortChannelId: this.generateShortChannelId(channelId),
            
            // Nodes
            node1: node.nodeId,
            node1Pubkey: node.nodePubkey,
            
            // Capacity
            capacity: capacity.btc,
            localBalance: capacity.btc,
            remoteBalance: 0,
            
            // Runes in channel
            runes: capacity.runes || [],
            
            // State
            active: false, // Ativa após confirmação on-chain
            private: false,
            
            // Policy
            feeBaseMsat: 1000, // 1 sat base fee
            feeRateMilliMsat: 1, // 0.0001% fee rate (muito baixo!)
            timeLockDelta: 40,
            minHtlc: 1,
            maxHtlcMsat: capacity.btc * 1000,
            
            // Commitment transaction (PSBT)
            commitmentTx: null,
            fundingTxid: null,
            fundingOutput: null,
            
            // Timestamps
            createdAt: Date.now(),
            confirmedAt: null
        };

        // 3. Armazenar canal
        this.channels.set(channelId, channel);
        node.channels.push(channelId);
        node.capacity += capacity.btc;

        console.log('✅ Lightning Channel opened:', {
            channelId: channelId.substring(0, 16) + '...',
            capacity: `${capacity.btc} sats`,
            runes: capacity.runes.map(r => `${r.amount} ${r.id}`)
        });

        return channel;
    }

    /**
     * 🔢 GERAR CHANNEL ID
     */
    generateChannelId(nodeId, capacity) {
        return crypto
            .createHash('sha256')
            .update(nodeId + JSON.stringify(capacity) + Date.now())
            .digest('hex');
    }

    /**
     * 🔢 GERAR SHORT CHANNEL ID (formato Lightning)
     * 
     * Formato: blockHeight:txIndex:outputIndex
     */
    generateShortChannelId(channelId) {
        // Em produção, pegar do PSBT real
        // Por agora, gerar mock
        const blockHeight = 840000 + Math.floor(Math.random() * 1000);
        const txIndex = Math.floor(Math.random() * 100);
        const outputIndex = 0;
        
        return `${blockHeight}:${txIndex}:${outputIndex}`;
    }

    /**
     * ⚡ CRIAR INVOICE LIGHTNING PARA SWAP
     * 
     * Gera invoice que usuário paga para fazer swap
     * 
     * @param {string} channelId - ID do canal (pool)
     * @param {Object} swapDetails - Detalhes do swap
     * @returns {Object} Invoice Lightning
     */
    async createSwapInvoice(channelId, swapDetails) {
        console.log('⚡ Creating Lightning Invoice for swap...');
        
        const channel = this.channels.get(channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }

        // 1. Calcular valores (AMM x*y=k será feito externamente)
        const { amountOut, tokenOut, amountIn, tokenIn } = swapDetails;
        
        // 2. Gerar payment hash (HTLC)
        const preimage = crypto.randomBytes(32);
        const paymentHash = crypto
            .createHash('sha256')
            .update(preimage)
            .digest();

        // 3. Criar invoice
        const invoice = {
            // Payment details
            paymentHash: paymentHash.toString('hex'),
            paymentPreimage: preimage.toString('hex'),
            
            // Amount
            value: amountOut,
            valueMsat: amountOut * 1000,
            
            // Tokens
            tokenOut: tokenOut,
            tokenIn: tokenIn,
            amountIn: amountIn,
            
            // Routing
            destination: channel.node1Pubkey,
            channelId: channelId,
            
            // Timelock
            cltvExpiry: 144, // ~1 dia
            expiry: 3600, // 1 hora
            
            // Memo
            memo: `Swap ${amountIn} ${tokenIn} → ${amountOut} ${tokenOut}`,
            
            // Invoice string (bolt11)
            paymentRequest: this.encodeBolt11Invoice({
                paymentHash: paymentHash.toString('hex'),
                amount: amountOut,
                destination: channel.node1Pubkey,
                expiry: 3600
            }),
            
            // State
            settled: false,
            settledAt: null,
            createdAt: Date.now()
        };

        console.log('✅ Lightning Invoice created:', {
            amount: `${amountOut} sats`,
            swap: `${amountIn} ${tokenIn} → ${amountOut} ${tokenOut}`,
            expiry: '1 hour'
        });

        return invoice;
    }

    /**
     * 📝 ENCODE BOLT11 INVOICE
     * 
     * Cria invoice string no formato Lightning
     * Em produção, usar biblioteca oficial
     */
    encodeBolt11Invoice(data) {
        // Mock - em produção usar bolt11 encoder
        const prefix = 'lnbc'; // Bitcoin mainnet
        const amount = data.amount;
        const paymentHash = data.paymentHash.substring(0, 20);
        
        return `${prefix}${amount}1${paymentHash}`;
    }

    /**
     * 💰 SETTLEMENT - FECHAR CANAL (WITHDRAW)
     * 
     * Fecha canal cooperativamente e faz settlement on-chain
     * 
     * @param {string} channelId - ID do canal
     * @param {string} destination - Endereço de destino
     * @returns {Object} PSBT de fechamento
     */
    async closeChannel(channelId, destination) {
        console.log('⚡ Closing Lightning Channel (settlement)...');
        
        const channel = this.channels.get(channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }

        // 1. Calcular saldo final (incluindo fees acumuladas)
        const finalBalance = {
            btc: channel.localBalance,
            runes: channel.runes
        };

        // 2. Criar PSBT de fechamento (commitment transaction)
        const closePSBT = {
            type: 'channel_close',
            channelId: channelId,
            
            // Inputs: funding transaction
            inputs: [{
                txid: channel.fundingTxid,
                vout: channel.fundingOutput,
                value: channel.capacity
            }],
            
            // Outputs: retornar tudo para user
            outputs: [
                {
                    address: destination,
                    value: finalBalance.btc,
                    runes: finalBalance.runes
                }
            ],
            
            // Runestone para transferir Runes
            runestone: this.buildRunestoneForClose(finalBalance.runes, 0),
            
            timestamp: Date.now()
        };

        // 3. Marcar canal como fechado
        channel.active = false;
        channel.closedAt = Date.now();

        console.log('✅ Lightning Channel closed:', {
            channelId: channelId.substring(0, 16) + '...',
            finalBalance: `${finalBalance.btc} sats`,
            runes: finalBalance.runes.map(r => `${r.amount} ${r.id}`)
        });

        return closePSBT;
    }

    /**
     * 🏗️ BUILD RUNESTONE FOR CHANNEL CLOSE
     */
    buildRunestoneForClose(runes, outputIndex) {
        // Construir edicts para todas as Runes
        const edicts = runes.map(rune => ({
            id: rune.id,
            amount: rune.amount,
            output: outputIndex
        }));

        return {
            edicts: edicts,
            tag: 10 // Body tag
        };
    }

    /**
     * 📊 GET NODE INFO
     */
    getNode(inscriptionId) {
        return this.nodes.get(inscriptionId);
    }

    /**
     * 📊 GET CHANNEL INFO
     */
    getChannel(channelId) {
        return this.channels.get(channelId);
    }

    /**
     * 📊 LIST ALL NODES
     */
    listNodes() {
        return Array.from(this.nodes.values());
    }

    /**
     * 📊 LIST ALL CHANNELS
     */
    listChannels() {
        return Array.from(this.channels.values());
    }
}

export default new LightningNodeService();

