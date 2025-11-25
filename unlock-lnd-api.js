#!/usr/bin/env node

/**
 * Script para desbloquear a wallet LND via REST API
 * Uso: node unlock-lnd-api.js [senha]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const LND_REST_URL = 'https://localhost:8080';
const MACAROON_PATH = path.join(__dirname, 'lnd-data/data/chain/bitcoin/mainnet/admin.macaroon');

// Aceita a senha como argumento ou pede interativamente
const password = process.argv[2] || process.env.LND_WALLET_PASSWORD;

if (!password) {
    console.error('❌ Senha não fornecida!');
    console.log('');
    console.log('Uso:');
    console.log('  node unlock-lnd-api.js [senha]');
    console.log('  ou');
    console.log('  LND_WALLET_PASSWORD="sua_senha" node unlock-lnd-api.js');
    process.exit(1);
}

async function unlockWallet() {
    console.log('🔓 Desbloqueando wallet LND via REST API...');
    console.log('');

    // Macaroon pode não existir antes do unlock
    let macaroon = '';
    if (fs.existsSync(MACAROON_PATH)) {
        const macaroonBuffer = fs.readFileSync(MACAROON_PATH);
        macaroon = macaroonBuffer.toString('hex');
    }

    const postData = JSON.stringify({
        wallet_password: Buffer.from(password).toString('base64')
    });

    const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/v1/unlockwallet',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': postData.length
        },
        rejectUnauthorized: false // Para desenvolvimento (certificado auto-assinado)
    };

    if (macaroon) {
        options.headers['Grpc-Metadata-macaroon'] = macaroon;
    }

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ Wallet desbloqueada com sucesso!');
                    console.log('');
                    resolve(true);
                } else {
                    console.error(`❌ Erro ao desbloquear: HTTP ${res.statusCode}`);
                    console.error('Resposta:', data);
                    reject(new Error(data));
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Erro na requisição:', error.message);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

// Executa
unlockWallet()
    .then(() => {
        console.log('🎉 LND está pronto para uso!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('');
        console.error('💡 Dicas:');
        console.error('   - Verifique se a senha está correta');
        console.error('   - Certifique-se de que o LND está rodando');
        console.error('   - Verifique os logs: tail -f lnd-data/logs/bitcoin/mainnet/lnd.log');
        process.exit(1);
    });

