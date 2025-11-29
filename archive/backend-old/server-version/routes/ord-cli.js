import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import bitcoinRpc from '../utils/bitcoinRpc.js';

dotenv.config();

const router = express.Router();
const execAsync = promisify(exec);

// Caminho para o binário ord
const ORD_BINARY = process.env.ORD_BINARY_PATH || '/Volumes/D1/Ord/ord';
const ORD_DATA_DIR = process.env.ORD_DATA_DIR || '/Volumes/D1/Ord/data';
const BITCOIN_RPC_USER = process.env.BITCOIN_RPC_USER;
const BITCOIN_RPC_PASSWORD = process.env.BITCOIN_RPC_PASSWORD;

// ORD Server local (HTTP API)
// API URLs (já usa QuickNode internamente)
const API_URL = 'http://localhost:4000/api';

/**
 * POST /api/ord/create-offer
 * 
 * Cria oferta usando Ord CLI (integração com PRs #4408 e #4409)
 * Usa o comando nativo `ord wallet offer create`
 */
router.post('/create-offer', async (req, res) => {
    try {
        const { 
            inscriptionId, 
            amount, 
            feeRate, 
            autoSubmit = false 
        } = req.body;

        // Validações
        if (!inscriptionId || !amount || !feeRate) {
            return res.status(400).json({ 
                error: 'Missing required fields: inscriptionId, amount, feeRate' 
            });
        }

        // Construir comando ord wallet offer create
        // Sintaxe correta: wallet offer create --inscription <ID> --amount <AMOUNT> --fee-rate <FEE>
        // IMPORTANTE: amount precisa ter denominação (sat, sats, btc)
        let cmd = `${ORD_BINARY} ` +
                  `--data-dir ${ORD_DATA_DIR} ` +
                  `--bitcoin-rpc-username ${BITCOIN_RPC_USER} ` +
                  `--bitcoin-rpc-password ${BITCOIN_RPC_PASSWORD} ` +
                  `wallet offer create ` +
                  `--inscription ${inscriptionId} ` +
                  `--amount ${amount}sat ` +
                  `--fee-rate ${feeRate}`;

        // Adicionar flag --submit se solicitado (PR #4409 feature)
        if (autoSubmit) {
            cmd += ' --submit';
        }

        console.log('Executing ord command:', cmd.replace(BITCOIN_RPC_PASSWORD, '***'));

        // Executar comando
        const { stdout, stderr } = await execAsync(cmd, {
            timeout: 30000,
            maxBuffer: 1024 * 1024
        });

        if (stderr) {
            console.error('Ord stderr:', stderr);
        }

        const output = stdout.trim();

        res.json({
            success: true,
            psbt: output,
            autoSubmitted: autoSubmit,
            message: autoSubmit 
                ? 'Offer created and auto-submitted via Ord 0.23.3'
                : 'Offer created (PSBT ready to sign)',
            method: 'ord-cli',
            version: '0.23.3',
            prs: ['#4408', '#4409']
        });

    } catch (error) {
        console.error('Error creating offer with Ord CLI:', error);
        res.status(500).json({ 
            error: error.message,
            suggestion: 'Try using POST /api/offers instead (Bitcoin Core method)'
        });
    }
});

/**
 * GET /api/ord/version
 * 
 * Retorna versão do Ord instalado
 */
