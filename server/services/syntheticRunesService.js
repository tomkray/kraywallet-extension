/**
 * 🌩️ SYNTHETIC RUNES SERVICE
 * 
 * Sistema híbrido L1 + L2 para trading de runes:
 * - L1: Runes reais travadas no pool
 * - L2: Synthetic runes (IOUs) para trading instantâneo via Lightning
 * - Redeem: Converter synthetic → real (L1) on-demand
 * 
 * Analogia: Pool L1 = Banco, Synthetic L2 = Cartão de débito
 */

import { db } from '../db/init-supabase.js';

class SyntheticRunesService {
    
    /**
     * ═══════════════════════════════════════════════════════════════════════════
     * 🏗️ POOL INITIALIZATION
     * ═══════════════════════════════════════════════════════════════════════════
     */
    
    /**
     * Inicializar virtual pool state após criar pool L1
     */
    async initializeVirtualPool(poolId, btcAmount, runeAmount) {
        console.log('\n🌩️ Initializing virtual pool state...');
        console.log('   Pool ID:', poolId);
        console.log('   Initial BTC:', btcAmount, 'sats');
        console.log('   Initial Runes:', runeAmount);
        
        const k = btcAmount * runeAmount;
        
        await db.run(`
            INSERT INTO virtual_pool_state (
                pool_id, virtual_btc, virtual_rune_amount, k, last_update
            ) VALUES (?, ?, ?, ?, ?)
        `, [poolId, btcAmount, runeAmount, k, Date.now()]);
        
        console.log('   ✅ Virtual pool initialized!');
        console.log('   AMM constant k:', k);
        
        return {
            success: true,
            poolId,
            virtualBtc: btcAmount,
            virtualRunes: runeAmount,
            k
        };
    }
    
    /**
     * ═══════════════════════════════════════════════════════════════════════════
     * 💱 SWAP OPERATIONS (L2 - INSTANTANEOUS)
     * ═══════════════════════════════════════════════════════════════════════════
     */
    
    /**
     * Calcular swap usando AMM (Constant Product Formula)
     * x * y = k
     */
    async calculateSwap(poolId, fromAsset, toAsset, amountIn, feeRate = 0.003) {
        console.log('\n💱 Calculating swap...');
        console.log('   Pool:', poolId);
        console.log('   From:', fromAsset);
        console.log('   To:', toAsset);
        console.log('   Amount in:', amountIn);
        
        // Buscar estado virtual da pool
        const poolState = await db.get(`
            SELECT * FROM virtual_pool_state WHERE pool_id = ?
        `, [poolId]);
        
        if (!poolState) {
            throw new Error('Virtual pool not found');
        }
        
        const { virtual_btc, virtual_rune_amount, k } = poolState;
        
        console.log('   Current state:');
        console.log('     Virtual BTC:', virtual_btc, 'sats');
        console.log('     Virtual Runes:', virtual_rune_amount);
        console.log('     k:', k);
        
        // Calcular fee
        const fee = Math.floor(amountIn * feeRate);
        const amountInAfterFee = amountIn - fee;
        
        let amountOut, newBtc, newRunes, executionPrice, originalPrice;
        
        if (fromAsset === 'BTC') {
            // BTC → Runes
            originalPrice = virtual_btc / virtual_rune_amount;
            
            newBtc = virtual_btc + amountInAfterFee;
            newRunes = k / newBtc;
            amountOut = virtual_rune_amount - newRunes;
            
            executionPrice = amountIn / amountOut;
            
        } else {
            // Runes → BTC
            originalPrice = virtual_rune_amount / virtual_btc;
            
            newRunes = virtual_rune_amount + amountInAfterFee;
            newBtc = k / newRunes;
            amountOut = virtual_btc - newBtc;
            
            executionPrice = amountIn / amountOut;
        }
        
        // Calcular slippage
        const slippage = ((executionPrice - originalPrice) / originalPrice) * 100;
        
        console.log('   Calculation result:');
        console.log('     Fee:', fee, fromAsset);
        console.log('     Amount out:', amountOut.toFixed(8), toAsset);
        console.log('     New BTC:', newBtc, 'sats');
        console.log('     New Runes:', newRunes.toFixed(8));
        console.log('     Execution price:', executionPrice.toFixed(8));
        console.log('     Slippage:', slippage.toFixed(2), '%');
        
        return {
            success: true,
            amountOut: fromAsset === 'BTC' ? amountOut : Math.floor(amountOut),
            fee,
            executionPrice,
            originalPrice,
            slippage,
            newBtc,
            newRunes,
            priceImpact: slippage
        };
    }
    
