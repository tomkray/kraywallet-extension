/**
 * Purchase Locks - Sistema de locks temporários para prevenir:
 * - Front-running
 * - Double-purchase
 * - Race conditions
 * 
 * Em produção, migrar para Redis para suportar múltiplas instâncias do servidor
 */

class PurchaseLocks {
    constructor() {
        // Map: offerId -> { buyerAddress, timestamp, expiresAt }
        this.locks = new Map();
        
        // Limpar locks expirados a cada 1 minuto
        setInterval(() => this.cleanExpiredLocks(), 60000);
    }

    /**
     * Tentar obter lock para compra
     * @param {string} offerId - ID da oferta
     * @param {string} buyerAddress - Endereço do comprador
     * @param {number} ttl - Tempo de vida do lock em ms (padrão: 5 minutos)
     * @returns {Object} { success: boolean, reason?: string, holder?: string }
     */
    tryLock(offerId, buyerAddress, ttl = 300000) {
        const now = Date.now();
        const existingLock = this.locks.get(offerId);
        
        // Verificar se já existe lock
        if (existingLock) {
            // Lock expirado? Liberar e tentar novamente
            if (now > existingLock.expiresAt) {
                console.log(`🔓 Lock expired for offer ${offerId}, releasing...`);
                this.locks.delete(offerId);
            } else {
                // Lock ainda válido
                if (existingLock.buyerAddress === buyerAddress) {
                    // Mesmo comprador tentando novamente - renovar lock
                    console.log(`🔄 Renewing lock for offer ${offerId} (buyer: ${buyerAddress})`);
                    existingLock.expiresAt = now + ttl;
                    return { success: true, renewed: true };
                } else {
                    // Outro comprador tentando - rejeitar
                    const remainingTime = Math.ceil((existingLock.expiresAt - now) / 1000);
                    console.log(`🔒 Lock held by another buyer for offer ${offerId} (${remainingTime}s remaining)`);
                    return { 
                        success: false, 
                        reason: `Another buyer is currently purchasing this item. Please try again in ${remainingTime} seconds.`,
                        holder: existingLock.buyerAddress,
                        expiresIn: remainingTime
                    };
                }
            }
        }
        
        // Criar novo lock
        const lock = {
            buyerAddress,
            timestamp: now,
            expiresAt: now + ttl
        };
        
        this.locks.set(offerId, lock);
        console.log(`🔒 Lock acquired for offer ${offerId} by ${buyerAddress} (expires in ${ttl/1000}s)`);
        
        return { success: true };
    }

    /**
     * Liberar lock manualmente
     * @param {string} offerId - ID da oferta
     * @param {string} buyerAddress - Endereço do comprador (validação)
     * @returns {boolean} Se o lock foi liberado
     */
    unlock(offerId, buyerAddress) {
        const existingLock = this.locks.get(offerId);
        
        if (!existingLock) {
            return false; // Não existe lock
        }
        
        // Validar que é o mesmo comprador
        if (existingLock.buyerAddress !== buyerAddress) {
            console.warn(`⚠️  Attempt to unlock offer ${offerId} by wrong buyer: ${buyerAddress} (holder: ${existingLock.buyerAddress})`);
            return false;
        }
        
        this.locks.delete(offerId);
        console.log(`🔓 Lock released for offer ${offerId} by ${buyerAddress}`);
        return true;
    }

    /**
     * Verificar se oferta está locked
     * @param {string} offerId - ID da oferta
     * @returns {Object|null} Lock info ou null se não locked
     */
    isLocked(offerId) {
        const lock = this.locks.get(offerId);
        
        if (!lock) {
            return null;
        }
        
        const now = Date.now();
        
        if (now > lock.expiresAt) {
            // Lock expirado
            this.locks.delete(offerId);
            return null;
        }
        
        return {
            buyerAddress: lock.buyerAddress,
            timestamp: lock.timestamp,
            expiresAt: lock.expiresAt,
            remainingTime: Math.ceil((lock.expiresAt - now) / 1000)
        };
    }

    /**
     * Limpar locks expirados
     */
    cleanExpiredLocks() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [offerId, lock] of this.locks.entries()) {
            if (now > lock.expiresAt) {
                this.locks.delete(offerId);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} expired purchase lock(s)`);
        }
    }

    /**
     * Obter estatísticas dos locks
     */
    getStats() {
        const now = Date.now();
        const activeLocks = [];
        
        for (const [offerId, lock] of this.locks.entries()) {
            if (now <= lock.expiresAt) {
                activeLocks.push({
                    offerId,
                    buyerAddress: lock.buyerAddress,
                    remainingTime: Math.ceil((lock.expiresAt - now) / 1000)
                });
            }
        }
        
        return {
            totalLocks: this.locks.size,
            activeLocks: activeLocks.length,
            locks: activeLocks
        };
    }
}

// Instância global (singleton)
const purchaseLocks = new PurchaseLocks();

export default purchaseLocks;

