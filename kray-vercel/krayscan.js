// ============================================================================
// KRAYSCAN - Bitcoin Transaction & Address Explorer
// ============================================================================

// Get query params from URL
const urlParams = new URLSearchParams(window.location.search);
const txid = urlParams.get('txid');
const address = urlParams.get('address');
const inscriptionParam = urlParams.get('inscription');

// Global storage para children (para paginação)
window.allChildren = {};

// Auto-load se tiver txid, address ou inscription na URL
// 🔍 IMPORTANTE: Sempre manter barra de busca visível!
if (inscriptionParam) {
    document.getElementById('searchInput').value = inscriptionParam;
    loadInscription(inscriptionParam);
} else if (txid) {
    document.getElementById('searchInput').value = txid;
    loadTransaction(txid);
} else if (address) {
    document.getElementById('searchInput').value = address;
    loadAddress(address);
}

// ============================================================================
// SEARCH HANDLER
// ============================================================================

document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('searchInput').value.trim();

    if (!input) {
        showError('Please enter a transaction ID, address, or inscription ID');
        return;
    }

    // Detectar tipo de input
    if (/^[a-f0-9]{64}i\d+$/i.test(input)) {
        // É Inscription ID (64 hex + i + número)
        console.log('◉  Detected Inscription ID:', input);
        loadInscription(input);
    } else if (input.length === 64 && /^[a-f0-9]+$/i.test(input)) {
        // É TXID (64 hex chars)
        console.log('🔍 Detected TXID:', input);
        loadTransaction(input);
    } else if (input.startsWith('bc1') || input.startsWith('1') || input.startsWith('3')) {
        // É Address
        console.log('🔍 Detected Address:', input);
        loadAddress(input);
    } else {
        showError('Invalid input. Please enter a valid transaction ID, address, or inscription ID');
    }
});

// ============================================================================
// LOAD TRANSACTION
// ============================================================================

async function loadTransaction(txid) {
    try {
        console.log('🔍 Loading transaction:', txid);

        // Show loading
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error').style.display = 'none';
        document.getElementById('tx-content').style.display = 'none';
        document.getElementById('address-content').style.display = 'none';

        const response = await fetch(`/api/explorer/tx/${txid}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load transaction');
        }

        console.log('✅ Transaction data:', data);

        // Hide loading, show content
        document.getElementById('loading').style.display = 'none';
        document.getElementById('tx-content').style.display = 'block';

        // Update URL without reload
        const newUrl = `${window.location.pathname}?txid=${txid}`;
        window.history.pushState({ txid }, '', newUrl);

        // Render transaction
        renderTransaction(data);

    } catch (error) {
        console.error('❌ Error loading transaction:', error);
        document.getElementById('loading').style.display = 'none';
        showError(error.message);
    }
}

// ============================================================================
// LOAD INSCRIPTION
// ============================================================================

async function loadInscription(inscriptionId) {
    try {
        console.log('◉  Loading inscription:', inscriptionId);

        // Show loading
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error').style.display = 'none';
        document.getElementById('tx-content').style.display = 'none';
        document.getElementById('address-content').style.display = 'none';
        document.getElementById('inscription-content').style.display = 'none';

        const response = await fetch(`/api/explorer/inscription/${inscriptionId}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load inscription');
        }

        console.log('✅ Inscription data:', data);
        console.log('🧬 Family tree:', data.familyTree);

        // Hide loading, show content
        document.getElementById('loading').style.display = 'none';
        document.getElementById('inscription-content').style.display = 'block';

        // Update URL without reload
        const newUrl = `${window.location.pathname}?inscription=${inscriptionId}`;
        window.history.pushState({ inscription: inscriptionId }, '', newUrl);

        // Render inscription
        renderInscription(data.inscription, data.offer, data.familyTree);

    } catch (error) {
        console.error('❌ Error loading inscription:', error);
        document.getElementById('loading').style.display = 'none';
        showError(error.message);
    }
}

// ============================================================================
// LOAD ADDRESS
// ============================================================================

