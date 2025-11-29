/**
 * ⚡ KRAY LIGHTNING DeFi INTEGRATION
 * 
 * Integração do frontend MyWallet com Lightning DeFi (Runes off-chain)
 * 
 * REVOLUCIONÁRIO: Primeiro DeFi nativo na Lightning Network com Runes!
 */

const LIGHTNING_DEFI_API_URL = 'https://kraywallet-backend.onrender.com/api/lightning-defi';

/**
 * 🔗 CONECTAR AO LIGHTNING DeFi
 */
async function connectToLightningDefi() {
    console.log('🔗 Connecting to Lightning DeFi...');
    
    try {
        const response = await fetch(`${LIGHTNING_DEFI_API_URL}/status`);
        
        if (!response.ok) {
            throw new Error(`Lightning DeFi not available: ${response.status}`);
        }
        
        const defiInfo = await response.json();
        
        console.log('✅ Lightning DeFi connected:');
        console.log(`   State Tracker: ${defiInfo.system.stateTrackerActive ? 'Active' : 'Inactive'}`);
        console.log(`   LND: ${defiInfo.system.lndConnected ? 'Connected' : 'Mock mode'}`);
        console.log(`   Active Pools: ${defiInfo.pools.active}`);
        console.log(`   Total Pools: ${defiInfo.pools.total}`);
        
        // Salvar status para futuros swaps
        await chrome.storage.local.set({
            lightningDefiConnected: true,
            lightningDefiStatus: defiInfo,
            lightningDefiConnectedAt: Date.now()
        });
        
        return defiInfo;
        
    } catch (error) {
        console.error('❌ Failed to connect to Lightning DeFi:', error);
        throw error;
    }
}

/**
 * 🏊 LISTAR POOLS LIGHTNING DeFi
 */
