/**
 * ORD CLI Security Layer
 * 
 * Este módulo implementa um whitelist de comandos seguros que podem ser
 * executados via API pública. NUNCA expõe comandos relacionados a wallets,
 * chaves privadas ou operações sensíveis.
 * 
 * ⚠️  SEGURANÇA CRÍTICA:
 * - NUNCA permitir comandos `ord wallet`
 * - NUNCA permitir criação/acesso a wallets
 * - APENAS comandos de leitura pública
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 🔒 WHITELIST DE COMANDOS SEGUROS (APENAS LEITURA PÚBLICA)
const SAFE_COMMANDS = {
    // Comandos de informação pública sobre inscriptions
    'inscription': {
        allowed: true,
        description: 'Query public inscription data',
        maxArgs: 1,
        argPattern: /^[a-f0-9]{64}i\d+$/i // inscription ID format
    },
    
    // Lista de inscriptions (público)
    'list': {
        allowed: true,
        description: 'List inscriptions (public data)',
        maxArgs: 2
    },
    
    // Informações sobre o servidor ORD
    'server-info': {
        allowed: true,
        description: 'Get ORD server information',
        maxArgs: 0
    },
    
    // Block height e chain info
    'blockheight': {
        allowed: true,
        description: 'Get current block height',
        maxArgs: 0
    }
};

// 🚫 BLACKLIST DE COMANDOS PROIBIDOS
const FORBIDDEN_COMMANDS = [
    'wallet',      // NUNCA expor wallet
    'create',      // NUNCA criar wallets
    'restore',     // NUNCA restaurar wallets
    'send',        // NUNCA enviar transações
    'receive',     // NUNCA expor endereços privados
    'balance',     // NUNCA expor balanços privados
    'inscribe',    // NUNCA criar inscriptions (requer wallet)
    'etch',        // NUNCA criar runes (requer wallet)
    'offer',       // NUNCA criar ofertas (requer wallet privada)
    'decode',      // Potencial info leak
    'env'          // NUNCA expor variáveis de ambiente
];

/**
 * Valida se um comando ORD é seguro para execução via API pública
 * @param {string} command - Comando ORD a ser executado
 * @returns {Object} - { safe: boolean, reason: string }
 */
export function validateOrdCommand(command) {
    console.log('\n🔒 ===== ORD SECURITY CHECK =====');
    console.log(`   Command: ${command}`);
    
    // Parse do comando
    const parts = command.trim().split(/\s+/);
    const mainCommand = parts[0];
    const subCommand = parts[1];
    
    // 1. Verificar se é um comando proibido
    for (const forbidden of FORBIDDEN_COMMANDS) {
        if (command.toLowerCase().includes(forbidden)) {
            console.log(`   ❌ BLOCKED: Contains forbidden keyword '${forbidden}'`);
            return {
                safe: false,
                reason: `Command contains forbidden operation: ${forbidden}`
            };
        }
    }
    
    // 2. Verificar se é um comando whitelisted
    if (SAFE_COMMANDS[subCommand]) {
        const config = SAFE_COMMANDS[subCommand];
        
        // Verificar número de argumentos
        if (parts.length - 2 > config.maxArgs) {
            console.log(`   ❌ BLOCKED: Too many arguments`);
            return {
                safe: false,
                reason: `Too many arguments for ${subCommand}`
            };
        }
        
        // Verificar padrão de argumentos se especificado
        if (config.argPattern && parts[2]) {
            if (!config.argPattern.test(parts[2])) {
                console.log(`   ❌ BLOCKED: Invalid argument format`);
                return {
                    safe: false,
                    reason: `Invalid argument format for ${subCommand}`
                };
            }
        }
        
        console.log(`   ✅ SAFE: Whitelisted command`);
        return { safe: true };
    }
    
    // 3. Se não está na whitelist, é proibido por padrão
    console.log(`   ❌ BLOCKED: Not in whitelist`);
    return {
        safe: false,
        reason: 'Command not in whitelist of safe operations'
    };
}