    /**
     * Executar swap (atualizar estado virtual)
     */
    async executeSwap(swapId, poolId, userAddress, fromAsset, toAsset, amountIn, amountOut, fee, price, slippage) {
        console.log('\n⚡ Executing swap...');
        console.log('   Swap ID:', swapId);
        console.log('   User:', userAddress);
        
        const swapType = fromAsset === 'BTC' ? 'buy_synthetic' : 'sell_synthetic';
        
        // 1. Registrar swap no banco
        await db.run(`
            INSERT INTO lightning_swaps (
                swap_id, pool_id, user_address, swap_type,
                from_asset, to_asset, amount_in, amount_out,
                fee_sats, price, slippage, status, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', datetime('now'))
        `, [
            swapId, poolId, userAddress, swapType,
            fromAsset, toAsset, amountIn, amountOut,
            fee, price, slippage
        ]);
        
        // 2. Atualizar estado virtual da pool
        const calculation = await this.calculateSwap(poolId, fromAsset, toAsset, amountIn);
        
        await db.run(`
            UPDATE virtual_pool_state
            SET virtual_btc = ?,
                virtual_rune_amount = ?,
                last_update = ?
            WHERE pool_id = ?
        `, [calculation.newBtc, calculation.newRunes, Date.now(), poolId]);
        
        // 3. Se comprou synthetic runes, criar/atualizar balance virtual
        if (fromAsset === 'BTC') {
            const pool = await db.get(`SELECT rune_id FROM lightning_pools WHERE pool_id = ?`, [poolId]);
            
            await db.run(`
                INSERT INTO virtual_balances (
                    user_address, pool_id, rune_id, virtual_amount, status
                ) VALUES (?, ?, ?, ?, 'active')
            `, [userAddress, poolId, pool.rune_id, amountOut]);
            
            console.log('   ✅ Created virtual balance:', amountOut, 'synthetic runes');
        }
        
        // 4. Se vendeu synthetic runes, marcar como redeemed
        if (toAsset === 'BTC') {
            // Deduzir do balance virtual do usuário
            await this._deductVirtualBalance(userAddress, poolId, amountIn);
            
            console.log('   ✅ Deducted virtual balance:', amountIn, 'synthetic runes');
        }
        
        console.log('   ✅ Swap executed successfully!');
        
        return {
            success: true,
            swapId,
            amountOut: calculation.amountOut
        };
    }
    
    /**
     * ═══════════════════════════════════════════════════════════════════════════
     * 💰 BALANCE MANAGEMENT
     * ═══════════════════════════════════════════════════════════════════════════
     */
    
    /**
     * Obter balance virtual do usuário
     */
    async getVirtualBalance(userAddress, poolId) {
        const result = await db.get(`
            SELECT 
                COALESCE(SUM(virtual_amount), 0) as total_balance,
                COUNT(*) as transaction_count
            FROM virtual_balances
            WHERE user_address = ?
                AND pool_id = ?
                AND status = 'active'
        `, [userAddress, poolId]);
        
        return {
            success: true,
            balance: result.total_balance,
            transactionCount: result.transaction_count
        };
    }
    
    /**
     * Deduzir do balance virtual (interno)
     */
    async _deductVirtualBalance(userAddress, poolId, amount) {
        // Buscar balances ativos (FIFO - First In First Out)
        const balances = await db.all(`
            SELECT id, virtual_amount
            FROM virtual_balances
            WHERE user_address = ?
                AND pool_id = ?
                AND status = 'active'
            ORDER BY created_at ASC
        `, [userAddress, poolId]);
        
        let remaining = amount;
        
        for (const balance of balances) {
            if (remaining <= 0) break;
            
            if (balance.virtual_amount <= remaining) {
                // Marcar como redeemed
                await db.run(`
                    UPDATE virtual_balances
                    SET status = 'redeemed', redeemed_at = datetime('now')
                    WHERE id = ?
                `, [balance.id]);
                
                remaining -= balance.virtual_amount;
            } else {
                // Reduzir parcialmente
                await db.run(`
                    UPDATE virtual_balances
                    SET virtual_amount = virtual_amount - ?
                    WHERE id = ?
                `, [remaining, balance.id]);
                
                remaining = 0;
            }
        }
        
        if (remaining > 0) {
            throw new Error('Insufficient virtual balance');
        }
    }
    