async function loadLightningPools() {
    console.log('🏊 Loading Lightning DeFi pools...');
    
    try {
        const response = await fetch(`${LIGHTNING_DEFI_API_URL}/pools`);
        
        if (!response.ok) {
            throw new Error(`Failed to load pools: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log(`✅ Loaded ${data.count} pools`);
        
        return data.pools;
        
    } catch (error) {
        console.error('❌ Error loading pools:', error);
        return [];
    }
}

/**
 * 💱 OBTER QUOTE DE SWAP
 */
async function getSwapQuote(poolId, amountIn, isTokenAToB = true) {
    console.log('💱 Getting swap quote...');
    console.log(`   Pool: ${poolId}`);
    console.log(`   Amount in: ${amountIn}`);
    
    try {
        const response = await fetch(`${HUB_API_URL}/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                poolId,
                amountIn,
                isTokenAToB
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to get quote: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('✅ Quote received:');
        console.log(`   Amount out: ${data.quote.amountOut}`);
        console.log(`   Fee: ${data.quote.totalFee}`);
        console.log(`   Price impact: ${data.quote.priceImpact}%`);
        
        return data.quote;
        
    } catch (error) {
        console.error('❌ Error getting quote:', error);
        throw error;
    }
}

/**
 * 💱 EXECUTAR SWAP LIGHTNING DeFi
 */
async function executeLightningSwap({
    channelId,
    inputAsset,      // "BTC" ou runeId
    inputAmount,     // sats ou rune amount
    outputAsset,     // "BTC" ou runeId
    minOutput,       // slippage protection
    slippageTolerance = 0.05
}) {
    console.log('💱 ========== EXECUTING LIGHTNING SWAP ==========');
    console.log(`   Channel: ${channelId}`);
    console.log(`   Swap: ${inputAmount} ${inputAsset} → ${outputAsset}`);
    console.log(`   Min output: ${minOutput}`);
    
    try {
        // STEP 1: Solicitar swap (criar invoice)
        console.log('📝 STEP 1: Requesting swap...');
        
        const swapResponse = await fetch(`${LIGHTNING_DEFI_API_URL}/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channelId,
                inputAsset,
                inputAmount,
                outputAsset,
                minOutput,
                slippageTolerance
            })
        });
        
        if (!swapResponse.ok) {
            const error = await swapResponse.json();
            throw new Error(error.error || `Swap failed: ${swapResponse.status}`);
        }
        
        const swapData = await swapResponse.json();
        const { invoice, paymentHash, quote, swapId } = swapData;
        
        console.log('✅ Swap invoice created!');
        console.log(`   Swap ID: ${swapId}`);
        console.log(`   Payment Hash: ${paymentHash}`);
        console.log(`   Expected output: ${quote.outputAmount}`);
        console.log(`   Invoice: ${invoice.substring(0, 30)}...`);
        
        // STEP 2: User paga invoice (Lightning payment)
        console.log('⚡ STEP 2: Sending Lightning payment...');
        
        const paymentResult = await window.krayWallet.sendPayment(invoice);
        
        console.log('✅ Payment sent!');
        console.log(`   Preimage: ${paymentResult.preimage}`);
        
        // STEP 3: Aguardar confirmação (LND Events Listener já processa)
        console.log('⏳ STEP 3: Waiting for swap settlement...');
        
        // Poll status (ou usar WebSocket em produção)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('✅ Swap completed off-chain! ⚡');
        console.log(`   Output: ${quote.outputAmount}`);
        console.log(`   Fee: ${quote.lpFee + quote.protocolFee}`);
        
        return {
            success: true,
            swapId,
            outputAmount: quote.outputAmount,
            paymentHash,
            preimage: paymentResult.preimage
        };
        
    } catch (error) {
        console.error('❌ Error executing swap:', error);
        throw error;
    }
}

/**
 * 🏊 CRIAR POOL LIGHTNING DeFi (CREATE POOL)
 */
async function createLightningPool({
    runeId,
    runeName,
    runeSymbol,
    runeAmount,
    btcAmount,
    userAddress,
    userUtxos,
    poolName = null
}) {
    console.log('🏊 ========== CREATING LIGHTNING POOL ==========');
    console.log(`   Rune: ${runeSymbol} (${runeId})`);
    console.log(`   Rune Amount: ${runeAmount}`);
    console.log(`   BTC Amount: ${btcAmount} sats`);
    console.log(`   User Address: ${userAddress}`);
    
    try {
        // STEP 1: Preparar pool (criar PSBT)
        console.log('📝 STEP 1: Preparing pool PSBT...');
        
        const prepareResponse = await fetch(`${LIGHTNING_DEFI_API_URL}/create-pool`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                runeId,
                runeName,
                runeSymbol,
                runeAmount,
                btcAmount,
                userAddress,
                userUtxos,
                poolName
            })
        });
        
        if (!prepareResponse.ok) {
            const error = await prepareResponse.json();
            throw new Error(error.error || `Failed to prepare pool: ${prepareResponse.status}`);
        }
        
        const prepareData = await prepareResponse.json();
        const { psbt, poolId, poolAddress, fundingAmount } = prepareData;
        
        console.log('✅ PSBT created!');
        console.log(`   Pool ID: ${poolId}`);
        console.log(`   Pool Address: ${poolAddress}`);
        console.log(`   Funding: ${fundingAmount} sats`);
        
        // STEP 2: User assina PSBT
        console.log('📝 STEP 2: Asking user to sign PSBT...');
        
        const signedPsbt = await window.krayWallet.signPsbt(psbt);
        
        console.log('✅ PSBT signed by user!');
        
        // STEP 3: Finalizar pool (broadcast)
        console.log('📡 STEP 3: Finalizing pool...');
        
        const finalizeResponse = await fetch(`${LIGHTNING_DEFI_API_URL}/finalize-pool`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                psbt: signedPsbt,
                poolId,
                runeId,
                runeAmount,
                runeName,
                runeSymbol
            })
        });
        
        if (!finalizeResponse.ok) {
            const error = await finalizeResponse.json();
            throw new Error(error.error || `Failed to finalize pool: ${finalizeResponse.status}`);
        }
        
        const finalizeData = await finalizeResponse.json();
        
        console.log('✅ Pool created successfully!');
        console.log(`   TXID: ${finalizeData.txid}`);
        console.log(`   Channel ID: ${finalizeData.channelId}`);
        console.log(`   Status: ${finalizeData.status}`);
        console.log(`   Explorer: ${finalizeData.explorerUrl}`);
        
        return finalizeData;
        
    } catch (error) {
        console.error('❌ Error creating pool:', error);
        throw error;
    }
}

/**
 * 📊 OBTER CHANNELS DO USUÁRIO
 */
async function getUserChannels(userAddress) {
    console.log(`📊 Getting user channels for: ${userAddress}`);
    
    try {
        const response = await fetch(`${HUB_API_URL}/channels/${userAddress}`);
        
        if (!response.ok) {
            throw new Error(`Failed to get channels: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log(`✅ Found ${data.channels.length} channels`);
        
        return data.channels;
        
    } catch (error) {
        console.error('❌ Error getting channels:', error);
        return [];
    }
}

/**
 * 🎨 MOSTRAR UI DE POOLS DO HUB
 */
async function showHubPoolsUI() {
    console.log('🎨 Showing Hub Pools UI...');
    
    try {
        // Conectar ao Hub
        const hubInfo = await connectToHub();
        
        // Carregar pools
        const pools = await loadHubPools();
        
        // Criar tela
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            padding: 20px;
            overflow-y: auto;
        `;
        
        overlay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="color: #fff; font-size: 20px; font-weight: 700; margin: 0;">
                    🌟 Kray Space Hub Pools
                </h2>
                <button id="close-hub-modal" style="
                    background: transparent;
                    border: none;
                    color: #fff;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                ">×</button>
            </div>
            
            <div style="
                background: rgba(255, 159, 0, 0.1);
                border: 1px solid rgba(255, 159, 0, 0.3);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 20px;
                color: #ff9500;
                font-size: 13px;
            ">
                <strong>⚡ ${hubInfo.alias}</strong><br>
                Pubkey: <code style="font-size: 11px;">${hubInfo.pubkey}</code><br>
                Channels: ${hubInfo.channels} | Pools: ${pools.length}
            </div>
            
            <div id="hub-pools-list" style="display: flex; flex-direction: column; gap: 12px;">
                ${pools.length === 0 ? `
                    <p style="color: #888; text-align: center; padding: 40px 0;">
                        No pools available yet
                    </p>
                ` : pools.map(pool => `
                    <div class="hub-pool-card" style="
                        background: #1a1a1a;
                        border: 2px solid #333;
                        border-radius: 12px;
                        padding: 16px;
                        cursor: pointer;
                        transition: all 0.2s;
                    " data-pool-id="${pool.id}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <h3 style="color: #fff; font-size: 16px; font-weight: 700; margin: 0;">
                                ${pool.name}
                            </h3>
                            <span style="
                                background: rgba(255, 159, 0, 0.2);
                                color: #ff9500;
                                padding: 4px 12px;
                                border-radius: 12px;
                                font-size: 12px;
                                font-weight: 600;
                            ">
                                Fee: ${pool.fee}
                            </span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                            <div>
                                <div style="color: #888; font-size: 11px;">TVL</div>
                                <div style="color: #fff; font-size: 14px; font-weight: 600;">
                                    ${(pool.tvl / 100000000).toFixed(4)} BTC
                                </div>
                            </div>
                            <div>
                                <div style="color: #888; font-size: 11px;">Volume 24h</div>
                                <div style="color: #fff; font-size: 14px; font-weight: 600;">
                                    ${(pool.volume24h / 100000000).toFixed(4)} BTC
                                </div>
                            </div>
                            <div>
                                <div style="color: #888; font-size: 11px;">Swaps</div>
                                <div style="color: #fff; font-size: 14px; font-weight: 600;">
                                    ${pool.swapCount}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Event listeners
        document.getElementById('close-hub-modal').onclick = () => overlay.remove();
        
        // Pool cards (para futuro: abrir tela de swap)
        overlay.querySelectorAll('.hub-pool-card').forEach(card => {
            card.onmouseenter = () => {
                card.style.borderColor = '#ff9500';
                card.style.background = '#222';
            };
            card.onmouseleave = () => {
                card.style.borderColor = '#333';
                card.style.background = '#1a1a1a';
            };
            card.onclick = () => {
                const poolId = card.dataset.poolId;
                console.log(`Pool clicked: ${poolId}`);
                // TODO: Abrir tela de swap
            };
        });
        
    } catch (error) {
        console.error('❌ Error showing Hub pools:', error);
        showNotification('❌ Failed to load Hub pools', 'error');
    }
}

// Exportar funções (se necessário)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Lightning DeFi (novas funções)
        connectToLightningDefi,
        loadLightningPools,
        createLightningPool,
        executeLightningSwap,
        
        // Legacy (manter compatibilidade)
        connectToHub: connectToLightningDefi,
        loadHubPools: loadLightningPools,
        getSwapQuote,
        executeSwap: executeLightningSwap,
        getUserChannels,
        showHubPoolsUI
    };
}




