/**
 * ⚡ LND EVENTS LISTENER - Real-time Channel Monitoring
 * 
 * Monitora eventos do LND em tempo real e atualiza o State Tracker.
 * 
 * EVENTOS MONITORADOS:
 * - Channel Opens (funding TX confirmada)
 * - Channel Closes (cooperative ou force close)
 * - Payments (Lightning invoices settled)
 * - Channel Updates (balance changes)
 * 
 * FLUXO:
 * 1. Subscribe to LND event streams
 * 2. Detect channel/payment events
 * 3. Update Kray State Tracker
 * 4. Emit notifications para frontend
 */

import { EventEmitter } from 'events';
import { getLNDPoolClient } from './lndPoolClient.js';
import StateTracker from './krayStateTracker.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 EVENT EMITTER (para frontend)
// ═══════════════════════════════════════════════════════════════════════════════

export const lndEvents = new EventEmitter();

// ═══════════════════════════════════════════════════════════════════════════════
// 🔌 LND CONNECTION
// ═══════════════════════════════════════════════════════════════════════════════

let lnd = null;
let isListening = false;

// Streams ativos
let channelEventStream = null;
let invoiceStream = null;
let htlcEventStream = null;

/**
 * Iniciar listener de eventos LND
 */
export async function startLNDEventsListener() {
    if (isListening) {
        console.log('⚠️  LND Events Listener already running');
        return;
    }
    
    console.log('\n⚡ Starting LND Events Listener...');
    
    try {
        lnd = getLNDPoolClient();
        await lnd.connect();
        
        console.log('✅ Connected to LND');
        
        // Subscribe to different event streams
        await subscribeToChannelEvents();
        await subscribeToInvoices();
        await subscribeToHTLCEvents();
        
        isListening = true;
        
        console.log('✅ LND Events Listener started');
        console.log('   Monitoring:');
        console.log('   - Channel opens/closes');
        console.log('   - Invoice settlements');
        console.log('   - HTLC events');
        
        lndEvents.emit('listener:started');
        
    } catch (error) {
        console.error('❌ Failed to start LND Events Listener:', error);
        throw error;
    }
}

/**
 * Parar listener de eventos LND
 */