async function loadAddress(address) {
    try {
        console.log('🔍 Loading address:', address);

        // Show loading
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error').style.display = 'none';
        document.getElementById('tx-content').style.display = 'none';
        document.getElementById('address-content').style.display = 'none';

        const response = await fetch(`/api/explorer/address/${address}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load address');
        }

        console.log('✅ Address data:', data);

        // Hide loading, show content
        document.getElementById('loading').style.display = 'none';
        document.getElementById('address-content').style.display = 'block';

        // Update URL without reload
        const newUrl = `${window.location.pathname}?address=${address}`;
        window.history.pushState({ address }, '', newUrl);

        // Render address
        renderAddress(data);

    } catch (error) {
        console.error('❌ Error loading address:', error);
        document.getElementById('loading').style.display = 'none';
        showError(error.message);
    }
}

// ============================================================================
// RENDER TRANSACTION (Estilo Uniscan)
// ============================================================================

function renderTransaction(data) {
    const { tx, block, inscriptions, runes, analysis } = data;
    const container = document.getElementById('tx-content');

    let html = `
        <!-- TX Header (Estilo Uniscan) -->
        <div class="tx-header-uniscan">
            <div class="tx-header-top">
                <div class="tx-header-left">
                    <div class="tx-label">Transaction</div>
                    <div class="tx-hash-large">
                        ${tx.txid}
                        <a href="https://mempool.space/tx/${tx.txid}" target="_blank" class="mempool-button" title="View on Mempool.space">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                            Mempool.space
                        </a>
                    </div>
                    <div class="tx-badges">
                        ${analysis.confirmed ?
            `<span class="badge badge-success">✓ Confirmed</span>` :
            `<span class="badge badge-pending">⏳ Pending</span>`
        }
                        <span class="badge badge-info">${analysis.confirmations} confirmation${analysis.confirmations !== 1 ? 's' : ''}</span>
                        ${block ? `<span class="badge badge-info">Block #${block.height.toLocaleString()}</span>` : ''}
                    </div>
                </div>
            </div>
            
            <!-- TX Info Grid (Estilo Uniscan) -->
            <div class="tx-info-grid">
                <div class="tx-info-item">
                    <div class="tx-info-label">Fee</div>
                    <div class="tx-info-value">${analysis.fee.toLocaleString()} sats (${analysis.feeRate} sat/vB)</div>
                </div>
                <div class="tx-info-item">
                    <div class="tx-info-label">Size</div>
                    <div class="tx-info-value">${analysis.size} bytes (${analysis.vsize} vBytes)</div>
                </div>
                <div class="tx-info-item">
                    <div class="tx-info-label">Weight</div>
                    <div class="tx-info-value">${analysis.weight} WU</div>
                </div>
                ${block ? `
                <div class="tx-info-item">
                    <div class="tx-info-label">Block Time</div>
                    <div class="tx-info-value">${formatDate(new Date(block.time * 1000))}</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    // Activities Section (Estilo Uniscan)
    html += renderActivities(tx, inscriptions, runes);

    // Inputs & Outputs Section (Estilo Uniscan)
    html += renderInputsOutputs(tx);

    container.innerHTML = html;
}

// ============================================================================
// RENDER ACTIVITIES (Estilo Uniscan)
// ============================================================================

async function renderActivities(tx, inscriptions, runes) {
    let html = `
        <div class="activities-section">
            <div class="activities-header">
                <span>📋</span>
                Activities
            </div>
    `;

    // Runes Activities
    if (runes && runes.edicts && runes.edicts.length > 0) {
        // ✅ OTIMIZAÇÃO: Buscar TODAS as runes em PARALELO
        const runeDetailsPromises = runes.edicts.map(async (edict) => {
            let runeName = `Rune ${edict.runeId}`;
            let runeSymbol = '⧈';
            let runeThumbnail = null;
            let divisibility = 0;

            try {
                const runeResponse = await fetch(`/api/rune/${edict.runeId}`);
                if (runeResponse.ok) {
                    const runeData = await runeResponse.json();

                    runeName = runeData.name || runeName;
                    runeSymbol = runeData.symbol || runeSymbol;
                    divisibility = runeData.divisibility || 0;

                    if (runeData.parent) {
                        runeThumbnail = `/api/ordinals/${runeData.parent}/content`;
                    }
                }
            } catch (error) {
                console.error('Error fetching rune details:', error);
            }

            return { edict, runeName, runeSymbol, runeThumbnail, divisibility };
        });

        // Esperar TODAS as requisições terminarem
        const runeDetailsArray = await Promise.all(runeDetailsPromises);

        // Agora renderizar tudo
        for (const { edict, runeName, runeSymbol, runeThumbnail, divisibility } of runeDetailsArray) {
            const outputData = tx.vout[edict.output];
            const address = outputData?.scriptpubkey_address || 'N/A';
            const scriptPubKey = outputData?.scriptpubkey || outputData?.scriptPubKey?.hex || '';

            // Formatar amount com divisibility
            let formattedAmount = edict.amount.toString();
            if (divisibility > 0) {
                const rawAmount = parseFloat(edict.amount);
                const displayAmount = rawAmount / Math.pow(10, divisibility);
                formattedAmount = displayAmount.toLocaleString('en-US', {
                    minimumFractionDigits: divisibility,
                    maximumFractionDigits: divisibility
                });
            }

            html += `
                <div class="activity-card">
                    <div class="activity-type">
                        <span class="activity-type-icon">⧈</span>
                        ${runes.isCenotaph ? 'Runes Transfer (Cenotaph - Burned)' : 'Runes Transfer'}
                    </div>
                    <div class="activity-content">
                        ${runeThumbnail ? `
                            <div class="activity-thumbnail">
                                <img src="${runeThumbnail}" alt="${runeName}">
                            </div>
                        ` : ''}
                        <div class="activity-details">
                            <div class="activity-title">${runes.isCenotaph ? '🔥 ' : ''}${runeName} ${runeSymbol}</div>
                            <div class="activity-info-grid">
                                <div class="activity-info-item">
                                    <div class="activity-info-label">Amount</div>
                                    <div class="activity-info-value">${formattedAmount}</div>
                                </div>
                                <div class="activity-info-item">
                                    <div class="activity-info-label">Rune ID</div>
                                    <div class="activity-info-value">${edict.runeId}</div>
                                </div>
                                <div class="activity-info-item">
                                    <div class="activity-info-label">Output Index</div>
                                    <div class="activity-info-value">#${edict.output}</div>
                                </div>
                                <div class="activity-info-item">
                                    <div class="activity-info-label">To Address</div>
                                    <div class="activity-info-value">${formatAddress(address)}</div>
                                </div>
                                <div class="activity-info-item">
                                    <div class="activity-info-label">ScriptPubKey</div>
                                    <div class="activity-info-value">${scriptPubKey.substring(0, 20)}...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    // Inscriptions Activities
    if (inscriptions && inscriptions.length > 0) {
        for (const insc of inscriptions) {
            // Find output with this inscription
            let outputIndex = -1;
            let address = 'N/A';
            let scriptPubKey = '';

            for (let i = 0; i < tx.vout.length; i++) {
                const output = tx.vout[i];
                const script = output.scriptpubkey || output.scriptPubKey?.hex || '';

                // Check if this output likely contains the inscription
                if (output.value === 546 || output.value === 10000) {
                    outputIndex = i;
                    address = output.scriptpubkey_address || 'N/A';
                    scriptPubKey = script;
                    break;
                }
            }

            html += `
                <div class="activity-card">
                    <div class="activity-type">
                        <span class="activity-type-icon">◉</span>
                        Inscription Transfer
                    </div>
                    <div class="activity-content">
                        <div class="activity-thumbnail">
                            <img src="${insc.contentUrl}" alt="Inscription ${insc.inscriptionNumber}">
                        </div>
                        <div class="activity-details">
                            <div class="activity-title">Inscription #${insc.inscriptionNumber}</div>
                            <div class="activity-info-grid">
                                <div class="activity-info-item">
                                    <div class="activity-info-label">Inscription ID</div>
                                    <div class="activity-info-value">${insc.inscriptionId.substring(0, 20)}...</div>
                                </div>
                                ${outputIndex >= 0 ? `
                                <div class="activity-info-item">
                                    <div class="activity-info-label">Output Index</div>
                                    <div class="activity-info-value">#${outputIndex}</div>
                                </div>
                                <div class="activity-info-item">
                                    <div class="activity-info-label">To Address</div>
                                    <div class="activity-info-value">${formatAddress(address)}</div>
                                </div>
                                <div class="activity-info-item">
                                    <div class="activity-info-label">ScriptPubKey</div>
                                    <div class="activity-info-value">${scriptPubKey.substring(0, 20)}...</div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    html += `</div>`;

    return html;
}

// ============================================================================
// RENDER INPUTS & OUTPUTS (Estilo Uniscan)
// ============================================================================

function renderInputsOutputs(tx) {
    let html = `
        <!-- Inputs Section -->
        <div class="io-section">
            <div class="io-header">
                <span>📥 Inputs</span>
                <span class="io-count">${tx.vin.length} input${tx.vin.length !== 1 ? 's' : ''}</span>
        </div>
            <div class="io-list">
    `;

    // Render Inputs (Enriquecidos com Thumbnails!)
    tx.vin.forEach((input, index) => {
        const isCoinbase = input.coinbase !== undefined;

        if (isCoinbase) {
            html += `
                <div class="io-item">
                    <div class="io-item-header">
                        <span class="io-index">Input #${index}</span>
                        <span class="io-value-badge">New coins</span>
                    </div>
                    <div class="io-address-line">
                        <span class="io-address">⧈ Coinbase (Block Reward)</span>
                    </div>
                </div>
            `;
        } else {
            const prevout = input.prevout;
            const address = prevout?.scriptpubkey_address || 'Unknown';
            const value = prevout?.value || 0;
            const scriptPubKey = prevout?.scriptpubkey || prevout?.scriptPubKey?.hex || '';
            const enrichment = input.enrichment || { type: 'bitcoin', data: null };

            html += `
                <div class="io-item">
                    <div class="io-item-header">
                        <span class="io-index">Input #${index}</span>
                        <span class="io-value-badge">${formatBTC(value)}</span>
                    </div>
                    
                    ${enrichment.type === 'rune' ? `
                        <!-- RUNE INPUT -->
                        <div class="activity-content" style="margin-bottom: 12px;">
                            ${enrichment.data.thumbnail ? `
                                <div class="activity-thumbnail" style="width: 60px; height: 60px;">
                                    <img src="${enrichment.data.thumbnail}" alt="${enrichment.data.name}">
                                </div>
                            ` : ''}
                            <div style="flex: 1;">
                                <div style="font-size: 14px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px;">
                                    ⧈ ${enrichment.data.name} ${enrichment.data.symbol}
                                </div>
                                <div style="font-size: 12px; color: var(--color-text-secondary);">
                                    Amount: <strong style="color: var(--color-success);">${formatRuneAmount(enrichment.data.amount, enrichment.data.divisibility || 0)}</strong> | 
                                    Rune ID: ${enrichment.data.runeId}
                                </div>
                            </div>
                        </div>
                    ` : enrichment.type === 'inscription' ? `
                        <!-- INSCRIPTION INPUT -->
                        <div class="activity-content" style="margin-bottom: 12px;">
                            <div class="activity-thumbnail" style="width: 60px; height: 60px;">
                                <img src="${enrichment.data.contentUrl}" alt="Inscription">
                            </div>
                            <div style="flex: 1;">
                                <div style="font-size: 14px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px;">
                                    ◉ Inscription #${enrichment.data.inscriptionNumber}
                                </div>
                                <div style="font-size: 12px; color: var(--color-text-secondary);">
                                    ID: ${enrichment.data.inscriptionId.substring(0, 20)}...
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="io-address-line">
                        <span class="io-address">
                            <img src="/public/images/bitcoin.png" alt="Bitcoin" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">
                            ${address}
                        </span>
                        <button class="io-copy-btn" onclick="navigator.clipboard.writeText('${address}')">Copy</button>
                    </div>
                    ${input.txid ? `
                        <div class="io-script">
                            <div class="io-script-label">Previous Output</div>
                            <div class="io-script-content">${input.txid}:${input.vout}</div>
                        </div>
                    ` : ''}
                    ${scriptPubKey ? `
                        <div class="io-script">
                            <div class="io-script-label">ScriptPubKey</div>
                            <div class="io-script-content">${scriptPubKey}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    });

    html += `
            </div>
        </div>
        
        <!-- Outputs Section -->
        <div class="io-section">
            <div class="io-header">
                <span>📤 Outputs</span>
                <span class="io-count">${tx.vout.length} output${tx.vout.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="io-list">
    `;

    // Render Outputs (Enriquecidos com Thumbnails!)
    tx.vout.forEach((output, index) => {
        const script = output.scriptpubkey || output.scriptPubKey?.hex || '';
        const address = output.scriptpubkey_address || 'N/A';
        const value = output.value;
        const enrichment = output.enrichment || { type: 'bitcoin', data: null };

        // DEBUG: Log inscription outputs
        if (enrichment.type === 'inscription') {
            console.log(`✅ Output #${index} is INSCRIPTION:`, enrichment.data);
        }

        html += `
            <div class="io-item">
                <div class="io-item-header">
                    <span class="io-index">Output #${index}</span>
                    <span class="io-value-badge">${formatBTC(value)}</span>
                </div>
                
                ${enrichment.type === 'rune' ? `
                    <!-- RUNE OUTPUT -->
                    <div class="activity-content" style="margin-bottom: 12px;">
                        ${enrichment.data.thumbnail ? `
                            <div class="activity-thumbnail" style="width: 60px; height: 60px;">
                                <img src="${enrichment.data.thumbnail}" alt="${enrichment.data.name}">
                            </div>
                        ` : ''}
                        <div style="flex: 1;">
                            <div style="font-size: 14px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px;">
                                ${enrichment.data.isCenotaph ? '🔥 ' : ''}⧈ ${enrichment.data.name} ${enrichment.data.symbol}
                            </div>
                            <div style="font-size: 12px; color: var(--color-text-secondary);">
                                Amount: <strong style="color: var(--color-success);">${formatRuneAmount(enrichment.data.amount, enrichment.data.divisibility || 0)}</strong> | 
                                Rune ID: ${enrichment.data.runeId}
                            </div>
                        </div>
                    </div>
                    ${enrichment.data.inscription ? `
                        <!-- INSCRIPTION DENTRO DO RUNE -->
                        <div class="activity-content" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
                            <div class="activity-thumbnail" style="width: 60px; height: 60px;">
                                <img src="${enrichment.data.inscription.contentUrl}" 
                                     alt="Inscription #${enrichment.data.inscription.inscriptionNumber}"
                                     onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div style=&quot;display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:40px;&quot;>◉</div>';">
                            </div>
                            <div style="flex: 1;">
                                <div style="font-size: 14px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px;">
                                    ◉ Inscription #${enrichment.data.inscription.inscriptionNumber}
                                </div>
                                <div style="font-size: 12px; color: var(--color-text-secondary);">
                                    ID: ${enrichment.data.inscription.inscriptionId.substring(0, 20)}...
                                </div>
                            </div>
                        </div>
                    ` : ''}
                ` : enrichment.type === 'inscription' ? `
                    <!-- INSCRIPTION OUTPUT -->
                    <div id="inscription-output-${index}">
                        <div class="activity-content" style="margin-bottom: 12px;">
                            <div class="activity-thumbnail" style="width: 60px; height: 60px;">
                                <img src="${enrichment.data.contentUrl}" 
                                     alt="Inscription #${enrichment.data.inscriptionNumber}"
                                     onerror="this.onerror=null; this.src='${enrichment.data.preview || enrichment.data.contentUrl}'; if(!this.complete || this.naturalWidth===0) { this.style.display='none'; this.parentElement.innerHTML='<div style=&quot;display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:40px;&quot;>◉</div>'; }">
                            </div>
                            <div style="flex: 1;">
                                <div style="font-size: 14px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px;">
                                    ◉ Inscription #${enrichment.data.inscriptionNumber}
                                </div>
                                <div style="font-size: 12px; color: var(--color-text-secondary);">
                                    ID: ${enrichment.data.inscriptionId.substring(0, 20)}...
                                </div>
                            </div>
                        </div>
                    </div>
                ` : enrichment.type === 'op_return' ? `
                    <!-- OP_RETURN OUTPUT -->
                    <div class="io-address-line">
                        <span class="io-address" style="color: var(--color-warning); font-weight: 600;">
                            📜 OP_RETURN ${enrichment.data.decoded === 'Runestone' ? '(Runestone)' : '(Data)'}
                        </span>
                    </div>
                    ${enrichment.data.decoded === 'Runestone' ? `<div id="runestone-details-${index}" class="runestone-loading">⏳ Loading rune details...</div>` : ''}
                ` : `
                    <!-- BITCOIN OUTPUT -->
                    <div class="io-address-line">
                        <span class="io-address">
                            <img src="/public/images/bitcoin.png" alt="Bitcoin" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">
                            ${address}
                        </span>
                        <button class="io-copy-btn" onclick="navigator.clipboard.writeText('${address}')">Copy</button>
                    </div>
                `}
                
                ${script ? `
                    <div class="io-script">
                        <div class="io-script-label">ScriptPubKey</div>
                        <div class="io-script-content">${script}</div>
                    </div>
                ` : ''}
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    // 🎯 Carregar detalhes de Runestones e Inscriptions de forma assíncrona
    setTimeout(async () => {
        for (let i = 0; i < tx.vout.length; i++) {
            const output = tx.vout[i];
            const enrichment = output.enrichment || { type: 'bitcoin', data: null };
            const value = output.value;

            // Carregar Runestone details
            if (enrichment.type === 'op_return' && enrichment.data.decoded === 'Runestone') {
                const script = output.scriptpubkey || output.scriptPubKey?.hex || '';
                const detailsDiv = document.getElementById(`runestone-details-${i}`);

                if (detailsDiv) {
                    const detailsHtml = await decodeRunestoneDetails(enrichment.data.hex || script);
                    detailsDiv.innerHTML = detailsHtml;
                    detailsDiv.classList.remove('runestone-loading');
                }
            }

            // ✅ Inscriptions agora são detectadas automaticamente pela API
            // Não precisamos mais de verificação dinâmica por valor
        }
    }, 0);

    return html;
}

// ============================================================================
// LOAD INSCRIPTION DETAILS
// ============================================================================

async function loadInscriptionDetails(txid, vout) {
    try {
        console.log(`◉  Loading inscription for ${txid}:${vout}...`);

        // Buscar do ord server (API)
        const response = await fetch(`/api/output/${txid}:${vout}`);
        if (!response.ok) {
            return '<div style="color: var(--color-text-secondary); font-size: 12px;">No inscription found</div>';
        }

        const outputData = await response.json();

        // Verificar se tem inscriptions
        if (!outputData.inscriptions || outputData.inscriptions.length === 0) {
            return '<div style="color: var(--color-text-secondary); font-size: 12px;">No inscription found</div>';
        }

        const inscriptionId = outputData.inscriptions[0];
        console.log(`   ✅ Found inscription: ${inscriptionId}`);

        // Buscar detalhes da inscription
        const inscResponse = await fetch(`/api/ordinals/details/${inscriptionId}`);
        if (!inscResponse.ok) {
            return '<div style="color: var(--color-text-secondary); font-size: 12px;">Could not load inscription details</div>';
        }

        const inscData = await inscResponse.json();
        const inscription = inscData.inscription || inscData;

        // Extrair dados
        const inscriptionNumber = inscription.number || inscription.inscription_number || 'N/A';
        const contentType = inscription.content_type || 'unknown';

        // URL da preview/content
        const previewUrl = `/api/ordinals/${inscriptionId}/content`;
        const contentUrl = `/api/ordinals/${inscriptionId}/content`;

        return `
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; margin-top: 12px;">
                <div style="display: flex; gap: 16px; align-items: flex-start;">
                    <div style="width: 100px; height: 100px; border-radius: 8px; overflow: hidden; background: #000; border: 2px solid #9370DB; flex-shrink: 0;">
                        <iframe sandbox="allow-scripts" scrolling="no" loading="lazy" src="${previewUrl}" style="width: 100%; height: 100%; border: none;"></iframe>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 12px;">
                            ◉ Inscription #${inscriptionNumber}
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; font-size: 12px;">
                <div>
                                <div style="color: var(--color-text-tertiary); text-transform: uppercase; font-size: 10px; letter-spacing: 1px; margin-bottom: 4px;">Inscription ID</div>
                                <div style="color: var(--color-text-primary); font-family: var(--font-mono); font-weight: 500; word-break: break-all;">${inscriptionId.substring(0, 20)}...</div>
                            </div>
                            <div>
                                <div style="color: var(--color-text-tertiary); text-transform: uppercase; font-size: 10px; letter-spacing: 1px; margin-bottom: 4px;">Content Type</div>
                                <div style="color: var(--color-text-primary); font-family: var(--font-mono); font-weight: 500;">${contentType}</div>
                            </div>
                            <div>
                                <div style="color: var(--color-text-tertiary); text-transform: uppercase; font-size: 10px; letter-spacing: 1px; margin-bottom: 4px;">Actions</div>
                                <div>
                                    <a href="${contentUrl}" target="_blank" style="color: var(--color-accent); text-decoration: none; font-size: 11px; font-weight: 600;">View Full →</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading inscription:', error);
        return '<div style="color: var(--color-text-secondary); font-size: 12px;">Failed to load inscription</div>';
    }
}

// ============================================================================
// DECODE RUNESTONE DETAILS
// ============================================================================

async function decodeRunestoneDetails(scriptHex) {
    try {
        console.log('🔍 Decoding Runestone from script:', scriptHex);

        // Remover 6a5d (OP_RETURN + OP_PUSHNUM_13) e o length byte
        const payload = scriptHex.substring(6);
        console.log('   Payload:', payload);

        // Converter hex para bytes
        const buffer = [];
        for (let i = 0; i < payload.length; i += 2) {
            buffer.push(parseInt(payload.substring(i, i + 2), 16));
        }

        // Decodificar LEB128
        function decodeLEB128(bytes, offset = 0) {
            let result = 0;
            let shift = 0;
            let i = offset;

            while (i < bytes.length) {
                const byte = bytes[i++];
                result |= (byte & 0x7F) << shift;
                shift += 7;

                if (!(byte & 0x80)) {
                    break;
                }
            }

            return { value: result, nextOffset: i };
        }

        // Decodificar valores
        let offset = 0;
        const values = [];
        while (offset < buffer.length && values.length < 6) {
            const decoded = decodeLEB128(buffer, offset);
            values.push(decoded.value);
            offset = decoded.nextOffset;
        }

        console.log('   Decoded values:', values);

        if (values.length < 3) {
            return '<div style="color: var(--color-text-secondary); font-size: 12px;">Invalid Runestone</div>';
        }

        const tag = values[0];
        console.log('   Tag:', tag);

        // Determinar tipo de operação
        let operationType = 'Unknown';
        let tagBadge = '';
        let isCenotaph = false;

        if (tag === 0) {
            operationType = 'Transfer (Edicts)';
            tagBadge = '<span class="badge badge-success">✓ Transfer</span>';
        } else if (tag === 10) {
            operationType = 'Cenotaph (BURNED)';
            tagBadge = '<span class="badge" style="background: rgba(255, 59, 48, 0.15); color: #ff3b30;">🔥 Cenotaph</span>';
            isCenotaph = true;
        } else if (tag === 4) {
            operationType = 'Etching (New Rune)';
            tagBadge = '<span class="badge badge-info">🎨 Etching</span>';
        } else if (tag === 6) {
            operationType = 'Mint';
            tagBadge = '<span class="badge badge-info">⚡ Mint</span>';
        } else {
            operationType = `Unknown (Tag ${tag})`;
            tagBadge = `<span class="badge badge-info">Tag ${tag}</span>`;
        }

        // Extrair Rune ID e Amount
        let runeId = 'N/A';
        let amount = 'N/A';
        let outputIndex = 'N/A';

        if (isCenotaph && values.length >= 5) {
            // Cenotaph: valores deslocados
            runeId = `${values[2]}:${values[3]}`;
            amount = values[4].toString();
            outputIndex = values[5] || 'N/A';
        } else if (tag === 0 && values.length >= 5) {
            // Transfer normal
            runeId = `${values[1]}:${values[2]}`;
            amount = values[3].toString();
            outputIndex = values[4];
        }

        // 🎯 Buscar nome, thumbnail e divisibility da rune pelo Rune ID
        let runeName = null;
        let runeSymbol = '⧈';
        let runeThumbnail = null;
        let divisibility = 0;

        if (runeId !== 'N/A') {
            try {
                console.log(`   🔍 Fetching rune details for ${runeId}...`);
                const runeResponse = await fetch(`/api/rune/${runeId}`);
                if (runeResponse.ok) {
                    const runeData = await runeResponse.json();

                    runeName = runeData.name || runeName;
                    console.log(`   ✅ Found rune name: ${runeName}`);

                    runeSymbol = runeData.symbol || runeSymbol;

                    divisibility = runeData.divisibility || 0;
                    console.log(`   ✅ Found divisibility: ${divisibility}`);

                    if (runeData.parent) {
                        runeThumbnail = `/api/ordinals/${runeData.parent}/content`;
                        console.log(`   ✅ Found thumbnail: ${runeThumbnail}`);
                    }
                }
            } catch (error) {
                console.warn(`   ⚠️  Could not fetch rune details:`, error);
            }
        }

        // 💰 Formatar amount com divisibility
        let formattedAmount = amount;
        if (amount !== 'N/A' && divisibility > 0) {
            const rawAmount = parseFloat(amount);
            const displayAmount = rawAmount / Math.pow(10, divisibility);
            formattedAmount = displayAmount.toLocaleString('en-US', {
                minimumFractionDigits: divisibility,
                maximumFractionDigits: divisibility
            });
            console.log(`   💰 Formatted amount: ${amount} (raw) → ${formattedAmount} (display with ${divisibility} decimals)`);
        }

        return `
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; margin-top: 12px;">
                <div style="display: flex; gap: 16px; margin-bottom: 12px; align-items: flex-start;">
                    ${runeThumbnail ? `
                        <div style="width: 80px; height: 80px; border-radius: 8px; overflow: hidden; background: #000; border: 2px solid #FFD700; flex-shrink: 0;">
                            <img src="${runeThumbnail}" alt="${runeName || 'Rune'}" style="width: 100%; height: 100%; object-fit: contain;">
                        </div>
                    ` : ''}
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; align-items: center;">
                            ${tagBadge}
                            <span style="font-size: 13px; color: var(--color-text-secondary);">
                                <strong>Operation:</strong> ${operationType}
                            </span>
                        </div>
                        ${runeName ? `
                            <div style="font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 12px;">
                                ⧈ ${runeName} ${runeSymbol}
                            </div>
                        ` : ''}
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; font-size: 12px;">
                            <div>
                                <div style="color: var(--color-text-tertiary); text-transform: uppercase; font-size: 10px; letter-spacing: 1px; margin-bottom: 4px;">Rune ID</div>
                                <div style="color: var(--color-text-primary); font-family: var(--font-mono); font-weight: 500;">${runeId}</div>
                            </div>
                            <div>
                                <div style="color: var(--color-text-tertiary); text-transform: uppercase; font-size: 10px; letter-spacing: 1px; margin-bottom: 4px;">Amount</div>
                                <div style="color: var(--color-success); font-family: var(--font-mono); font-weight: 600;">${formattedAmount}</div>
                            </div>
                            <div>
                                <div style="color: var(--color-text-tertiary); text-transform: uppercase; font-size: 10px; letter-spacing: 1px; margin-bottom: 4px;">Output Index</div>
                                <div style="color: var(--color-text-primary); font-family: var(--font-mono); font-weight: 500;">${outputIndex}</div>
                            </div>
                            <div>
                                <div style="color: var(--color-text-tertiary); text-transform: uppercase; font-size: 10px; letter-spacing: 1px; margin-bottom: 4px;">Tag</div>
                                <div style="color: var(--color-text-primary); font-family: var(--font-mono); font-weight: 500;">${tag}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error decoding Runestone:', error);
        return '<div style="color: var(--color-danger); font-size: 12px;">Failed to decode Runestone</div>';
    }
}

// ============================================================================
// RENDER FAMILY TREE HELPERS
// ============================================================================

function renderAncestorsTree(ancestors, currentInscriptionId) {
    if (!ancestors || ancestors.length === 0) return '';

    // Agrupar por geração (usando Set para evitar duplicatas)
    const byGeneration = {
        greatGrandparents: new Set(),
        grandparents: new Set(),
        parents: new Set()
    };

    function processAncestor(ancestor) {
        if (ancestor.generation === 1) {
            byGeneration.parents.add(ancestor.id);
        } else if (ancestor.generation === 2) {
            byGeneration.grandparents.add(ancestor.id);
        } else if (ancestor.generation === 3) {
            byGeneration.greatGrandparents.add(ancestor.id);
        }

        // Processar ancestrais recursivamente
        if (ancestor.ancestors && ancestor.ancestors.length > 0) {
            ancestor.ancestors.forEach(processAncestor);
        }
    }

    ancestors.forEach(processAncestor);

    // Converter Sets para Arrays
    const greatGrandparentsArray = Array.from(byGeneration.greatGrandparents);
    const grandparentsArray = Array.from(byGeneration.grandparents);
    const parentsArray = Array.from(byGeneration.parents);

    let html = '';

    // Great-Grandparents (Bisavós)
    if (greatGrandparentsArray.length > 0) {
        html += `
            <div class="family-level">
                <div class="level-label">👵👴 Great-Grandparents (${greatGrandparentsArray.length})</div>
                <div class="family-grid">
                    ${greatGrandparentsArray.slice(0, 8).map(id => `
                        <a href="/krayscan.html?inscription=${id}" class="family-node parent-node">
                            <div class="family-node-preview">
                                <iframe sandbox="allow-scripts" scrolling="no" loading="lazy" src="/api/ordinals/${id}/content" style="width: 100%; height: 100%; border: none; pointer-events: none;"></iframe>
                    </div>
                            <div class="family-node-id">${id.substring(0, 8)}...${id.substring(id.length - 4)}</div>
                        </a>
                    `).join('')}
                    ${greatGrandparentsArray.length > 8 ? `
                        <div class="family-node more-node">
                            <div class="family-node-preview">
                                <div class="more-count">+${greatGrandparentsArray.length - 8}</div>
                                <div class="more-label">more</div>
                </div>
                    </div>
                    ` : ''}
                    </div>
                    </div>
        `;
    }

    // Grandparents (Avós)
    if (grandparentsArray.length > 0) {
        html += `
            <div class="family-level">
                <div class="level-label">👴 Grandparents (${grandparentsArray.length})</div>
                <div class="family-grid">
                    ${grandparentsArray.slice(0, 8).map(id => `
                        <a href="/krayscan.html?inscription=${id}" class="family-node parent-node">
                            <div class="family-node-preview">
                                <iframe sandbox="allow-scripts" scrolling="no" loading="lazy" src="/api/ordinals/${id}/content" style="width: 100%; height: 100%; border: none; pointer-events: none;"></iframe>
                    </div>
                            <div class="family-node-id">${id.substring(0, 8)}...${id.substring(id.length - 4)}</div>
                        </a>
                    `).join('')}
                    ${grandparentsArray.length > 8 ? `
                        <div class="family-node more-node">
                            <div class="family-node-preview">
                                <div class="more-count">+${grandparentsArray.length - 8}</div>
                                <div class="more-label">more</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Parents
    if (parentsArray.length > 0) {
        html += `
            <div class="family-level">
                <div class="level-label">👴 Parents (${parentsArray.length})</div>
                <div class="family-grid">
                    ${parentsArray.slice(0, 8).map(id => `
                        <a href="/krayscan.html?inscription=${id}" class="family-node parent-node">
                            <div class="family-node-preview">
                                <iframe sandbox="allow-scripts" scrolling="no" loading="lazy" src="/api/ordinals/${id}/content" style="width: 100%; height: 100%; border: none; pointer-events: none;"></iframe>
                            </div>
                            <div class="family-node-id">${id.substring(0, 8)}...${id.substring(id.length - 4)}</div>
                        </a>
                    `).join('')}
                    ${parentsArray.length > 8 ? `
                        <div class="family-node more-node">
                            <div class="family-node-preview">
                                <div class="more-count">+${parentsArray.length - 8}</div>
                                <div class="more-label">more</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    return html;
}

function renderDescendantsTree(descendants, currentInscriptionId) {
    if (!descendants || descendants.length === 0) return '';

    // Agrupar por geração (usando Set para evitar duplicatas)
    const byGeneration = {
        children: new Set(),
        grandchildren: new Set()
    };

    function processDescendant(descendant) {
        if (descendant.generation === 1) {
            byGeneration.children.add(descendant.id);
        } else if (descendant.generation === 2) {
            byGeneration.grandchildren.add(descendant.id);
        }

        // Processar descendentes recursivamente
        if (descendant.descendants && descendant.descendants.length > 0) {
            descendant.descendants.forEach(processDescendant);
        }
    }

    descendants.forEach(processDescendant);

    // Converter Sets para Arrays
    const grandchildrenArray = Array.from(byGeneration.grandchildren);

    let html = '';

    // Grandchildren (Netos)
    if (grandchildrenArray.length > 0) {
        html += `
            <div class="family-level">
                <div class="level-label">👶👶 Grandchildren (${grandchildrenArray.length})</div>
                <div class="children-mosaic">
                    ${grandchildrenArray.slice(0, 44).map(id => `
                        <a href="/krayscan.html?inscription=${id}" class="family-node child-node">
                            <div class="family-node-preview">
                                <iframe sandbox="allow-scripts" scrolling="no" loading="lazy" src="/api/ordinals/${id}/content" style="width: 100%; height: 100%; border: none; pointer-events: none;"></iframe>
                            </div>
                            <div class="family-node-id">${id.substring(0, 8)}...${id.substring(id.length - 4)}</div>
                        </a>
                    `).join('')}
                    ${grandchildrenArray.length > 44 ? `
                        <div class="family-node more-node">
                            <div class="family-node-preview">
                                <div class="more-count">+${grandchildrenArray.length - 44}</div>
                                <div class="more-label">more</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    return html;
}

// ============================================================================
// RENDER INSCRIPTION
// ============================================================================

function renderInscription(inscription, offer = null, familyTree = null) {
    const container = document.getElementById('inscription-content');

    // Guardar children globalmente para paginação
    if (inscription.children && inscription.children.length > 0) {
        window.allChildren[inscription.inscriptionId] = inscription.children;
    }

    // Processar árvore genealógica
    const ancestors = familyTree?.ancestors || [];
    const descendants = familyTree?.descendants || [];

    let html = `
        <!-- Inscription Header -->
        <div class="tx-header-uniscan">
            <div class="tx-header-top">
                <div class="tx-header-left">
                    <div class="tx-label">Inscription</div>
                    <div class="tx-hash-large">
                        #${inscription.inscriptionNumber || 'N/A'}
                        ${inscription.charms.length > 0 ? `<div style="display: inline; margin-left: 12px;">${inscription.charms.join(' ')}</div>` : ''}
        </div>
                    <div class="tx-badges">
                        <span class="badge badge-info">${inscription.contentType || 'unknown'}</span>
                        ${inscription.contentLength ? `<span class="badge badge-info">${inscription.contentLength}</span>` : ''}
                        ${offer ? `<span class="badge badge-success">💰 FOR SALE</span>` : ''}
                    </div>
                </div>
            </div>
        </div>

        <!-- Buy Now Button (se tiver oferta) -->
        ${offer ? `
            <div style="margin-bottom: var(--spacing-2xl);">
                <a href="/offer.html?id=${offer.offerId}" class="buy-now-button">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    <div>
                        <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Buy Now</div>
                        <div style="font-size: 20px; font-weight: 800;">${(offer.price / 100000000).toFixed(8)} BTC</div>
                        <div style="font-size: 11px; opacity: 0.7;">${offer.price.toLocaleString()} sats</div>
                    </div>
                </a>
            </div>
        ` : ''}

        <!-- Main Content -->
        <div style="display: grid; grid-template-columns: 1fr 400px; gap: var(--spacing-2xl); margin-bottom: var(--spacing-2xl);">
            <!-- Content Preview (Esquerda) -->
            <div class="io-section">
                <div class="io-header">
                    <span>◉ Preview</span>
                </div>
                <div style="background: #000; border-radius: var(--radius-lg); overflow: hidden; min-height: 400px; display: flex; align-items: center; justify-content: center;">
                    <iframe sandbox="allow-scripts" scrolling="no" loading="lazy" src="${inscription.preview}" style="width: 100%; height: 600px; border: none;"></iframe>
                </div>
                <div style="margin-top: var(--spacing-lg); display: flex; gap: var(--spacing-md);">
                    <a href="${inscription.content}" target="_blank" class="mempool-button">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        View Full Content
                    </a>
                    <a href="${inscription.preview}" target="_blank" class="mempool-button">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        Open Preview
                    </a>
                </div>
            </div>

            <!-- Details (Direita) -->
            <div class="io-section">
                <div class="io-header">
                    <span>📋 Details</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: var(--spacing-lg);">
                    ${createDetailRow('Inscription ID', inscription.inscriptionId, true)}
                    ${createDetailRow('Address', inscription.address, false, inscription.address)}
                    ${createDetailRow('Output Value', inscription.outputValue ? `${inscription.outputValue.toLocaleString()} sats` : 'N/A')}
                    ${createDetailRow('Sat', inscription.sat || 'N/A')}
                    ${createDetailRow('Sat Name', inscription.satName || 'N/A')}
                    ${createDetailRow('Content Type', inscription.contentType || 'N/A')}
                    ${createDetailRow('Content Length', inscription.contentLength || 'N/A')}
                    ${createDetailRow('Timestamp', inscription.timestamp || 'N/A')}
                    ${createDetailRow('Genesis Height', inscription.genesisHeight ? `#${inscription.genesisHeight.toLocaleString()}` : 'N/A')}
                    ${createDetailRow('Genesis Fee', inscription.genesisFee ? `${inscription.genesisFee.toLocaleString()} sats` : 'N/A')}
                    ${createDetailRow('Reveal TX', inscription.genesisTx, true, null, inscription.genesisTx)}
                    ${createDetailRow('Location', inscription.location, true)}
                    ${createDetailRow('Output', inscription.output, true)}
                    ${createDetailRow('Offset', inscription.offset !== null ? inscription.offset : 'N/A')}
                    ${inscription.ethereumTeleburnAddress ? createDetailRow('Ethereum Teleburn', inscription.ethereumTeleburnAddress, true) : ''}
                </div>
            </div>
        </div>

        <!-- Family Tree / Relationships -->
        ${(inscription.parents.length > 0 || inscription.childrenCount > 0 || ancestors.length > 0 || descendants.length > 0) ? `
            <div class="io-section">
                <div class="io-header">
                    <span>🧬 Family Tree</span>
                </div>
                <div class="family-tree">
                    ${renderAncestorsTree(ancestors, inscription.inscriptionId)}
                    ${inscription.parents.length > 0 && ancestors.length === 0 ? `
                        <div class="family-level">
                            <div class="level-label">👴 Parents (${inscription.parents.length})</div>
                            <div class="family-grid">
                                ${inscription.parents.slice(0, 6).map((parentId, index) => `
                                    <a href="/krayscan.html?inscription=${parentId}" class="family-node parent-node">
                                        <div class="family-node-preview">
                                            <iframe sandbox="allow-scripts" scrolling="no" loading="lazy" src="/api/ordinals/${parentId}/content" style="width: 100%; height: 100%; border: none; pointer-events: none;"></iframe>
                                        </div>
                                        <div class="family-node-id">${parentId.substring(0, 8)}...${parentId.substring(parentId.length - 4)}</div>
                                    </a>
                                `).join('')}
                                ${inscription.parents.length > 6 ? `
                                    <div class="family-node more-node">
                                        <div class="more-count">+${inscription.parents.length - 6}</div>
                                        <div class="more-label">more parents</div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="family-level current-level">
                        <div class="level-label">📍 Current Inscription</div>
                        <div class="family-grid" style="justify-content: center;">
                            <div class="family-node current-node">
                                <div class="family-node-preview large">
                                    <iframe sandbox="allow-scripts" scrolling="no" loading="lazy" src="${inscription.preview}" style="width: 100%; height: 100%; border: none; pointer-events: none;"></iframe>
                                </div>
                                <div class="family-node-id">#${inscription.inscriptionNumber}</div>
                            </div>
                        </div>
                    </div>
                    
                    ${inscription.childrenCount > 0 ? `
                        <div class="family-level">
                            <div class="level-label">👶 Children (${inscription.childrenCount})</div>
                            ${inscription.children && inscription.children.length > 0 ? `
                                <div class="children-mosaic" id="children-mosaic-${inscription.inscriptionId}">
                                    ${inscription.children.slice(0, 44).map((childId, index) => `
                                        <a href="/krayscan.html?inscription=${childId}" class="family-node child-node">
                                            <div class="family-node-preview">
                                                <iframe sandbox="allow-scripts" scrolling="no" loading="lazy" src="/api/ordinals/${childId}/content" style="width: 100%; height: 100%; border: none; pointer-events: none;"></iframe>
                                            </div>
                                            <div class="family-node-id">${childId.substring(0, 8)}...${childId.substring(childId.length - 4)}</div>
                                        </a>
                                    `).join('')}
                                    ${inscription.children.length > 44 ? `
                                        <button class="family-node more-node load-more-btn" 
                                                onclick="loadMoreChildren('${inscription.inscriptionId}', 44)"
                                                data-inscription-id="${inscription.inscriptionId}"
                                                data-loaded="44">
                                            <div class="family-node-preview">
                                                <div class="more-count">+${inscription.children.length - 44}</div>
                                                <div class="more-label">load more</div>
                                            </div>
                                        </button>
                                    ` : ''}
                                </div>
                            ` : `
                                <div class="family-grid">
                                    <div class="family-node child-node">
                                        <div class="family-node-preview">
                                            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-secondary); font-size: 24px;">
                                                👶
                                            </div>
                                        </div>
                                        <div class="family-node-id">${inscription.childrenCount} ${inscription.childrenCount === 1 ? 'child' : 'children'}</div>
                                    </div>
                                </div>
                            `}
                        </div>
                    ` : ''}
                    
                    ${renderDescendantsTree(descendants, inscription.inscriptionId)}
                </div>
            </div>
        ` : ''}
    `;

    container.innerHTML = html;
}

// ============================================================================
// LOAD MORE CHILDREN (Paginação)
// ============================================================================

function loadMoreChildren(inscriptionId, currentLoaded) {
    const allChildrenForInscription = window.allChildren[inscriptionId];

    if (!allChildrenForInscription) {
        console.error('No children data found for:', inscriptionId);
        return;
    }

    const container = document.getElementById(`children-mosaic-${inscriptionId}`);
    const loadMoreBtn = container.querySelector('.load-more-btn');

    if (!loadMoreBtn) {
        console.error('Load more button not found');
        return;
    }

    const currentLoadedCount = parseInt(loadMoreBtn.getAttribute('data-loaded'));
    const nextBatch = allChildrenForInscription.slice(currentLoadedCount, currentLoadedCount + 44);
    const newLoadedCount = currentLoadedCount + nextBatch.length;

    console.log(`Loading ${nextBatch.length} more children (${newLoadedCount}/${allChildrenForInscription.length})`);

    // Criar HTML para os novos children
    const newChildrenHtml = nextBatch.map(childId => `
        <a href="/krayscan.html?inscription=${childId}" class="family-node child-node">
            <div class="family-node-preview">
                <iframe sandbox="allow-scripts" scrolling="no" loading="lazy" src="/api/ordinals/${childId}/content" style="width: 100%; height: 100%; border: none; pointer-events: none;"></iframe>
            </div>
            <div class="family-node-id">${childId.substring(0, 8)}...${childId.substring(childId.length - 4)}</div>
        </a>
    `).join('');

    // Inserir antes do botão "load more"
    loadMoreBtn.insertAdjacentHTML('beforebegin', newChildrenHtml);

    // Atualizar o botão
    loadMoreBtn.setAttribute('data-loaded', newLoadedCount);

    const remaining = allChildrenForInscription.length - newLoadedCount;
    if (remaining > 0) {
        loadMoreBtn.querySelector('.more-count').textContent = `+${remaining}`;
    } else {
        // Remover botão se não houver mais children
        loadMoreBtn.remove();
    }
}

// Helper function para criar linhas de detalhes
function createDetailRow(label, value, mono = false, copyValue = null, linkTxid = null) {
    const isLink = copyValue !== null;
    const displayValue = mono ? value : value;

    return `
        <div style="border-bottom: 1px solid var(--color-border); padding-bottom: var(--spacing-md);">
            <div style="color: var(--color-text-tertiary); text-transform: uppercase; font-size: 10px; letter-spacing: 1px; margin-bottom: 4px;">${label}</div>
            <div style="color: var(--color-text-primary); font-size: 13px; ${mono ? 'font-family: var(--font-mono);' : ''} word-break: break-all; display: flex; align-items: center; gap: var(--spacing-sm);">
                ${linkTxid ? `<a href="/krayscan.html?txid=${linkTxid}" style="color: var(--color-accent); text-decoration: none;">${displayValue}</a>` : displayValue}
                ${copyValue ? `<button onclick="navigator.clipboard.writeText('${copyValue}')" class="io-copy-btn" style="flex-shrink: 0;">Copy</button>` : ''}
            </div>
        </div>
    `;
}

// ============================================================================
// HELPER FUNCTION - Format Address
// ============================================================================

function formatAddress(address) {
    if (!address || address === 'N/A' || address === 'Unknown') return address;
    if (address.length <= 20) return address;
    return `${address.substring(0, 10)}...${address.substring(address.length - 10)}`;
}

// ============================================================================
// RENDER ADDRESS
// ============================================================================

function renderAddress(data) {
    const { address, bitcoin, utxos, inscriptions, runes, transactions } = data;
    const container = document.getElementById('address-content');

    let html = `
        <!-- Address Header -->
        <div class="content-header">
            <div class="content-label">Bitcoin Address</div>
            <div class="content-hash">${address}</div>
        </div>

        <!-- Bitcoin Balance -->
        <div class="balance-card">
            <div class="balance-amount">${formatBTC(bitcoin.total)}</div>
            <div class="balance-label">Total Balance</div>
            ${bitcoin.unconfirmed !== 0 ? `
                <div style="margin-top: var(--spacing-md); font-size: 12px; color: var(--color-text-tertiary);">
                    Confirmed: ${formatBTC(bitcoin.confirmed)} | Unconfirmed: ${formatBTC(bitcoin.unconfirmed)}
                </div>
            ` : ''}
        </div>
    `;

    // Runes Section
    if (runes && runes.length > 0) {
        html += `
            <div class="runestone-section">
                <div class="section-title">⧈ Runes (${runes.length})</div>
                <div class="runes-grid">
        `;

        for (const rune of runes) {
            html += `
                <div class="rune-card">
                    <div class="rune-header">
                        ${rune.thumbnail ? `
                            <img src="${rune.thumbnail}" class="rune-thumbnail" alt="${rune.name}">
                        ` : ''}
                        <div class="rune-info">
                            <div class="rune-name">${rune.displayName || rune.name}</div>
                            <div class="rune-amount">${rune.amount}</div>
                        </div>
                    </div>
                    <div style="font-size: 12px; color: var(--color-text-tertiary);">
                        ${rune.utxos?.length || 0} UTXO(s)
                    </div>
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;
    }

    // Inscriptions Section
    if (inscriptions && inscriptions.length > 0) {
        html += `
            <div class="inscriptions-section">
                <div class="card-title">◉ Inscriptions (${inscriptions.length})</div>
        <div class="inscriptions-grid">
    `;

        for (const insc of inscriptions) {
            html += `
            <div class="inscription-card" onclick="window.open('${insc.inscriptionUrl}', '_blank')">
                <div class="inscription-preview">
                        <img src="${insc.contentUrl}" alt="Inscription ${insc.id}">
                </div>
                <div class="inscription-info">
                        <div class="inscription-number">${insc.id.substring(0, 10)}...</div>
                </div>
            </div>
        `;
        }

        html += `
                </div>
        </div>
    `;
    }

    // UTXOs Section
    if (utxos && utxos.length > 0) {
        html += `
            <div class="list-section">
                <div class="card-title">📦 UTXOs (${utxos.length})</div>
                <div class="list-items">
        `;

        utxos.forEach((utxo, index) => {
            html += `
                <div class="list-item" onclick="window.location.href='krayscan.html?txid=${utxo.txid}'">
                    <div class="item-index">UTXO #${index + 1}</div>
                    <div class="item-content">${utxo.txid}:${utxo.vout}</div>
                    <div class="item-value">${formatBTC(utxo.value)}</div>
                    <div class="item-script">
                        Status: ${utxo.status?.confirmed ? `✓ Confirmed (Block ${utxo.status.block_height})` : '⏳ Pending'}
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    }

    // Transaction History Section
    if (transactions && transactions.length > 0) {
        html += `
            <div class="list-section">
                <div class="card-title">📜 Recent Transactions (${transactions.length})</div>
                <div class="list-items">
        `;

        transactions.forEach((tx, index) => {
            html += `
                <div class="list-item" onclick="window.location.href='krayscan.html?txid=${tx.txid}'">
                    <div class="item-index">TX #${index + 1}</div>
                    <div class="item-content">${tx.txid}</div>
                    <div class="item-value">Fee: ${tx.fee.toLocaleString()} sats</div>
                    <div class="item-script">
                        ${tx.confirmed ?
                    `✓ Confirmed (Block ${tx.blockHeight.toLocaleString()}) - ${formatDate(new Date(tx.blockTime * 1000))}` :
                    '⏳ Pending'}
                    </div>
                </div>
            `;
        });

        html += `
                        </div>
                </div>
            `;
    }

    container.innerHTML = html;
}

// ============================================================================
// HELPER FUNCTIONS - RUNESTONE
// ============================================================================

function renderRunestone(runes) {
    let html = `
        <div class="runestone-section">
            <div class="section-title">
            <span>⧈</span>
            Runestone
        </div>
    `;

    // Cenotaph warning
    if (runes.isCenotaph) {
        html += `
            <div class="cenotaph-warning">
                <span style="font-size: 24px;">🔥</span>
                <div>
                    <strong>Cenotaph Detected</strong><br>
                    <small>This Runestone is invalid (Tag ${runes.tag || 'unknown'}). Runes were burned.</small>
                </div>
            </div>
        `;
    }

    // Edicts (simplified - full rendering would need async calls)
    html += `<div style="color: var(--color-text-secondary); font-size: 14px;">`;
    html += `Found ${runes.edicts.length} edict(s) in this transaction.`;
    html += `</div>`;

    html += `</div>`;

    return html;
}

function renderInscriptionsSection(inscriptions) {
    let html = `
        <div class="inscriptions-section">
        <div class="card-title">
            <span>◉</span>
            Inscriptions (${inscriptions.length})
        </div>
        <div class="inscriptions-grid">
    `;

    for (const insc of inscriptions) {
        html += `
            <div class="inscription-card" onclick="window.open('${insc.inscriptionUrl}', '_blank')">
                <div class="inscription-preview">
                    <img src="${insc.contentUrl}" alt="Inscription ${insc.inscriptionNumber}">
                </div>
                <div class="inscription-info">
                    <div class="inscription-number">#${insc.inscriptionNumber}</div>
                </div>
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    return html;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// 💰 Formatar amount de rune com divisibility
function formatRuneAmount(rawAmount, divisibility = 0) {
    let amount = parseFloat(rawAmount);

    // Proteção: converter negativos em positivos (bug do decoder)
    if (amount < 0) {
        amount = Math.abs(amount);
    }

    // Aplicar divisibility (dividir por 10^divisibility)
    const displayAmount = amount / Math.pow(10, divisibility);

    // Mostrar com as casas decimais apropriadas
    // Remove zeros à direita mas mantém pelo menos 2 decimais se divisibility > 0
    if (divisibility === 0) {
        // Sem divisibility, mostra como inteiro
        return displayAmount.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    } else {
        // Com divisibility, mostra com decimais (remove zeros à direita)
        return displayAmount.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: divisibility
        });
    }
}

function formatBTC(sats) {
    if (sats === 0) return '0 sats';

    const btc = (sats / 100000000).toFixed(8);

    if (sats >= 100000000) {
        return `${btc} BTC`;
    } else if (sats >= 1000) {
        return `${sats.toLocaleString()} sats`;
    } else {
        return `${sats} sats`;
    }
}

function formatAmount(amount) {
    const num = parseInt(amount);
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toLocaleString();
}

function formatDate(date) {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('error-message').textContent = message;
    document.getElementById('tx-content').style.display = 'none';
    document.getElementById('address-content').style.display = 'none';
}
