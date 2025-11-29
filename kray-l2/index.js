/**
 * KRAY SPACE L2 - Main Entry Point
 * 
 * Bitcoin Layer 2 for KRAY•SPACE token
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, getStats, healthCheck } from './core/database.js';
import { initBridgeKeys, getKeyManager } from './bridge/keyManager.js';
import { generateMultisigAddress } from './bridge/psbtBridge.js';
import { startBatchBuilder } from './state/rollupAggregator.js';
import { initConsensus } from './validators/consensusRaft.js';
import { API } from './core/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import bridgeRoutes from './api/routes/bridge.js';
import accountRoutes from './api/routes/account.js';
import transactionRoutes from './api/routes/transaction.js';
import defiRoutes from './api/routes/defi.js';
import marketplaceRoutes from './api/routes/marketplace.js';
import validatorRoutes from './api/routes/validator.js';

dotenv.config();

const app = express();
const PORT = API.PORT;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (Explorer dashboard)
app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

let multisigAddress = null;

async function initializeL2() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           KRAY SPACE L2 - Layer 2 Network                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Initialize database
  initDatabase();

  // Initialize bridge keys
  const pubkeys = initBridgeKeys();
  const keyManager = getKeyManager();

  console.log('\n🔑 Bridge Keys initialized:');
  const exported = keyManager.exportPublicKeys();
  console.log(`   Validator 1: ${exported.validator_1.substring(0, 16)}...`);
  console.log(`   Validator 2: ${exported.validator_2.substring(0, 16)}...`);
  console.log(`   Validator 3: ${exported.validator_3.substring(0, 16)}...`);

  // Generate multisig address (async now)
  const multisig = await generateMultisigAddress(pubkeys);
  multisigAddress = multisig.address;
  
  // Store globally for API access
  global.multisigAddress = multisigAddress;
  
  console.log(`\n💼 Bridge Multisig Address: ${multisigAddress}`);

  // Initialize consensus (validator 1 as default)
  const validatorId = 'val_' + crypto.randomBytes(8).toString('hex');
  initConsensus(validatorId, []);

  // Start batch builder
  startBatchBuilder();
  
  // CRITICAL: Start deposit listener to detect deposits!
  console.log('\n👀 Starting deposit listener...');
  const { startDepositListener } = await import('./bridge/psbtBridge.js');
  await startDepositListener(multisigAddress, process.env.QUICKNODE_ENDPOINT);
  console.log('✅ Deposit listener active - monitoring bridge address');
  
  return multisig;
}

// Run initialization
initializeL2().catch(err => {
  console.error('❌ Failed to initialize L2:', err);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  const isHealthy = healthCheck();
  const stats = getStats();

  res.json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: Date.now(),
    network: 'kray-mainnet-1',
    version: '0.1.0',
    stats
  });
});

// Bridge endpoints
app.use('/api/bridge', bridgeRoutes);

// Account endpoints
app.use('/api/account', accountRoutes);

// Transaction endpoints
app.use('/api/transaction', transactionRoutes);

// DeFi endpoints
app.use('/api/defi', defiRoutes);

// Marketplace endpoints
app.use('/api/marketplace', marketplaceRoutes);

// Validator endpoints
app.use('/api/validator', validatorRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  
  res.status(500).json({
    error: err.message || 'Internal server error',
    timestamp: Date.now()
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('\n✅ KRAY SPACE L2 is running!');
  console.log(`   Port: ${PORT}`);
  console.log(`   Bridge: ${multisigAddress || 'Initializing...'}`);
  console.log(`   Network: kray-mainnet-1`);
  console.log('\n📡 API Endpoints:');
  console.log(`   GET  /health`);
  console.log(`   POST /api/bridge/deposit`);
  console.log(`   POST /api/bridge/withdrawal`);
  console.log(`   GET  /api/account/:address/balance`);
  console.log(`   POST /api/transaction/send`);
  console.log(`   POST /api/defi/swap`);
  console.log(`   POST /api/marketplace/list`);
  console.log(`   GET  /api/validator/list`);
  console.log('\n🚀 Ready to process transactions!\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  process.exit(0);
});

export default app;