    /**
     * ═══════════════════════════════════════════════════════════════════════════
     * 🔄 REDEMPTION (L2 → L1)
     * ═══════════════════════════════════════════════════════════════════════════
     */
    
    /**
     * Solicitar resgate de synthetic → real runes
     */
    async requestRedemption(userAddress, poolId, amount) {
        console.log('\n💰 Redemption requested...');
        console.log('   User:', userAddress);
        console.log('   Pool:', poolId);
        console.log('   Amount:', amount, 'synthetic runes');
        
        // 1. Validar balance virtual
        const balance = await this.getVirtualBalance(userAddress, poolId);
        
        if (balance.balance < amount) {
            throw new Error(`Insufficient virtual balance. Have ${balance.balance}, need ${amount}`);
        }
        
        // 2. Buscar pool info
        const pool = await db.get(`
            SELECT rune_id, rune_amount
            FROM lightning_pools
            WHERE pool_id = ?
        `, [poolId]);
        
        // 3. Validar que pool tem runes suficientes
        const totalSynthetic = await db.get(`
            SELECT COALESCE(SUM(virtual_amount), 0) as total
            FROM virtual_balances
            WHERE pool_id = ? AND status = 'active'
        `, [poolId]);
        
        const availableForRedemption = pool.rune_amount - totalSynthetic.total;
        
        if (availableForRedemption < amount) {
            throw new Error(`Insufficient pool liquidity. Available: ${availableForRedemption.toFixed(8)}`);
        }
        
        // 4. Criar redemption request
        const redemptionId = `redeem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await db.run(`
            INSERT INTO redemptions (
                redemption_id, user_address, pool_id, rune_id,
                virtual_amount, real_amount, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `, [redemptionId, userAddress, poolId, pool.rune_id, amount, amount]);
        
        // 5. Marcar balance virtual como locked (não pode ser usado até redemption completar)
        await db.run(`
            UPDATE virtual_balances
            SET status = 'locked'
            WHERE user_address = ?
                AND pool_id = ?
                AND status = 'active'
                AND id IN (
                    SELECT id FROM virtual_balances
                    WHERE user_address = ? AND pool_id = ? AND status = 'active'
                    ORDER BY created_at ASC
                    LIMIT 1
                )
        `, [userAddress, poolId, userAddress, poolId]);
        
        console.log('   ✅ Redemption request created!');
        console.log('   Redemption ID:', redemptionId);
        console.log('   Status: pending (awaiting L1 TX)');
        
        return {
            success: true,
            redemptionId,
            amount,
            status: 'pending',
            message: 'Redemption request created. L1 transaction will be broadcasted soon.'
        };
    }
    
    /**
     * Completar redemption após broadcast L1
     */
    async completeRedemption(redemptionId, txid, vout, feeSats) {
        console.log('\n✅ Completing redemption...');
        console.log('   Redemption ID:', redemptionId);
        console.log('   TXID:', txid);
        
        await db.run(`
            UPDATE redemptions
            SET txid = ?,
                vout = ?,
                fee_sats = ?,
                status = 'broadcasted',
                broadcasted_at = datetime('now')
            WHERE redemption_id = ?
        `, [txid, vout, feeSats, redemptionId]);
        
        // Marcar virtual balances como redeemed
        const redemption = await db.get(`
            SELECT * FROM redemptions WHERE redemption_id = ?
        `, [redemptionId]);
        
        await this._deductVirtualBalance(redemption.user_address, redemption.pool_id, redemption.virtual_amount);
        
        console.log('   ✅ Redemption completed!');
        console.log('   Status: broadcasted (awaiting confirmation)');
        
        return {
            success: true,
            redemptionId,
            txid,
            status: 'broadcasted'
        };
    }
    
    /**
     * Confirmar redemption após confirmação L1
     */
    async confirmRedemption(redemptionId, confirmations) {
        await db.run(`
            UPDATE redemptions
            SET status = 'confirmed',
                confirmations = ?,
                confirmed_at = datetime('now')
            WHERE redemption_id = ?
        `, [confirmations, redemptionId]);
        
        console.log('   ✅ Redemption confirmed!');
        console.log('   Confirmations:', confirmations);
        
        return { success: true, redemptionId, confirmations };
    }
    
    /**
     * ═══════════════════════════════════════════════════════════════════════════
     * 📥 DEPOSITS (L1 → L2)
     * ═══════════════════════════════════════════════════════════════════════════
     */
    
    /**
     * Registrar depósito de runes reais para obter synthetic
     */
    async registerDeposit(userAddress, poolId, runeId, amount, txid, vout) {
        console.log('\n📥 Registering deposit...');
        console.log('   User:', userAddress);
        console.log('   Amount:', amount, 'real runes');
        console.log('   TXID:', txid);
        
        const depositId = `deposit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await db.run(`
            INSERT INTO deposits (
                deposit_id, user_address, pool_id, rune_id,
                real_amount, virtual_amount, txid, vout, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [depositId, userAddress, poolId, runeId, amount, amount, txid, vout]);
        
        console.log('   ✅ Deposit registered!');
        console.log('   Deposit ID:', depositId);
        console.log('   Status: pending (awaiting confirmation)');
        
        return {
            success: true,
            depositId,
            amount,
            status: 'pending'
        };
    }
    
    /**
     * Creditar synthetic runes após confirmação do depósito
     */
    async creditDeposit(depositId, confirmations) {
        console.log('\n💳 Crediting deposit...');
        console.log('   Deposit ID:', depositId);
        console.log('   Confirmations:', confirmations);
        
        const deposit = await db.get(`
            SELECT * FROM deposits WHERE deposit_id = ?
        `, [depositId]);
        
        if (!deposit) {
            throw new Error('Deposit not found');
        }
        
        if (deposit.status === 'credited') {
            console.log('   ⚠️  Already credited');
            return { success: true, message: 'Already credited' };
        }
        
        // Creditar synthetic runes
        await db.run(`
            INSERT INTO virtual_balances (
                user_address, pool_id, rune_id, virtual_amount, status
            ) VALUES (?, ?, ?, ?, 'active')
        `, [deposit.user_address, deposit.pool_id, deposit.rune_id, deposit.virtual_amount]);
        
        // Atualizar pool L1 amount
        await db.run(`
            UPDATE lightning_pools
            SET rune_amount = rune_amount + ?
            WHERE pool_id = ?
        `, [deposit.real_amount, deposit.pool_id]);
        
        // Atualizar pool virtual amount
        await db.run(`
            UPDATE virtual_pool_state
            SET virtual_rune_amount = virtual_rune_amount + ?,
                last_update = ?
            WHERE pool_id = ?
        `, [deposit.real_amount, Date.now(), deposit.pool_id]);
        
        // Marcar deposit como credited
        await db.run(`
            UPDATE deposits
            SET status = 'credited',
                confirmations = ?,
                confirmed_at = datetime('now'),
                credited_at = datetime('now')
            WHERE deposit_id = ?
        `, [confirmations, depositId]);
        
        console.log('   ✅ Synthetic runes credited!');
        console.log('   Amount:', deposit.virtual_amount);
        
        return {
            success: true,
            depositId,
            creditedAmount: deposit.virtual_amount
        };
    }
    
    /**
     * ═══════════════════════════════════════════════════════════════════════════
     * 🔍 AUDIT & SECURITY
     * ═══════════════════════════════════════════════════════════════════════════
     */
    
    /**
     * Auditar pool (verificar invariantes)
     */
    async auditPool(poolId) {
        console.log('\n🔍 Auditing pool...');
        console.log('   Pool ID:', poolId);
        
        // 1. Buscar estado L1 (real)
        const l1Pool = await db.get(`
            SELECT btc_amount, rune_amount FROM lightning_pools WHERE pool_id = ?
        `, [poolId]);
        
        // 2. Buscar estado L2 (virtual)
        const l2Pool = await db.get(`
            SELECT virtual_btc, virtual_rune_amount FROM virtual_pool_state WHERE pool_id = ?
        `, [poolId]);
        
        // 3. Calcular total synthetic issued
        const synthetic = await db.get(`
            SELECT COALESCE(SUM(virtual_amount), 0) as total
            FROM virtual_balances
            WHERE pool_id = ? AND status IN ('active', 'locked')
        `, [poolId]);
        
        const totalSyntheticIssued = synthetic.total;
        
        // 4. Calcular métricas
        const reserveRatio = (l1Pool.rune_amount - totalSyntheticIssued) / l1Pool.rune_amount;
        const utilization = totalSyntheticIssued / l1Pool.rune_amount;
        
        const btcDiscrepancy = l1Pool.btc_amount - l2Pool.virtual_btc;
        const runeDiscrepancy = l1Pool.rune_amount - l2Pool.virtual_rune_amount;
        
        // 5. Verificar saúde
        let healthy = true;
        let warnings = [];
        
        if (reserveRatio < 0) {
            healthy = false;
            warnings.push('CRITICAL: Negative reserve ratio! More synthetic issued than real runes!');
        }
        
        if (reserveRatio < 0.1) {
            warnings.push('WARNING: Low reserve ratio (<10%). Consider pausing redemptions.');
        }
        
        if (Math.abs(btcDiscrepancy) > 1000) {
            warnings.push(`BTC discrepancy: ${btcDiscrepancy} sats`);
        }
        
        if (Math.abs(runeDiscrepancy) > 0.01) {
            warnings.push(`Rune discrepancy: ${runeDiscrepancy.toFixed(8)} runes`);
        }
        
        // 6. Salvar log de auditoria
        await db.run(`
            INSERT INTO pool_audit_log (
                pool_id, l1_btc_balance, l1_rune_balance,
                virtual_btc_balance, virtual_rune_balance, total_synthetic_issued,
                reserve_ratio, utilization, healthy,
                btc_discrepancy, rune_discrepancy, warning_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            poolId, l1Pool.btc_amount, l1Pool.rune_amount,
            l2Pool.virtual_btc, l2Pool.virtual_rune_amount, totalSyntheticIssued,
            reserveRatio, utilization, healthy ? 1 : 0,
            btcDiscrepancy, runeDiscrepancy, warnings.join('; ')
        ]);
        
        console.log('   📊 Audit results:');
        console.log('     L1 Runes:', l1Pool.rune_amount);
        console.log('     L2 Virtual:', l2Pool.virtual_rune_amount);
        console.log('     Synthetic Issued:', totalSyntheticIssued);
        console.log('     Reserve Ratio:', (reserveRatio * 100).toFixed(2), '%');
        console.log('     Utilization:', (utilization * 100).toFixed(2), '%');
        console.log('     Healthy:', healthy ? '✅' : '❌');
        
        if (warnings.length > 0) {
            console.log('     ⚠️  Warnings:');
            warnings.forEach(w => console.log('       -', w));
        }
        
        return {
            success: true,
            healthy,
            l1Btc: l1Pool.btc_amount,
            l1Runes: l1Pool.rune_amount,
            l2Btc: l2Pool.virtual_btc,
            l2Runes: l2Pool.virtual_rune_amount,
            totalSyntheticIssued,
            reserveRatio,
            utilization,
            btcDiscrepancy,
            runeDiscrepancy,
            warnings
        };
    }
    
    /**
     * Obter estatísticas da pool
     */
    async getPoolStats(poolId) {
        const stats = await db.get(`
            SELECT 
                vps.*,
                lp.rune_name,
                lp.btc_amount as l1_btc,
                lp.rune_amount as l1_runes,
                lp.status
            FROM virtual_pool_state vps
            JOIN lightning_pools lp ON vps.pool_id = lp.pool_id
            WHERE vps.pool_id = ?
        `, [poolId]);
        
        const synthetic = await db.get(`
            SELECT COALESCE(SUM(virtual_amount), 0) as total
            FROM virtual_balances
            WHERE pool_id = ? AND status = 'active'
        `, [poolId]);
        
        return {
            success: true,
            poolId,
            runeName: stats.rune_name,
            l1: {
                btc: stats.l1_btc,
                runes: stats.l1_runes
            },
            l2: {
                btc: stats.virtual_btc,
                runes: stats.virtual_rune_amount
            },
            syntheticIssued: synthetic.total,
            totalSwaps: stats.total_swaps,
            totalVolume: stats.total_volume_btc,
            feesCollected: stats.fees_collected_btc,
            status: stats.status
        };
    }
}

export default new SyntheticRunesService();

