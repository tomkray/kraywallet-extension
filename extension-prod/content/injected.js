/**
 * 🔥 KrayWallet Extension - Injected Script
 * Cria window.krayWallet API (compatível com Unisat)
 */

(function() {
    'use strict';
    
    let requestId = 0;
    const pendingRequests = new Map();
    
    // Listener de respostas
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        
        if (event.data.type && event.data.type === 'MYWALLET_RESPONSE') {
            const { requestId, response } = event.data;
            const callback = pendingRequests.get(requestId);
            
            if (callback) {
                pendingRequests.delete(requestId);
                callback(response);
            }
        }
    });
    
    // Helper para enviar mensagens
    function sendMessage(action, data = {}) {
        return new Promise((resolve, reject) => {
            const id = ++requestId;
            
            pendingRequests.set(id, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Request failed'));
                }
            });
            
            window.postMessage({
                type: 'MYWALLET_REQUEST',
                requestId: id,
                action,
                data
            }, '*');
            
            // Timeout após 120 segundos (para dar tempo do usuário confirmar)
            setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 120000);
        });
    }
    
    // API KrayWallet (compatível com Unisat)
    window.krayWallet = {
        /**
         * 🔌 Conectar wallet (retorna endereço se já unlocked, ou pede para usuário clicar no ícone)
         */
        async connect() {
            console.log('🔌 KrayWallet: connect()');
            
            // Verificar se JÁ está conectado e desbloqueado
            try {
                const response = await sendMessage('getWalletInfo');
                
                if (response.success && response.data && response.data.address) {
                    console.log('✅ Already connected and unlocked!');
                    return {
                        success: true,
                        address: response.data.address,
                        publicKey: response.data.publicKey,
                        balance: response.data.balance
                    };
                }
            } catch (err) {
                console.log('⚠️  Wallet locked or not found');
            }
            
            // Wallet está locked - Pedir para usuário clicar no ícone
            console.log('🔒 Wallet is locked');
            console.log('👉 Please click the KrayWallet extension icon to unlock');
            
            // Retornar erro com mensagem clara
            return {
                success: false,
                error: 'Please click the KrayWallet extension icon to unlock your wallet',
                needsUserAction: true
            };
        },
        
        /**
         * Solicitar contas (alias para connect)
         */
        async requestAccounts() {
            console.log('📞 requestAccounts() called');
            
            const result = await this.connect();
            
            // Se wallet está locked, tentar abrir popup automaticamente
            if (!result.success && result.needsUserAction) {
                console.log('🔓 Wallet locked - opening extension popup...');
                
                // Enviar mensagem para content script abrir popup
                try {
                    sendMessage('openPopup');
                } catch (e) {
                    console.log('⚠️  Cannot open popup programmatically');
                }
            }
            
            return result;
        },
        
        /**
         * Obter contas
         */
        async getAccounts() {
            console.log('📋 KrayWallet: getAccounts()');
            const response = await sendMessage('getAccounts');
            return response.accounts || [];
        },
        
        /**
         * Obter public key
         */
        async getPublicKey() {
            console.log('🔑 KrayWallet: getPublicKey()');
            const response = await sendMessage('getPublicKey');
            return response.publicKey;
        },
        
        /**
         * Obter balance
         */
        async getBalance() {
            console.log('💰 KrayWallet: getBalance()');
            const response = await sendMessage('getWalletInfo');
            return response.data.balance;
        },
        
        /**
         * 🪙 OBTER RUNES (com tudo: símbolos, quantidades, thumbnails)
         */
        async getRunes() {
            console.log('🪙 KrayWallet: getRunes()');
            const response = await sendMessage('getRunes');
            return response;
        },
        
        /**
         * 📊 OBTER TUDO (balance + runes + inscriptions)
         */
        async getFullWalletData() {
            console.log('📊 KrayWallet: getFullWalletData()');
            
            // Wallet info (address, balance)
            const walletInfo = await sendMessage('getWalletInfo');
            
            // Runes
            const runesData = await sendMessage('getRunes');
            
            // Inscriptions
            const inscriptionsData = await sendMessage('getInscriptions');
            
            return {
                success: true,
                address: walletInfo.data?.address,
                balance: walletInfo.data?.balance,
                runes: runesData.runes || [],
                inscriptions: inscriptionsData.inscriptions || []
            };
        },
        
        /**
         * ⭐ ASSINAR PSBT (com SIGHASH customizado!)
         */
        async signPsbt(psbt, options = {}) {
            console.log('✍️  KrayWallet: signPsbt()');
            console.log('   SIGHASH:', options.sighashType || 'ALL');
            console.log('   toSignInputs:', JSON.stringify(options.toSignInputs));
            console.log('   autoFinalized:', options.autoFinalized);
            
            const response = await sendMessage('signPsbt', {
                psbt,
                sighashType: options.sighashType || 'ALL',
                toSignInputs: options.toSignInputs,
                autoFinalized: options.autoFinalized
            });
            
            console.log('   Response:', response?.success ? '✅ SUCCESS' : '❌ FAILED');
            if (!response?.success) {
                console.error('   Error:', response?.error);
            }
            
            // Retornar o response completo (com success e signedPsbt)
            return response;
        },
        
        /**
         * Push transação (broadcast)
         */
        async pushTx(txHex) {
            console.log('📡 KrayWallet: pushTx()');
            const response = await sendMessage('sendBitcoin', { txHex });
            return response.txid;
        },
        
        /**
         * Push PSBT (finalizar e broadcast)
         */
        async pushPsbt(psbt) {
            console.log('📡 KrayWallet: pushPsbt()');
            const response = await sendMessage('sendBitcoin', { psbt });
            return response.txid;
        },
        
        /**
         * Enviar Bitcoin
         */
        async sendBitcoin(toAddress, amount, options = {}) {
            console.log('💸 KrayWallet: sendBitcoin()');
            const response = await sendMessage('sendBitcoin', {
                toAddress,
                amount,
                feeRate: options.feeRate || 1
            });
            return response.txid;
        },
        
        /**
         * ⚡ PAGAR INVOICE LIGHTNING
         */
        async sendPayment(invoice) {
            console.log('⚡ KrayWallet: sendPayment()');
            console.log('   Invoice:', invoice?.substring(0, 50) + '...');
            
            const response = await sendMessage('sendPayment', { invoice });
            
            // Retornar response completo
            return response;
        },
        
        /**
         * Obter inscriptions (placeholder)
         */
        async getInscriptions(offset = 0, limit = 100) {
            console.log('🖼️  KrayWallet: getInscriptions()');
            const response = await sendMessage('getInscriptions', { offset, limit });
            
            if (response.success && response.inscriptions) {
                // Formatar para compatibilidade com Unisat API
                return {
                    total: response.inscriptions.length,
                    list: response.inscriptions.map(i => {
                        // Extrair txid e vout do satpoint (formato: txid:vout:offset)
                        let txid = null;
                        let vout = null;
                        
                        console.log('🔍 DEBUG inscription:', {
                            id: i.id,
                            output: i.output,
                            value: i.value
                        });
                        
                        if (i.output) {
                            const parts = i.output.split(':');
                            if (parts.length >= 2) {
                                txid = parts[0];
                                vout = parseInt(parts[1]);
                                console.log('✅ Extracted UTXO:', { txid, vout });
                            } else {
                                console.warn('⚠️ Invalid satpoint format:', i.output);
                            }
                        } else {
                            console.warn('⚠️ No output field in inscription');
                        }
                        
                        return {
                            inscriptionId: i.id,
                            inscriptionNumber: i.number,
                            address: response.address,
                            outputValue: parseInt(i.value) || 546,  // ✅ Converter para número
                            contentType: i.content_type,
                            preview: i.preview,
                            location: i.output, // satpoint format (txid:vout:offset)
                            utxo: (txid && vout !== null) ? {
                                txid: txid,
                                vout: vout,
                                satoshi: parseInt(i.value) || 546  // ✅ Converter para número
                            } : null
                        };
                    })
                };
            }
            
            return { total: 0, list: [] };
        },
        
        /**
         * Assinar mensagem (para likes)
         */
        async signMessage(message) {
            console.log('✍️  KrayWallet: signMessage()');
            console.log('   Message:', message);
            
            const response = await sendMessage('signMessage', { message });
            
            if (response.success) {
                return {
                    signature: response.signature,
                    address: response.address
                };
            }
            
            throw new Error(response.error || 'Failed to sign message');
        },
        
        /**
         * Create Offer (Kray Wallet specific)
         */
        async createOffer({ inscriptionId, price, description }) {
            console.log('📝 KrayWallet: createOffer()');
            console.log('   Inscription:', inscriptionId);
            console.log('   Price:', price, 'sats');
            console.log('   Description:', description);
            
            const response = await sendMessage('createOffer', {
                inscriptionId,
                price,
                description
            });
            
            if (response.success) {
                return {
                    success: true,
                    requiresSignature: response.requiresSignature,
                    order_id: response.order_id,
                    message: response.message
                };
            }
            
            throw new Error(response.error || 'Failed to create offer');
        },
        
        /**
         * Cancel Listing
         */
        async cancelListing({ orderId }) {
            console.log('❌ KrayWallet: cancelListing()');
            console.log('   Order ID:', orderId);
            
            const response = await sendMessage('cancelListing', {
                orderId
            });
            
            if (response.success) {
                return {
                    success: true,
                    message: response.message
                };
            }
            
            throw new Error(response.error || 'Failed to cancel listing');
        },
        
        /**
         * Update Listing Price
         */
        async updateListingPrice({ orderId, newPrice }) {
            console.log('💰 KrayWallet: updateListingPrice()');
            console.log('   Order ID:', orderId);
            console.log('   New Price:', newPrice, 'sats');
            
            const response = await sendMessage('updateListingPrice', {
                orderId,
                newPrice
            });
            
            if (response.success) {
                return {
                    success: true,
                    requiresSignature: response.requiresSignature,
                    message: response.message,
                    old_price: response.old_price,
                    new_price: response.new_price
                };
            }
            
            throw new Error(response.error || 'Failed to update price');
        },
        
        /**
         * Buy Atomic Swap (Kray Wallet specific)
         */
        async buyAtomicSwap({ orderId, priceSats, buyerAddress, buyerChangeAddress }) {
            console.log('🛒 KrayWallet: buyAtomicSwap()');
            console.log('   Order ID:', orderId);
            console.log('   Price:', priceSats, 'sats');
            console.log('   Buyer Address:', buyerAddress);
            
            const response = await sendMessage('buyAtomicSwap', {
                orderId,
                priceSats,
                buyerAddress,
                buyerChangeAddress
            });
            
            if (response.success) {
                return {
                    success: true,
                    txid: response.txid,
                    requiresSignature: response.requiresSignature, // ✅ Passar requiresSignature
                    attempt_id: response.attempt_id,
                    message: response.message || 'Purchase successful!'
                };
            }
            
            throw new Error(response.error || 'Failed to buy atomic swap');
        },
        
        /**
         * 🛒 BUY NOW - Magic Eden style purchase
         */
        async buyNow({ orderId, buyerAddress }) {
            console.log('🛒 KrayWallet: buyNow()');
            console.log('   Order ID:', orderId);
            console.log('   Buyer Address:', buyerAddress);
            
            const response = await sendMessage('buyNow', {
                orderId,
                buyerAddress
            });
            
            if (response.success) {
                return {
                    success: true,
                    purchaseId: response.purchaseId,
                    requiresSignature: response.requiresSignature,
                    breakdown: response.breakdown,
                    message: response.message || 'Purchase initiated!'
                };
            }
            
            throw new Error(response.error || 'Failed to initiate Buy Now');
        },
        
        /**
         * 📝 Create Buy Now Listing
         */
        async createBuyNowListing({ inscriptionId, priceSats, description }) {
            console.log('📝 KrayWallet: createBuyNowListing()');
            console.log('   Inscription:', inscriptionId);
            console.log('   Price:', priceSats, 'sats');
            
            const response = await sendMessage('createBuyNowListing', {
                inscriptionId,
                priceSats,
                description
            });
            
            if (response.success) {
                return {
                    success: true,
                    orderId: response.order_id,
                    status: response.status,
                    message: response.message || 'Listing created!'
                };
            }
            
            throw new Error(response.error || 'Failed to create listing');
        },
        
        /**
         * ✅ Accept Buy Now (Seller)
         */
        async acceptBuyNow({ orderId, purchaseId, buyerSignedPsbt }) {
            console.log('✅ KrayWallet: acceptBuyNow()');
            console.log('   Order ID:', orderId);
            console.log('   Purchase ID:', purchaseId);
            
            const response = await sendMessage('acceptBuyNow', {
                orderId,
                purchaseId,
                buyerSignedPsbt
            });
            
            if (response.success) {
                return {
                    success: true,
                    requiresSignature: response.requiresSignature,
                    message: response.message
                };
            }
            
            throw new Error(response.error || 'Failed to accept Buy Now');
        },
        
        /**
         * Network
         */
        getNetwork() {
            return 'livenet'; // ou 'testnet'
        },
        
        /**
         * Versão
         */
        getVersion() {
            return '1.0.0';
        }
    };
    
    // Evento de inicialização
    window.dispatchEvent(new Event('krayWalletReady'));
    
    console.log('🔥 KrayWallet API injected!');
    console.log('   window.krayWallet is now available');
    console.log('   Compatible with Unisat API');
    console.log('   ⭐ Supports SIGHASH customizado!');
})();

