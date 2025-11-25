import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import ordinalsRoutes from './routes/ordinals.js';
import runesRoutes from './routes/runes.js';
import offersRoutes from './routes/offers.js';
import salesRoutes from './routes/sales.js';
import walletRoutes from './routes/wallet.js';
import psbtRoutes from './routes/psbt.js';
import ordCliRoutes from './routes/ord-cli.js';
import purchaseRoutes from './routes/purchase.js';
import sellRoutes from './routes/sell.js';
import kraywalletRoutes from './routes/kraywallet.js';
import dexRoutes from './routes/dex.js';
import lightningRoutes from './routes/lightning.js';
import likesRoutes from './routes/likes.js';
import atomicLikesRoutes from './routes/atomicLikes.js';
import analyticsRoutes from './routes/analytics.js';
import ordOffersRoutes from './routes/ord-offers.js';
import explorerRoutes from './routes/explorer.js';
import atomicSwapRoutes from './routes/atomicSwap.js';
import defiSwapRoutes from './routes/defiSwap.js';
import lightningDefiRoutes from './routes/lightningDefi.js';
import unifiedDefiRoutes from './routes/unifiedDefi.js';
import outputRoutes from './routes/output.js';
import walletInscriptionsRoutes from './routes/wallet-inscriptions.js';
import runeThumbnailRoutes from './routes/rune-thumbnail.js';
import runeDetailsRoutes from './routes/rune-details.js';
import balanceRoutes from './routes/balance.js';
import { initDatabase } from './db/init-supabase.js';
import { initPoolTables } from './defi/poolManager.js';
import { initStateTrackerTables } from './lightning/krayStateTracker.js';
import { startLNDEventsListener } from './lightning/lndEventsListener.js';
import { startOrdIndexingJob } from './jobs/index-ord-offers.js';
import bitcoinRpc from './utils/bitcoinRpc.js';
import ordApi from './utils/ordApi.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.use('/api/ordinals', ordinalsRoutes);
app.use('/api/runes', runesRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/psbt', psbtRoutes);
app.use('/api/ord', ordCliRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/sell', sellRoutes);
app.use('/api/kraywallet', kraywalletRoutes);
app.use('/api/dex', dexRoutes);
app.use('/api/lightning', lightningRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/atomic-likes', atomicLikesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ord-offers', ordOffersRoutes);
app.use('/api/explorer', explorerRoutes);
app.use('/api/atomic-swap', atomicSwapRoutes);
app.use('/api/defi', defiSwapRoutes);
app.use('/api/lightning-defi', lightningDefiRoutes);
app.use('/api/unified-defi', unifiedDefiRoutes);
app.use('/api/output', outputRoutes);
app.use('/api/wallet', walletInscriptionsRoutes);
app.use('/api/wallet', balanceRoutes);
app.use('/api/rune-thumbnail', runeThumbnailRoutes);
app.use('/api/rune', runeDetailsRoutes);

// Rota raiz (/) - Bem-vindo
app.get('/', (req, res) => {
    res.json({
        name: 'Kray Station API',
        version: '1.0.0',
        status: 'online',
        endpoints: {
            health: '/api/health',
            explorer: '/api/explorer/tx/:txid',
            wallet: '/api/wallet/:address/runes',
            runes: '/api/runes/build-send-psbt'
        },
        docs: 'https://github.com/tomkray/kray-station-backend'
    });
});

// Health check básico
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        version: '0.23.3',
        timestamp: new Date().toISOString()
    });
});

// Health check completo com verificação dos nodes
app.get('/api/status', async (req, res) => {
    try {
        const [bitcoinStatus, ordStatus] = await Promise.all([
            bitcoinRpc.testConnection(),
            ordApi.testConnection()
        ]);

        const allConnected = bitcoinStatus.connected && ordStatus.connected;

        res.json({
            status: allConnected ? 'ok' : 'partial',
            version: '0.23.3',
            timestamp: new Date().toISOString(),
            nodes: {
                bitcoin: {
                    connected: bitcoinStatus.connected,
                    chain: bitcoinStatus.chain || null,
                    blocks: bitcoinStatus.blocks || null,
                    headers: bitcoinStatus.headers || null,
                    sync: bitcoinStatus.verificationProgress 
                        ? `${(bitcoinStatus.verificationProgress * 100).toFixed(2)}%` 
                        : null,
                    error: bitcoinStatus.error || null
                },
                ord: {
                    connected: ordStatus.connected,
                    status: ordStatus.status,
                    error: ordStatus.error || null
                }
            }
        });
    } catch (error) {
        console.error('Error checking node status:', error);
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Fallback para SPA
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'index.html'));
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        status: err.status || 500
    });
});

// Inicializar database e servidor
async function startServer() {
    try {
        // Database opcional (não funciona no Vercel serverless)
        if (process.env.USE_LOCAL_DB === 'true') {
            await initDatabase();
            console.log('✅ Database initialized');
        } else {
            console.log('ℹ️  Database disabled (serverless mode)');
        }
        
        // Inicializar tabelas DeFi (opcional)
        initPoolTables();
        console.log('✅ DeFi pool tables initialized');
        
        // Inicializar tabelas Lightning DeFi
        initStateTrackerTables();
        console.log('✅ Lightning DeFi State Tracker tables initialized');
        
        // Iniciar LND Events Listener (opcional, comentado por padrão)
        // Descomente quando LND estiver configurado:
        /*
        try {
            await startLNDEventsListener();
            console.log('✅ LND Events Listener started');
        } catch (lndError) {
            console.warn('⚠️  LND Events Listener not started:', lndError.message);
            console.warn('   DeFi will work in mock mode (development)');
        }
        */

        app.listen(PORT, () => {
            console.log(`\n🚀 Ordinals Marketplace Server running!`);
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`⚡ Ordinals Protocol: v0.23.3`);
            console.log(`⚡ Lightning DeFi: BETA (first in the world!) 🌍\n`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

// Iniciar cron job para indexar ofertas ORD
startOrdIndexingJob();


