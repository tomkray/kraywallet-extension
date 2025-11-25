#!/usr/bin/env node

/**
 * 🧪 Script de Teste de Conexões
 * 
 * Este script testa as conexões com Bitcoin Core e Ord Server
 * e exibe informações detalhadas sobre o status dos nodes.
 */

import dotenv from 'dotenv';
import bitcoinRpc from './server/utils/bitcoinRpc.js';
import ordApi from './server/utils/ordApi.js';

dotenv.config();

// Cores para terminal
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('');
    log('═══════════════════════════════════════', 'cyan');
    log(`  ${title}`, 'cyan');
    log('═══════════════════════════════════════', 'cyan');
    console.log('');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'blue');
}

async function testBitcoinCore() {
    logSection('Bitcoin Core RPC');
    
    try {
        // Teste básico de conexão
        logInfo('Testando conexão...');
        const connectionTest = await bitcoinRpc.testConnection();
        
        if (!connectionTest.connected) {
            logError('Não foi possível conectar ao Bitcoin Core');
            console.log('   Erro:', connectionTest.error);
            return false;
        }
        
        logSuccess('Conectado ao Bitcoin Core');
        
        // Informações da blockchain
        logInfo('Obtendo informações da blockchain...');
        const blockchainInfo = await bitcoinRpc.getBlockchainInfo();
        
        console.log('');
        console.log('   Chain:', blockchainInfo.chain);
        console.log('   Blocks:', blockchainInfo.blocks.toLocaleString());
        console.log('   Headers:', blockchainInfo.headers.toLocaleString());
        console.log('   Sync Progress:', `${(blockchainInfo.verificationprogress * 100).toFixed(2)}%`);
        console.log('   Pruned:', blockchainInfo.pruned ? 'Yes' : 'No');
        console.log('   Size on Disk:', `${(blockchainInfo.size_on_disk / 1024 / 1024 / 1024).toFixed(2)} GB`);
        
        // Verificar se está sincronizado
        if (blockchainInfo.verificationprogress < 0.9999) {
            logWarning('Blockchain ainda está sincronizando');
        } else {
            logSuccess('Blockchain completamente sincronizada');
        }
        
        // Informações de rede
        logInfo('Obtendo informações de rede...');
        const networkInfo = await bitcoinRpc.getNetworkInfo();
        
        console.log('');
        console.log('   Version:', networkInfo.version);
        console.log('   Connections:', networkInfo.connections);
        console.log('   Networks:', networkInfo.networks.map(n => n.name).join(', '));
        
        // Testar fees
        logInfo('Obtendo taxas recomendadas...');
        const fees = await bitcoinRpc.getRecommendedFees();
        
        console.log('');
        console.log('   Fast (1 block):', `${fees.fast} sat/vB`);
        console.log('   Medium (6 blocks):', `${fees.medium} sat/vB`);
        console.log('   Slow (144 blocks):', `${fees.slow} sat/vB`);
        
        logSuccess('Todos os testes do Bitcoin Core passaram!');
        return true;
        
    } catch (error) {
        logError('Erro ao testar Bitcoin Core');
        console.log('   Erro:', error.message);
        console.log('');
        console.log('   Verifique:');
        console.log('   - Bitcoin Core está rodando?');
        console.log('   - Credenciais no .env estão corretas?');
        console.log('   - Porta RPC está correta?');
        return false;
    }
}

async function testOrdServer() {
    logSection('Ord Server');
    
    try {
        // Teste básico de conexão
        logInfo('Testando conexão...');
        const connectionTest = await ordApi.testConnection();
        
        if (!connectionTest.connected) {
            logError('Não foi possível conectar ao Ord Server');
            console.log('   Erro:', connectionTest.error);
            return false;
        }
        
        logSuccess('Conectado ao Ord Server');
        
        // Obter estatísticas
        logInfo('Obtendo estatísticas...');
        const stats = await ordApi.getStats();
        
        if (stats) {
            console.log('');
            console.log('   Stats disponíveis:', JSON.stringify(stats, null, 2));
        }
        
        // Testar buscar uma inscription conhecida
        logInfo('Testando busca de inscription...');
        try {
            const inscription = await ordApi.getInscription('0');
            logSuccess('Conseguiu buscar inscription #0');
            console.log('   ID:', inscription.id || 'N/A');
        } catch (error) {
            logWarning('Não foi possível buscar inscription #0 (pode não existir)');
        }
        
        // Testar listar runes
        logInfo('Testando listagem de runes...');
        try {
            const runes = await ordApi.listRunes();
            if (runes && runes.length > 0) {
                logSuccess(`Encontradas ${runes.length} runes`);
                console.log('   Primeiras 5:', runes.slice(0, 5).map(r => r.name || r).join(', '));
            } else {
                logWarning('Nenhuma rune encontrada (pode ser normal se não houver runes no node)');
            }
        } catch (error) {
            logWarning('Não foi possível listar runes');
        }
        
        logSuccess('Testes do Ord Server concluídos!');
        return true;
        
    } catch (error) {
        logError('Erro ao testar Ord Server');
        console.log('   Erro:', error.message);
        console.log('');
        console.log('   Verifique:');
        console.log('   - Ord Server está rodando?');
        console.log('   - URL no .env está correta?');
        console.log('   - Índice do Ord foi criado?');
        return false;
    }
}

