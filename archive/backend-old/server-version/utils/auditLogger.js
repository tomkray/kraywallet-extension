import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Audit Logger - Sistema de logs de auditoria para ações críticas
 * 
 * Registra:
 * - Criação de ofertas
 * - Acessos a PSBTs
 * - Tentativas de compra
 * - Broadcasts de transações
 * - Validações de segurança
 * - Erros críticos
 * 
 * Em produção, considere:
 * - Enviar para serviço externo (Sentry, Datadog, etc)
 * - Armazenar em banco de dados separado
 * - Implementar rotação de logs
 * - Adicionar alertas em tempo real
 */

class AuditLogger {
    constructor() {
        // Criar diretório de logs se não existir
        this.logsDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
        
        this.auditLogPath = path.join(this.logsDir, 'audit.log');
        this.securityLogPath = path.join(this.logsDir, 'security.log');
    }

    /**
     * Formatar mensagem de log
     */
    formatLogMessage(level, category, action, data) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            category,
            action,
            ...data
        };
        
        return JSON.stringify(logEntry) + '\n';
    }

    /**
     * Escrever log no arquivo
     */
    writeLog(logPath, message) {
        try {
            fs.appendFileSync(logPath, message);
        } catch (error) {
            console.error('❌ Failed to write audit log:', error.message);
        }
    }

    /**
     * Log genérico de auditoria
     */
    log(level, category, action, data = {}) {
        const message = this.formatLogMessage(level, category, action, data);
        this.writeLog(this.auditLogPath, message);
        
        // Se for crítico, também escrever no console
        if (level === 'CRITICAL' || level === 'ERROR') {
            console.log(`🔔 AUDIT [${level}]:`, action, data);
        }
    }

    /**
     * Log de segurança (separado do audit)
     */
    securityLog(level, action, data = {}) {
        const message = this.formatLogMessage(level, 'SECURITY', action, data);
        this.writeLog(this.securityLogPath, message);
        
        // Sempre logar segurança no console
        console.log(`🛡️  SECURITY [${level}]:`, action);
    }

    // ==========================================
    // OFERTAS
    // ==========================================

    /**
     * Oferta criada
     */
    offerCreated(data) {
        this.log('INFO', 'OFFER', 'OFFER_CREATED', {
            offerId: data.offerId,
            type: data.type,
            inscriptionId: data.inscriptionId,
            price: data.price,
            sellerAddress: data.sellerAddress,
            psbtHash: data.psbtHash
        });
    }

    /**
     * Oferta cancelada
     */
    offerCancelled(data) {
        this.log('INFO', 'OFFER', 'OFFER_CANCELLED', {
            offerId: data.offerId,
            sellerAddress: data.sellerAddress,
            reason: data.reason
        });
    }

    /**
     * Oferta completada
     */
    offerCompleted(data) {
        this.log('INFO', 'OFFER', 'OFFER_COMPLETED', {
            offerId: data.offerId,
            txid: data.txid,
            sellerAddress: data.sellerAddress,
            buyerAddress: data.buyerAddress,
            price: data.price
        });
    }

    // ==========================================
    // PSBT
    // ==========================================

    /**
     * PSBT acessado
     */
    psbtAccessed(data) {
        this.log('INFO', 'PSBT', 'PSBT_ACCESSED', {
            offerId: data.offerId,
            buyerAddress: data.buyerAddress,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent
        });
    }

    /**
     * PSBT construído
     */
    psbtBuilt(data) {
        this.log('INFO', 'PSBT', 'PSBT_BUILT', {
            offerId: data.offerId,
            buyerAddress: data.buyerAddress,
            inputCount: data.inputCount,
            outputCount: data.outputCount,
            structuralHash: data.structuralHash
        });
    }

    // ==========================================
    // COMPRA
    // ==========================================

    /**
     * Tentativa de compra
     */
    purchaseAttempt(data) {
        this.log('INFO', 'PURCHASE', 'PURCHASE_ATTEMPT', {
            offerId: data.offerId,
            buyerAddress: data.buyerAddress,
            price: data.price
        });
    }

    /**
     * Compra bloqueada por lock
     */
    purchaseBlocked(data) {
        this.securityLog('WARN', 'PURCHASE_BLOCKED', {
            offerId: data.offerId,
            buyerAddress: data.buyerAddress,
            lockHolder: data.lockHolder,
            reason: data.reason
        });
    }

    /**
     * Compra bem-sucedida
     */
    purchaseSuccess(data) {
        this.log('INFO', 'PURCHASE', 'PURCHASE_SUCCESS', {
            offerId: data.offerId,
            txid: data.txid,
            buyerAddress: data.buyerAddress,
            sellerAddress: data.sellerAddress,
            price: data.price
        });
    }

    // ==========================================
    // SEGURANÇA
    // ==========================================

    /**
     * Validação de segurança passou
     */
    securityValidationPassed(data) {
        this.securityLog('INFO', 'VALIDATION_PASSED', {
            offerId: data.offerId,
            validationType: data.validationType,
            txid: data.txid
        });
    }

    /**
     * Validação de segurança falhou
     */
    securityValidationFailed(data) {
        this.securityLog('ERROR', 'VALIDATION_FAILED', {
            offerId: data.offerId,
            validationType: data.validationType,
            errors: data.errors,
            buyerAddress: data.buyerAddress
        });
    }

    /**
     * Tentativa de fraude detectada
     */
    fraudAttempt(data) {
        this.securityLog('CRITICAL', 'FRAUD_ATTEMPT', {
            offerId: data.offerId,
            buyerAddress: data.buyerAddress,
            fraudType: data.fraudType,
            details: data.details,
            ipAddress: data.ipAddress
        });
    }

    /**
     * UTXO já gasto
     */
    utxoSpent(data) {
        this.securityLog('WARN', 'UTXO_SPENT', {
            offerId: data.offerId,
            txid: data.txid,
            vout: data.vout,
            sellerAddress: data.sellerAddress
        });
    }

    // ==========================================
    // BROADCAST
    // ==========================================

    /**
     * Broadcast bem-sucedido
     */
    broadcastSuccess(data) {
        this.log('INFO', 'BROADCAST', 'BROADCAST_SUCCESS', {
            offerId: data.offerId,
            txid: data.txid,
            method: data.method // 'RPC' ou 'Mempool.space'
        });
    }

    /**
     * Broadcast falhou
     */
    broadcastFailed(data) {
        this.log('ERROR', 'BROADCAST', 'BROADCAST_FAILED', {
            offerId: data.offerId,
            txid: data.txid,
            error: data.error,
            method: data.method
        });
    }

    // ==========================================
    // ERROS
    // ==========================================

    /**
     * Erro crítico
     */
    criticalError(data) {
        this.log('CRITICAL', 'ERROR', 'CRITICAL_ERROR', {
            endpoint: data.endpoint,
            error: data.error,
            stack: data.stack,
            requestData: data.requestData
        });
    }

    // ==========================================
    // UTILITÁRIOS
    // ==========================================

    /**
     * Obter estatísticas dos logs
     */
    getStats() {
        try {
            const auditStats = fs.statSync(this.auditLogPath);
            const securityStats = fs.statSync(this.securityLogPath);
            
            return {
                auditLog: {
                    size: auditStats.size,
                    modified: auditStats.mtime
                },
                securityLog: {
                    size: securityStats.size,
                    modified: securityStats.mtime
                }
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Ler últimas N entradas do audit log
     */
    readRecentAudit(lines = 100) {
        try {
            const content = fs.readFileSync(this.auditLogPath, 'utf8');
            const allLines = content.trim().split('\n');
            const recentLines = allLines.slice(-lines);
            
            return recentLines.map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            }).filter(Boolean);
        } catch (error) {
            return [];
        }
    }

    /**
     * Ler últimas N entradas do security log
     */
    readRecentSecurity(lines = 100) {
        try {
            const content = fs.readFileSync(this.securityLogPath, 'utf8');
            const allLines = content.trim().split('\n');
            const recentLines = allLines.slice(-lines);
            
            return recentLines.map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            }).filter(Boolean);
        } catch (error) {
            return [];
        }
    }
}

// Instância global (singleton)
const auditLogger = new AuditLogger();

export default auditLogger;

