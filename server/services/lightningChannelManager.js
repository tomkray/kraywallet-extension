/**
 * 🔗 LIGHTNING CHANNEL MANAGER
 * 
 * Gerencia abertura de channels entre usuários e o Hub:
 * - Classifica UTXOs (via utxoManager)
 * - Valida segurança (BLOQUEIA Inscriptions!)
 * - Cria funding transactions
 * - Registra channels no DB
 */

import lndConnection from './lndConnection.js';
import utxoManager from './utxoManager.js';
import hubNode from './hubNode.js';
import { getDatabase } from '../db/init-supabase.js';

class LightningChannelManager {
    
    /**
     * 🔗 ABRIR CHANNEL COM VALIDAÇÃO DE UTXOs
     * 
     * @param {Object} params
     * @param {string} params.userAddress - Address Taproot do user
     * @param {string} params.remotePubkey - Pubkey Lightning do Hub
     * @param {number} params.capacity - Capacidade do channel em sats
     * @param {string} params.assetType - 'btc' ou 'rune'
     * @param {string} params.runeId - ID da Rune (se applicable)
     */
    async openChannel({
        userAddress,
        remotePubkey,
        capacity,
        assetType,
        runeId = null
    }) {
        console.log('🔗 ========== OPENING LIGHTNING CHANNEL ==========');
        console.log(`   User Address: ${userAddress}`);
        console.log(`   Remote Pubkey: ${remotePubkey}`);
        console.log(`   Capacity: ${capacity} sats`);
        console.log(`   Asset Type: ${assetType}`);
        if (runeId) console.log(`   Rune ID: ${runeId}`);
        
        try {
            // 1. VALIDAÇÃO: Nunca usar Inscriptions!
            if (assetType === 'inscription') {
                throw new Error('❌ BLOQUEADO! Inscriptions não podem ir para Lightning! Perda permanente!');
            }
            
            // 2. VALIDAÇÃO: Capacidade mínima
            if (capacity < 20000) {
                throw new Error('Minimum capacity: 20,000 sats');
            }
            
            // 3. CLASSIFICAR UTXOs DO USUÁRIO
            console.log('📊 Classifying user UTXOs...');
            const classified = await utxoManager.classifyUTXOs(userAddress);
            
            // 4. VALIDAÇÃO: Bloquear se tentar usar Inscription
            if (classified.inscriptions.length > 0 && assetType === 'inscription') {
                throw new Error('❌ BLOQUEADO! Inscriptions detectadas no address!');
            }
            
            // 5. SELECIONAR UTXOs CORRETOS
            let selectedUTXOs = [];
            let totalValue = 0;
            
            if (assetType === 'btc') {
                // Pure Bitcoin
                console.log('   Selecting Pure Bitcoin UTXOs...');
                selectedUTXOs = utxoManager.selectUTXOsForCapacity(
                    classified.pureBitcoin,
                    capacity
                );
                totalValue = selectedUTXOs.reduce((sum, u) => sum + u.value, 0);
                
            } else if (assetType === 'rune') {
                // Rune específica
                console.log(`   Selecting Rune UTXOs for ${runeId}...`);
                const runeUTXOs = classified.runes.filter(
                    utxo => utxo.rune.id === runeId
                );
                
                if (runeUTXOs.length === 0) {
                    throw new Error(`No UTXOs found for Rune ${runeId}`);
                }
                
                selectedUTXOs = utxoManager.selectUTXOsForCapacity(runeUTXOs, capacity);
                totalValue = selectedUTXOs.reduce((sum, u) => sum + u.value, 0);
            }
            
            if (selectedUTXOs.length === 0) {
                throw new Error('No suitable UTXOs found');
            }
            
            console.log(`✅ Selected ${selectedUTXOs.length} UTXOs (total: ${totalValue} sats)`);
            
            // 6. CRIAR FUNDING TRANSACTION (PLACEHOLDER)
            // Na implementação real, usar bitcoinjs-lib para criar PSBT
            console.log('📝 Creating funding transaction...');
            const fundingTxId = `funding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            console.log(`   Funding TX ID: ${fundingTxId}`);
            
            // 7. ABRIR CHANNEL VIA LND (PLACEHOLDER)
            // Na implementação real, usar lndConnection.openChannel()
            console.log('⚡ Opening channel via LND...');
            
            const channel = {
                funding_txid: fundingTxId,
                output_index: 0,
                capacity,
                local_balance: capacity,
                remote_balance: 0,
                status: 'pending'
            };
            
            console.log('   Channel created (pending confirmations)');
            
            // 8. REGISTRAR NO DB
            console.log('💾 Registering channel in DB...');
            const db = getDatabase();
            
            await db.run(`
                INSERT INTO hub_channels
                (channel_id, user_pubkey, user_address, capacity, asset_type, asset_id, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                channel.funding_txid,
                remotePubkey, // FIXME: Deveria ser user pubkey, não remote
                userAddress,
                capacity,
                assetType,
                runeId,
                'pending',
                Date.now()
            ]);
            
            // 9. SE FOR RUNE: Adicionar metadata
            if (assetType === 'rune') {
                console.log('📝 Adding Rune metadata...');
                await this.attachRuneMetadata(channel.funding_txid, {
                    runeId,
                    amount: this.calculateRuneAmount(selectedUTXOs)
                });
                
                // Adicionar liquidez à pool automaticamente
                const poolId = `${runeId}_BTC`;
                try {
                    await hubNode.addLiquidityToPool(poolId, capacity, 0);
                } catch (error) {
                    console.warn('⚠️  Pool not found, creating new pool...');
                    await hubNode.createPool(runeId, 'BTC', 0.3);
                    await hubNode.addLiquidityToPool(poolId, capacity, 0);
                }
            }
            
            console.log('✅ ========== CHANNEL OPENED! ==========');
            console.log(`   Channel ID: ${channel.funding_txid}`);
            console.log(`   Status: ${channel.status}`);
            
            return {
                success: true,
                channel: {
                    id: channel.funding_txid,
                    capacity,
                    assetType,
                    status: channel.status
                }
            };
            
        } catch (error) {
            console.error('❌ Error opening channel:', error.message);
            throw error;
        }
    }

    /**
     * 📝 ANEXAR METADATA DE RUNE AO CHANNEL
     */
    async attachRuneMetadata(channelId, runeData) {
        console.log(`📝 Attaching Rune metadata to channel ${channelId}`);
        
        const db = getDatabase();
        await db.run(`
            INSERT OR REPLACE INTO channel_rune_metadata
            (channel_id, rune_id, amount, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `, [
            channelId,
            runeData.runeId,
            runeData.amount,
            Date.now(),
            Date.now()
        ]);
        
        console.log('✅ Rune metadata attached');
    }

    /**
     * 🧮 CALCULAR QUANTIDADE TOTAL DE RUNES NOS UTXOs
     */
    calculateRuneAmount(utxos) {
        return utxos.reduce((sum, utxo) => {
            return sum + (utxo.rune?.amount || 0);
        }, 0);
    }

    /**
     * 📊 OBTER STATUS DO CHANNEL
     */
    async getChannelStatus(channelId) {
        const db = getDatabase();
        const channel = await db.get(`
            SELECT * FROM hub_channels WHERE channel_id = ?
        `, [channelId]);
        
        if (!channel) {
            throw new Error('Channel not found');
        }
        
        return {
            channelId: channel.channel_id,
            userPubkey: channel.user_pubkey,
            userAddress: channel.user_address,
            capacity: channel.capacity,
            assetType: channel.asset_type,
            assetId: channel.asset_id,
            status: channel.status,
            createdAt: channel.created_at
        };
    }

    /**
     * 📋 LISTAR CHANNELS DO USUÁRIO
     */
    async getUserChannels(userAddress) {
        const db = getDatabase();
        const channels = await db.all(`
            SELECT * FROM hub_channels 
            WHERE user_address = ? 
            ORDER BY created_at DESC
        `, [userAddress]);
        
        return channels.map(c => ({
            channelId: c.channel_id,
            capacity: c.capacity,
            assetType: c.asset_type,
            assetId: c.asset_id,
            status: c.status,
            createdAt: c.created_at
        }));
    }

    /**
     * ❌ FECHAR CHANNEL (FUTURO)
     */
    async closeChannel(channelId, force = false) {
        console.log(`❌ Closing channel ${channelId} (force: ${force})`);
        
        // PLACEHOLDER - implementação futura
        const db = getDatabase();
        await db.run(`
            UPDATE hub_channels
            SET status = ?, closed_at = ?
            WHERE channel_id = ?
        `, [
            force ? 'force_closed' : 'closing',
            Date.now(),
            channelId
        ]);
        
        console.log('✅ Channel closing initiated');
        
        return {
            success: true,
            status: force ? 'force_closed' : 'closing'
        };
    }
}

export default new LightningChannelManager();