async function testEndToEnd() {
    logSection('Teste End-to-End');
    
    try {
        // Testar um endereço de exemplo
        const testAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'; // Endereço de exemplo
        
        logInfo(`Testando com endereço: ${testAddress}`);
        
        // Tentar obter balance
        try {
            const balance = await bitcoinRpc.getAddressBalance(testAddress);
            logSuccess('Conseguiu obter balance');
            console.log('   Balance:', balance.total, 'sats');
            console.log('   UTXOs:', balance.utxoCount);
        } catch (error) {
            logWarning('Não foi possível obter balance (pode ser normal)');
        }
        
        logSuccess('Teste end-to-end concluído!');
        return true;
        
    } catch (error) {
        logError('Erro no teste end-to-end');
        console.log('   Erro:', error.message);
        return false;
    }
}

async function main() {
    log('', 'cyan');
    log('╔═══════════════════════════════════════════════╗', 'cyan');
    log('║   🧪 Teste de Conexões - PSBT Marketplace   ║', 'cyan');
    log('╚═══════════════════════════════════════════════╝', 'cyan');
    
    // Verificar variáveis de ambiente
    logSection('Configuração');
    
    console.log('   Bitcoin RPC Host:', process.env.BITCOIN_RPC_HOST || 'NOT SET');
    console.log('   Bitcoin RPC Port:', process.env.BITCOIN_RPC_PORT || 'NOT SET');
    console.log('   Bitcoin RPC User:', process.env.BITCOIN_RPC_USER || 'NOT SET');
    console.log('   Bitcoin RPC Password:', process.env.BITCOIN_RPC_PASSWORD ? '***' : 'NOT SET');
    console.log('   Ord Server URL:', process.env.ORD_SERVER_URL || 'NOT SET');
    console.log('');
    
    // Verificar se as variáveis essenciais estão configuradas
    if (!process.env.BITCOIN_RPC_USER || !process.env.BITCOIN_RPC_PASSWORD) {
        logError('Variáveis de ambiente não configuradas!');
        console.log('   Execute: cp .env.example .env');
        console.log('   E configure suas credenciais no arquivo .env');
        process.exit(1);
    }
    
    // Executar testes
    const results = {
        bitcoin: false,
        ord: false,
        endToEnd: false
    };
    
    results.bitcoin = await testBitcoinCore();
    results.ord = await testOrdServer();
    
    if (results.bitcoin && results.ord) {
        results.endToEnd = await testEndToEnd();
    }
    
    // Resumo final
    logSection('Resumo');
    
    console.log('   Bitcoin Core:', results.bitcoin ? '✅ OK' : '❌ FALHOU');
    console.log('   Ord Server:', results.ord ? '✅ OK' : '❌ FALHOU');
    console.log('   End-to-End:', results.endToEnd ? '✅ OK' : '❌ FALHOU');
    console.log('');
    
    const allPassed = results.bitcoin && results.ord && results.endToEnd;
    
    if (allPassed) {
        log('🎉 Todos os testes passaram! Seu sistema está pronto!', 'green');
        console.log('');
        console.log('   Inicie o servidor com: npm start');
        console.log('   Acesse: http://localhost:3000');
        process.exit(0);
    } else {
        log('⚠️  Alguns testes falharam. Verifique as mensagens acima.', 'yellow');
        console.log('');
        console.log('   Consulte NODE_SETUP.md para mais informações');
        process.exit(1);
    }
}

// Executar
main().catch(error => {
    logError('Erro fatal:');
    console.error(error);
    process.exit(1);
});