export async function stopLNDEventsListener() {
    if (!isListening) {
        return;
    }
    
    console.log('\n⚡ Stopping LND Events Listener...');
    
    // Close streams
    if (channelEventStream) {
        channelEventStream.cancel();
        channelEventStream = null;
    }
    
    if (invoiceStream) {
        invoiceStream.cancel();
        invoiceStream = null;
    }
    
    if (htlcEventStream) {
        htlcEventStream.cancel();
        htlcEventStream = null;
    }
    
    isListening = false;
    
    console.log('✅ LND Events Listener stopped');
    
    lndEvents.emit('listener:stopped');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 CHANNEL EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to channel events (opens, closes, updates)
 */
async function subscribeToChannelEvents() {
    console.log('📡 Subscribing to channel events...');
    
    try {
        // SubscribeChannelEvents RPC
        channelEventStream = await lnd._subscribeChannelEvents();
        
        channelEventStream.on('data', (event) => {
            handleChannelEvent(event);
        });
        
        channelEventStream.on('error', (error) => {
            console.error('❌ Channel event stream error:', error);
            // Tentar reconectar
            setTimeout(() => subscribeToChannelEvents(), 5000);
        });
        
        channelEventStream.on('end', () => {
            console.log('⚠️  Channel event stream ended');
            if (isListening) {
                setTimeout(() => subscribeToChannelEvents(), 5000);
            }
        });
        
        console.log('✅ Subscribed to channel events');
        
    } catch (error) {
        console.error('❌ Failed to subscribe to channel events:', error);
        // Mock para desenvolvimento (se LND não disponível)
        console.log('⚠️  Using mock channel events (development mode)');
    }
}

/**
 * Handle channel event (open, close, update)
 */
function handleChannelEvent(event) {
    console.log('\n📡 Channel Event:', event.type);
    
    try {
        switch (event.type) {
            case 'OPEN_CHANNEL':
                handleChannelOpened(event);
                break;
                
            case 'CLOSED_CHANNEL':
                handleChannelClosed(event);
                break;
                
            case 'ACTIVE_CHANNEL':
                handleChannelActive(event);
                break;
                
            case 'INACTIVE_CHANNEL':
                handleChannelInactive(event);
                break;
                
            case 'PENDING_OPEN_CHANNEL':
                handleChannelPending(event);
                break;
                
            default:
                console.log(`   Unknown channel event type: ${event.type}`);
        }
        
    } catch (error) {
        console.error('❌ Error handling channel event:', error);
    }
}

/**
 * Handle PENDING channel (funding TX broadcast, aguardando confirmações)
 */
function handleChannelPending(event) {
    const { channel } = event;
    
    console.log('   Pending Channel:');
    console.log(`   - Channel Point: ${channel.channel_point}`);
    console.log(`   - Capacity: ${channel.capacity} sats`);
    console.log(`   - Local Balance: ${channel.local_balance} sats`);
    
    // Emit event para frontend
    lndEvents.emit('channel:pending', {
        channelPoint: channel.channel_point,
        capacity: channel.capacity,
        localBalance: channel.local_balance
    });
}

/**
 * Handle ACTIVE channel (confirmações suficientes, canal ativo)
 */
function handleChannelActive(event) {
    const { channel } = event;
    
    console.log('   Active Channel:');
    console.log(`   - Channel ID: ${channel.chan_id}`);
    console.log(`   - Channel Point: ${channel.channel_point}`);
    console.log(`   - Remote Pubkey: ${channel.remote_pubkey}`);
    
    const channelId = channel.chan_id;
    
    // Atualizar status no State Tracker
    StateTracker.updateChannelStatus(channelId, 'ACTIVE');
    
    // Emit event para frontend
    lndEvents.emit('channel:active', {
        channelId,
        channelPoint: channel.channel_point,
        remotePubkey: channel.remote_pubkey,
        capacity: channel.capacity,
        localBalance: channel.local_balance
    });
    
    console.log('✅ Channel activated in State Tracker');
}

/**
 * Handle channel opened (DEPRECATED: use ACTIVE instead)
 */
function handleChannelOpened(event) {
    // Normalmente não chega aqui, mas mantemos por compatibilidade
    handleChannelActive(event);
}

/**
 * Handle channel closed
 */
function handleChannelClosed(event) {
    const { closed_channel } = event;
    
    console.log('   Closed Channel:');
    console.log(`   - Channel ID: ${closed_channel.chan_id}`);
    console.log(`   - Closing TX: ${closed_channel.closing_tx_hash}`);
    console.log(`   - Close Type: ${closed_channel.close_type}`);
    
    const channelId = closed_channel.chan_id;
    const closeType = closed_channel.close_type;
    
    let status;
    if (closeType === 'COOPERATIVE_CLOSE') {
        status = 'CLOSED';
    } else if (closeType === 'LOCAL_FORCE_CLOSE' || closeType === 'REMOTE_FORCE_CLOSE') {
        status = 'FORCE_CLOSED';
    } else {
        status = 'CLOSED';
    }
    
    // Atualizar status no State Tracker
    StateTracker.updateChannelStatus(channelId, status);
    
    // Emit event para frontend
    lndEvents.emit('channel:closed', {
        channelId,
        closingTxHash: closed_channel.closing_tx_hash,
        closeType,
        status
    });
    
    console.log(`✅ Channel marked as ${status} in State Tracker`);
}

/**
 * Handle channel inactive
 */
function handleChannelInactive(event) {
    const { channel } = event;
    
    console.log('   Inactive Channel:');
    console.log(`   - Channel ID: ${channel.chan_id}`);
    
    // Emit event para frontend (channel peer offline, etc)
    lndEvents.emit('channel:inactive', {
        channelId: channel.chan_id
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 INVOICE EVENTS (Swaps!)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to invoice updates (payments received)
 */
async function subscribeToInvoices() {
    console.log('📡 Subscribing to invoice events...');
    
    try {
        // SubscribeInvoices RPC
        invoiceStream = await lnd._subscribeInvoices();
        
        invoiceStream.on('data', (invoice) => {
            handleInvoiceUpdate(invoice);
        });
        
        invoiceStream.on('error', (error) => {
            console.error('❌ Invoice stream error:', error);
            setTimeout(() => subscribeToInvoices(), 5000);
        });
        
        invoiceStream.on('end', () => {
            console.log('⚠️  Invoice stream ended');
            if (isListening) {
                setTimeout(() => subscribeToInvoices(), 5000);
            }
        });
        
        console.log('✅ Subscribed to invoice events');
        
    } catch (error) {
        console.error('❌ Failed to subscribe to invoice events:', error);
        console.log('⚠️  Using mock invoice events (development mode)');
    }
}

/**
 * Handle invoice update (payment settled = swap completed!)
 */
function handleInvoiceUpdate(invoice) {
    // Só processar invoices SETTLED (pagos)
    if (invoice.state !== 'SETTLED') {
        return;
    }
    
    console.log('\n💰 Invoice Settled:');
    console.log(`   - Payment Hash: ${invoice.r_hash.toString('hex')}`);
    console.log(`   - Amount: ${invoice.amt_paid_sat} sats`);
    console.log(`   - Memo: ${invoice.memo}`);
    
    const paymentHash = invoice.r_hash.toString('hex');
    const paymentPreimage = invoice.r_preimage.toString('hex');
    
    // Completar swap no State Tracker
    StateTracker.completeSwap(paymentHash, paymentPreimage);
    
    // Emit event para frontend
    lndEvents.emit('swap:completed', {
        paymentHash,
        amountSats: invoice.amt_paid_sat,
        memo: invoice.memo,
        settledAt: invoice.settle_date
    });
    
    console.log('✅ Swap marked as COMPLETED in State Tracker');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔀 HTLC EVENTS (Atomic Swaps!)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to HTLC events (Hash Time-Locked Contracts)
 */
async function subscribeToHTLCEvents() {
    console.log('📡 Subscribing to HTLC events...');
    
    try {
        // SubscribeHtlcEvents RPC
        htlcEventStream = await lnd._subscribeHTLCEvents();
        
        htlcEventStream.on('data', (event) => {
            handleHTLCEvent(event);
        });
        
        htlcEventStream.on('error', (error) => {
            console.error('❌ HTLC event stream error:', error);
            setTimeout(() => subscribeToHTLCEvents(), 5000);
        });
        
        htlcEventStream.on('end', () => {
            console.log('⚠️  HTLC event stream ended');
            if (isListening) {
                setTimeout(() => subscribeToHTLCEvents(), 5000);
            }
        });
        
        console.log('✅ Subscribed to HTLC events');
        
    } catch (error) {
        console.error('❌ Failed to subscribe to HTLC events:', error);
        console.log('⚠️  Using mock HTLC events (development mode)');
    }
}

/**
 * Handle HTLC event
 */
function handleHTLCEvent(event) {
    console.log('\n🔀 HTLC Event:', event.event_type);
    
    try {
        switch (event.event_type) {
            case 'SEND':
                console.log('   Outgoing HTLC (sending payment)');
                break;
                
            case 'RECEIVE':
                console.log('   Incoming HTLC (receiving payment)');
                break;
                
            case 'FORWARD':
                console.log('   Forwarding HTLC (routing)');
                break;
                
            default:
                console.log(`   Unknown HTLC event type: ${event.event_type}`);
        }
        
        // Emit event para frontend (opcional, para debugging)
        lndEvents.emit('htlc:event', {
            eventType: event.event_type,
            channelId: event.incoming_channel_id || event.outgoing_channel_id
        });
        
    } catch (error) {
        console.error('❌ Error handling HTLC event:', error);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Obter status atual do listener
 */
export function getListenerStatus() {
    return {
        isListening,
        hasChannelStream: channelEventStream !== null,
        hasInvoiceStream: invoiceStream !== null,
        hasHTLCStream: htlcEventStream !== null
    };
}

/**
 * Forçar sync manual de canais
 * (útil para recuperar estado após restart)
 */
export async function syncAllChannels() {
    console.log('\n🔄 Syncing all channels from LND...');
    
    try {
        const lnd = getLNDPoolClient();
        await lnd.connect();
        
        // ListChannels RPC
        const channels = await lnd._listChannels();
        
        console.log(`   Found ${channels.channels.length} channels`);
        
        for (const channel of channels.channels) {
            const channelId = channel.chan_id;
            
            // Verificar se canal existe no State Tracker
            const existingChannel = StateTracker.getChannel(channelId);
            
            if (!existingChannel) {
                console.log(`   Creating new channel record: ${channelId}`);
                
                StateTracker.createChannelRecord({
                    channelId,
                    channelPoint: channel.channel_point,
                    remotePubkey: channel.remote_pubkey,
                    capacitySats: channel.capacity,
                    localBalanceSats: channel.local_balance
                });
                
                // Marcar como ACTIVE se canal está ativo
                if (channel.active) {
                    StateTracker.updateChannelStatus(channelId, 'ACTIVE');
                }
            } else {
                console.log(`   Updating channel balances: ${channelId}`);
                
                StateTracker.updateChannelBalances(
                    channelId,
                    channel.local_balance,
                    channel.remote_balance
                );
                
                // Atualizar status se mudou
                if (channel.active && existingChannel.status !== 'ACTIVE') {
                    StateTracker.updateChannelStatus(channelId, 'ACTIVE');
                } else if (!channel.active && existingChannel.status === 'ACTIVE') {
                    StateTracker.updateChannelStatus(channelId, 'INACTIVE');
                }
            }
        }
        
        console.log('✅ All channels synced');
        
        return channels.channels.length;
        
    } catch (error) {
        console.error('❌ Failed to sync channels:', error);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
    startLNDEventsListener,
    stopLNDEventsListener,
    getListenerStatus,
    syncAllChannels,
    lndEvents
};