router.get('/version', async (req, res) => {
    try {
        const { stdout } = await execAsync(`${ORD_BINARY} --version`);
        
        res.json({
            success: true,
            version: stdout.trim(),
            binary: ORD_BINARY
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ord/wallet-info
 * 
 * Retorna informações da wallet do Ord
 */
router.post('/wallet-info', async (req, res) => {
    try {
        const cmd = `${ORD_BINARY} ` +
                    `--data-dir ${ORD_DATA_DIR} ` +
                    `--bitcoin-rpc-username ${BITCOIN_RPC_USER} ` +
                    `--bitcoin-rpc-password ${BITCOIN_RPC_PASSWORD} ` +
                    `wallet balance`;

        const { stdout } = await execAsync(cmd, { timeout: 10000 });

        res.json({
            success: true,
            balance: stdout.trim()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ord/inscribe
 * 
 * Criar inscription usando Ord CLI
 */
router.post('/inscribe', async (req, res) => {
    try {
        const { file, feeRate, destination } = req.body;

        if (!file || !feeRate) {
            return res.status(400).json({ 
                error: 'Missing required fields: file, feeRate' 
            });
        }

        let cmd = `${ORD_BINARY} ` +
                  `--data-dir ${ORD_DATA_DIR} ` +
                  `--bitcoin-rpc-username ${BITCOIN_RPC_USER} ` +
                  `--bitcoin-rpc-password ${BITCOIN_RPC_PASSWORD} ` +
                  `wallet inscribe ${file} ` +
                  `--fee-rate ${feeRate}`;

        if (destination) {
            cmd += ` --destination ${destination}`;
        }

        const { stdout } = await execAsync(cmd, { timeout: 60000 });

        res.json({
            success: true,
            result: stdout.trim(),
            message: 'Inscription created via Ord CLI'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/ord/inscriptions/:address
 * 
 * Busca inscriptions de um endereço usando ORD server local (HTTP API)
 * Endpoint: http://localhost:4000/api/output/:output
 */
router.get('/inscriptions/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        console.log(`📡 Fetching inscriptions for address: ${address}`);
        console.log(`   Using ORD server: ${ORD_SERVER_URL}`);
        
        // ORD server expõe endpoint /output/{output} para buscar inscriptions
        // Precisamos buscar outputs do endereço via Bitcoin Core RPC primeiro
        
        // Importar RPC helper
        const { callRpc } = await import('../utils/bitcoinRpc.js');
        
        // 1. Listar outputs do endereço
        const utxos = await callRpc('scantxoutset', ['start', [`addr(${address})`]]);
        
        if (!utxos || !utxos.unspents || utxos.unspents.length === 0) {
            console.log('   No UTXOs found for address');
            return res.json({
                success: true,
                address: address,
                inscriptions: []
            });
        }
        
        console.log(`   Found ${utxos.unspents.length} UTXOs`);
        
        // 2. Para cada UTXO, verificar se tem inscription via ORD server
        const inscriptions = [];
        
        for (const utxo of utxos.unspents) {
            try {
                const output = `${utxo.txid}:${utxo.vout}`;
                console.log(`   Checking output: ${output}`);
                
                // Buscar inscription no ORD server local
                const response = await fetch(`${ORD_SERVER_URL}/output/${output}`);
                
                if (response.ok) {
                    const html = await response.text();
                    
                    // Parse HTML para extrair inscription ID
                    // ORD server retorna HTML, precisamos extrair inscription ID
                    const inscriptionMatch = html.match(/\/inscription\/([a-f0-9]{64}i\d+)/);
                    
                    if (inscriptionMatch) {
                        const inscriptionId = inscriptionMatch[1];
                        console.log(`   ✅ Found inscription: ${inscriptionId}`);
                        
                        // Buscar detalhes da inscription
                        const inscriptionResponse = await fetch(`${ORD_SERVER_URL}/inscription/${inscriptionId}`);
                        
                        if (inscriptionResponse.ok) {
                            const inscriptionHtml = await inscriptionResponse.text();
                            
                            // Extrair dados básicos (número, tipo, etc)
                            const numberMatch = inscriptionHtml.match(/inscription (\d+)/i);
                            const contentTypeMatch = inscriptionHtml.match(/content type<\/dt>\s*<dd[^>]*>([^<]+)/i);
                            
                            inscriptions.push({
                                id: inscriptionId,
                                number: numberMatch ? parseInt(numberMatch[1]) : null,
                                content_type: contentTypeMatch ? contentTypeMatch[1].trim() : 'unknown',
                                preview: `${ORD_SERVER_URL}/content/${inscriptionId}`,
                                output: output,
                                value: Math.round(utxo.amount * 100000000), // BTC → sats
                                address: address
                            });
                        }
                    }
                }
            } catch (outputError) {
                console.log(`   ⚠️  Error checking output: ${outputError.message}`);
            }
        }
        
        console.log(`✅ Found ${inscriptions.length} inscriptions for address`);
        
        res.json({
            success: true,
            address: address,
            inscriptions: inscriptions
        });
        
    } catch (error) {
        console.error('❌ Error fetching inscriptions:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

/**
 * GET /api/ord/inscription/:id/utxo
 * 
 * Busca o UTXO ATUAL de uma inscription via ORD server local
 * Retorna: { txid, vout, offset, value }
 */
router.get("/inscription/:id/utxo", async (req, res) => {
    try {
        const { id } = req.params;
        const quicknode = (await import("../utils/quicknode.js")).default;
        const details = await quicknode.call("ord_getInscription", [id]);
        if (!details?.satpoint) throw new Error("Not found");
        const [txid, vout, offset = 0] = details.satpoint.split(":");
        res.json({ success: true, utxo: { txid, vout: parseInt(vout), offset: parseInt(offset), value: details.value || 555 } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
export default router;