/**
 * Executa um comando ORD SOMENTE SE for seguro
 * @param {string} ordCliPath - Caminho para o executável ord
 * @param {string} command - Comando a ser executado
 * @returns {Promise<string>} - Output do comando
 * @throws {Error} - Se o comando não for seguro
 */
export async function executeSafeOrdCommand(ordCliPath, command) {
    // 1. Validar segurança
    const validation = validateOrdCommand(command);
    
    if (!validation.safe) {
        throw new Error(`SECURITY VIOLATION: ${validation.reason}`);
    }
    
    // 2. Executar comando validado
    console.log(`\n🚀 Executing safe command: ${ordCliPath} ${command}`);
    
    try {
        const { stdout, stderr } = await execAsync(`${ordCliPath} ${command}`);
        
        if (stderr) {
            console.warn('⚠️  stderr:', stderr);
        }
        
        console.log('✅ Command executed successfully');
        return stdout;
        
    } catch (error) {
        console.error('❌ Command execution failed:', error.message);
        throw error;
    }
}

/**
 * Wrapper seguro para consultas públicas de inscriptions
 */
export async function getPublicInscriptionData(ordCliPath, inscriptionId) {
    console.log(`\n📋 Getting public data for inscription: ${inscriptionId}`);
    
    // Validar formato do inscription ID
    if (!/^[a-f0-9]{64}i\d+$/i.test(inscriptionId)) {
        throw new Error('Invalid inscription ID format');
    }
    
    const command = `inscription ${inscriptionId}`;
    return await executeSafeOrdCommand(ordCliPath, command);
}

/**
 * Lista ofertas públicas (se disponível via ORD server público)
 * NOTA: Este comando lista APENAS ofertas públicas visíveis no indexador
 */
export async function listPublicOffers(ordCliPath) {
    console.log('\n📋 Listing public offers from ORD server');
    
    // Este comando lista ofertas públicas do servidor ORD, NÃO da wallet local
    const command = 'server --list-offers';
    
    try {
        return await executeSafeOrdCommand(ordCliPath, command);
    } catch (error) {
        console.warn('⚠️  ORD server may not support public offer listing');
        return null;
    }
}

/**
 * Exemplo de uso seguro
 */
export const USAGE_EXAMPLE = `
════════════════════════════════════════════════════════════════════
  🔒 ORD CLI SECURITY LAYER - EXEMPLO DE USO
════════════════════════════════════════════════════════════════════

✅ COMANDOS PERMITIDOS (via API pública):

1. Consultar dados públicos de uma inscription:
   await getPublicInscriptionData(ordPath, '55a082d4...i0')

2. Listar ofertas públicas do servidor ORD:
   await listPublicOffers(ordPath)

3. Verificar block height:
   await executeSafeOrdCommand(ordPath, 'blockheight')

════════════════════════════════════════════════════════════════════

❌ COMANDOS PROIBIDOS (nunca via API):

1. ord wallet create        → Criar wallet (PRIVADO)
2. ord wallet offer create  → Criar oferta (requer chave privada)
3. ord wallet send          → Enviar transação (PRIVADO)
4. ord wallet balance       → Ver balanço (PRIVADO)

════════════════════════════════════════════════════════════════════

💡 SOLUÇÃO PARA CRIAR OFERTAS:

Usuários criam ofertas LOCALMENTE em suas máquinas:
1. Instalam ORD CLI local
2. Executam: ord wallet offer create <id> <price>
3. Copiam PSBT gerado
4. Submetem PSBT via API: POST /api/offers/submit-psbt
5. API valida e publica a oferta

OU

Usam KrayWallet Extension que gerencia tudo localmente!

════════════════════════════════════════════════════════════════════
`;

export default {
    validateOrdCommand,
    executeSafeOrdCommand,
    getPublicInscriptionData,
    listPublicOffers,
    SAFE_COMMANDS,
    FORBIDDEN_COMMANDS
};

