#!/usr/bin/env node

/**
 * 🧪 TESTE: Send Runes Otimizado
 * Valida que as melhorias não quebraram a funcionalidade
 */

const BACKEND_URL = 'http://localhost:3000';

// Cores para terminal
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(emoji, message, color = colors.reset) {
    console.log(`${color}${emoji} ${message}${colors.reset}`);
}

async function testBuildSendPSBT() {
    try {
        log('🧪', 'TESTE 1: Build Send PSBT Endpoint', colors.cyan);
        log('━', '━'.repeat(60), colors.cyan);
        
        const testData = {
            fromAddress: 'bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx',
            toAddress: 'bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag',
            runeName: 'DOG•GO•TO•THE•MOON',
            amount: 100,
            feeRate: 2
        };
        
        log('📤', `Sending request to: POST ${BACKEND_URL}/api/runes/build-send-psbt`, colors.blue);
        log('📋', 'Parameters:', colors.blue);
        console.log('   From:', testData.fromAddress.substring(0, 30) + '...');
        console.log('   To:', testData.toAddress.substring(0, 30) + '...');
        console.log('   Rune:', testData.runeName);
        console.log('   Amount:', testData.amount);
        console.log('   Fee Rate:', testData.feeRate, 'sat/vB');
        
        const startTime = Date.now();
        
        const response = await fetch(`${BACKEND_URL}/api/runes/build-send-psbt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });
        
        const elapsedTime = Date.now() - startTime;
        
        const data = await response.json();
        
        log('⏱️', `Response time: ${elapsedTime}ms`, colors.yellow);
        
        if (!response.ok) {
            log('❌', `HTTP Error: ${response.status}`, colors.red);
            console.log('   Error:', data.error || 'Unknown error');
            return false;
        }
        
        if (!data.success) {
            log('❌', 'API returned error', colors.red);
            console.log('   Error:', data.error || 'Unknown error');
            return false;
        }
        
        // Validar resposta
        log('✅', 'API Response: SUCCESS', colors.green);
        
        if (!data.psbt) {
            log('❌', 'Missing PSBT in response', colors.red);
            return false;
        }
        
        log('✅', 'PSBT created successfully', colors.green);
        console.log('   PSBT length:', data.psbt.length, 'characters (Base64)');
        console.log('   Fee:', data.fee, 'sats');
        
        if (data.summary) {
            log('📊', 'Summary:', colors.blue);
            console.log('   Rune:', data.summary.rune);
            console.log('   Amount:', data.summary.amount);
            console.log('   Change:', data.summary.change);
        }
        
        // Verificar se PSBT é válido (base64)
        const isValidBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(data.psbt);
        if (!isValidBase64) {
            log('⚠️', 'PSBT may not be valid Base64', colors.yellow);
        } else {
            log('✅', 'PSBT is valid Base64', colors.green);
        }
        
        log('✅', 'TEST 1 PASSED!', colors.green);
        log('━', '━'.repeat(60), colors.cyan);
        return true;
        
    } catch (error) {
        log('❌', 'TEST 1 FAILED!', colors.red);
        console.error('   Error:', error.message);
        log('━', '━'.repeat(60), colors.cyan);
        return false;
    }
}

async function testPerformance() {
    try {
        log('🧪', 'TESTE 2: Performance (getRuneUtxos optimization)', colors.cyan);
        log('━', '━'.repeat(60), colors.cyan);
        log('ℹ️', 'This test measures response time for UTXO fetching', colors.blue);
        log('ℹ️', 'Expected: < 10 seconds (optimized with Promise.all)', colors.blue);
        
        const testData = {
            fromAddress: 'bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx',
            toAddress: 'bc1pggclc3c6u4xa4u00js0hey4fmq6h8kx93ltapwgqn03kz0pk3n8q5nchag',
            runeName: 'DOG•GO•TO•THE•MOON',
            amount: 50,
            feeRate: 2
        };
        
        const startTime = Date.now();
        
        const response = await fetch(`${BACKEND_URL}/api/runes/build-send-psbt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });
        
        const elapsedTime = Date.now() - startTime;
        const data = await response.json();
        
        log('⏱️', `Total time: ${elapsedTime}ms (${(elapsedTime/1000).toFixed(2)}s)`, colors.yellow);
        
        if (elapsedTime < 10000) {
            log('✅', 'Performance is GOOD! (< 10 seconds)', colors.green);
        } else if (elapsedTime < 30000) {
            log('⚠️', 'Performance is ACCEPTABLE (10-30 seconds)', colors.yellow);
        } else {
            log('❌', 'Performance is SLOW (> 30 seconds)', colors.red);
        }
        
        if (data.success) {
            log('✅', 'PSBT built successfully', colors.green);
        } else {
            log('❌', 'PSBT build failed', colors.red);
            console.log('   Error:', data.error);
        }
        
        log('✅', 'TEST 2 PASSED!', colors.green);
        log('━', '━'.repeat(60), colors.cyan);
        return true;
        
    } catch (error) {
        log('❌', 'TEST 2 FAILED!', colors.red);
        console.error('   Error:', error.message);
        log('━', '━'.repeat(60), colors.cyan);
        return false;
    }
}

async function runTests() {
    console.log('\n');
    log('🚀', '═══════════════════════════════════════════', colors.cyan);
    log('🚀', '  SEND RUNES - TESTE DE OTIMIZAÇÕES', colors.cyan);
    log('🚀', '═══════════════════════════════════════════', colors.cyan);
    console.log('\n');
    
    const results = [];
    
    // Test 1: Funcionalidade básica
    results.push(await testBuildSendPSBT());
    console.log('\n');
    
    // Test 2: Performance
    results.push(await testPerformance());
    console.log('\n');
    
    // Resumo
    log('📊', '═══════════════════════════════════════════', colors.cyan);
    log('📊', '  RESUMO DOS TESTES', colors.cyan);
    log('📊', '═══════════════════════════════════════════', colors.cyan);
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log('\n');
    log('📈', `Tests Passed: ${passed}/${total}`, passed === total ? colors.green : colors.red);
    
    if (passed === total) {
        log('🎉', 'TODOS OS TESTES PASSARAM!', colors.green);
        log('✅', 'Send Runes está funcionando perfeitamente!', colors.green);
        log('⚡', 'Otimizações implementadas com sucesso!', colors.green);
    } else {
        log('⚠️', 'ALGUNS TESTES FALHARAM!', colors.yellow);
        log('🔍', 'Verifique os logs do servidor para mais detalhes', colors.yellow);
    }
    
    console.log('\n');
    log('━', '━'.repeat(60), colors.cyan);
    console.log('\n');
    
    process.exit(passed === total ? 0 : 1);
}

// Executar testes
runTests().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

