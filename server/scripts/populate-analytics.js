/**
 * 🔄 Populate Analytics Script
 * 
 * Este script sincroniza todos os dados históricos com o sistema de analytics:
 * - Cria perfis para todos os usuários que deram likes
 * - Cria perfis para todos os compradores/vendedores
 * - Calcula reputação baseada em atividades
 * - Popula user_analytics com ações históricas
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../db/ordinals.db');

console.log('🔄 Starting analytics population...\n');

const db = new Database(DB_PATH);

// Função para criar/atualizar perfil
function ensureProfile(address) {
    let profile = db.prepare('SELECT * FROM user_profiles WHERE address = ?').get(address);
    
    if (!profile) {
        const avatarSeed = crypto.createHash('sha256').update(address).digest('hex');
        const joinDate = Date.now();
        
        db.prepare(`
            INSERT INTO user_profiles (
                address, avatar_seed, avatar_style, reputation_score,
                join_date, last_activity
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(address, avatarSeed, 'identicon', 0, joinDate, joinDate);
        
        console.log(`✅ Created profile for: ${address.substring(0, 20)}...`);
        profile = db.prepare('SELECT * FROM user_profiles WHERE address = ?').get(address);
    }
    
    return profile;
}

// Função para calcular reputação
function calculateReputationScore(profile) {
    let score = 0;
    
    // Sales activity (max 30 points)
    score += Math.min(profile.total_sales * 2, 30);
    
    // Purchase activity (max 20 points)
    score += Math.min(profile.total_purchases * 1, 20);
    
    // Volume sold (max 25 points) - 1 point per 10k sats
    score += Math.min(Math.floor(profile.total_volume_sold / 10000), 25);
    
    // Likes received (max 15 points)
    score += Math.min(profile.total_likes_received * 0.5, 15);
    
    // Likes given (max 10 points) - community engagement
    score += Math.min(profile.total_likes_given * 0.2, 10);
    
    return Math.floor(score);
}

try {
    // 1️⃣ PROCESSAR LIKES
    console.log('\n1️⃣  Processing likes...');
    const likes = db.prepare('SELECT * FROM offer_likes').all();
    
    const likesByAddress = {};
    likes.forEach(like => {
        if (!likesByAddress[like.address]) {
            likesByAddress[like.address] = 0;
        }
        likesByAddress[like.address]++;
    });
    
    for (const [address, count] of Object.entries(likesByAddress)) {
        ensureProfile(address);
        db.prepare('UPDATE user_profiles SET total_likes_given = ? WHERE address = ?')
            .run(count, address);
        console.log(`   💝 ${address.substring(0, 20)}... → ${count} likes given`);
    }
    
    // 2️⃣ PROCESSAR VENDAS (SELLERS)
    console.log('\n2️⃣  Processing sales (sellers)...');
    const sales = db.prepare('SELECT seller_address, COUNT(*) as count, SUM(sale_price) as volume FROM sales_history GROUP BY seller_address').all();
    
    sales.forEach(sale => {
        ensureProfile(sale.seller_address);
        db.prepare(`
            UPDATE user_profiles 
            SET total_sales = ?, 
                total_volume_sold = ? 
            WHERE address = ?
        `).run(sale.count, sale.volume, sale.seller_address);
        console.log(`   🤝 ${sale.seller_address.substring(0, 20)}... → ${sale.count} sales, ${sale.volume} sats`);
    });
    
    // 3️⃣ PROCESSAR COMPRAS (BUYERS)
    console.log('\n3️⃣  Processing purchases (buyers)...');
    const purchases = db.prepare('SELECT buyer_address, COUNT(*) as count, SUM(sale_price) as volume FROM sales_history GROUP BY buyer_address').all();
    
    purchases.forEach(purchase => {
        ensureProfile(purchase.buyer_address);
        db.prepare(`
            UPDATE user_profiles 
            SET total_purchases = ?, 
                total_volume_bought = ? 
            WHERE address = ?
        `).run(purchase.count, purchase.volume, purchase.buyer_address);
        console.log(`   🛒 ${purchase.buyer_address.substring(0, 20)}... → ${purchase.count} purchases, ${purchase.volume} sats`);
    });
    
    // 4️⃣ CALCULAR LIKES RECEBIDOS
    console.log('\n4️⃣  Calculating likes received...');
    const likesReceived = db.prepare(`
        SELECT o.creator_address, COUNT(*) as count
        FROM offer_likes ol
        JOIN offers o ON ol.offer_id = o.id
        GROUP BY o.creator_address
    `).all();
    
    likesReceived.forEach(lr => {
        if (lr.creator_address) {
            ensureProfile(lr.creator_address);
            db.prepare('UPDATE user_profiles SET total_likes_received = ? WHERE address = ?')
                .run(lr.count, lr.creator_address);
            console.log(`   💝 ${lr.creator_address.substring(0, 20)}... → ${lr.count} likes received`);
        }
    });
    
    // 5️⃣ CALCULAR REPUTAÇÃO
    console.log('\n5️⃣  Calculating reputation scores...');
    const allProfiles = db.prepare('SELECT * FROM user_profiles').all();
    
    allProfiles.forEach(profile => {
        const reputationScore = calculateReputationScore(profile);
        db.prepare('UPDATE user_profiles SET reputation_score = ? WHERE address = ?')
            .run(reputationScore, profile.address);
        console.log(`   ⭐ ${profile.address.substring(0, 20)}... → ${reputationScore} pts`);
    });
    
    // 6️⃣ POPULAR USER_ANALYTICS COM HISTÓRICO
    console.log('\n6️⃣  Populating user_analytics with historical data...');
    
    // Adicionar likes ao histórico
    likes.forEach(like => {
        db.prepare(`
            INSERT OR IGNORE INTO user_analytics 
            (address, action_type, action_data, offer_id, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            like.address,
            'like',
            JSON.stringify({ offer_id: like.offer_id }),
            like.offer_id,
            like.created_at
        );
    });
    console.log(`   ✅ Added ${likes.length} likes to analytics`);
    
    // Adicionar vendas ao histórico
    const allSales = db.prepare('SELECT * FROM sales_history').all();
    allSales.forEach(sale => {
        // Venda para o seller
        db.prepare(`
            INSERT OR IGNORE INTO user_analytics 
            (address, action_type, action_data, inscription_id, amount, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            sale.seller_address,
            'sale_completed',
            JSON.stringify({ txid: sale.txid, buyer: sale.buyer_address }),
            sale.inscription_id,
            sale.sale_price,
            sale.sale_date
        );
        
        // Compra para o buyer
        db.prepare(`
            INSERT OR IGNORE INTO user_analytics 
            (address, action_type, action_data, inscription_id, amount, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            sale.buyer_address,
            'purchase',
            JSON.stringify({ txid: sale.txid, seller: sale.seller_address }),
            sale.inscription_id,
            sale.sale_price,
            sale.sale_date
        );
    });
    console.log(`   ✅ Added ${allSales.length * 2} sale/purchase events to analytics`);
    
    // 7️⃣ RESUMO FINAL
    console.log('\n📊 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const stats = {
        total_profiles: db.prepare('SELECT COUNT(*) as count FROM user_profiles').get().count,
        total_actions: db.prepare('SELECT COUNT(*) as count FROM user_analytics').get().count,
        total_likes: db.prepare('SELECT COUNT(*) as count FROM offer_likes').get().count,
        total_sales: db.prepare('SELECT COUNT(*) as count FROM sales_history').get().count
    };
    
    console.log(`   👥 Total Profiles: ${stats.total_profiles}`);
    console.log(`   📊 Total Actions Tracked: ${stats.total_actions}`);
    console.log(`   💝 Total Likes: ${stats.total_likes}`);
    console.log(`   🤝 Total Sales: ${stats.total_sales}`);
    
    // Top 5 by reputation
    console.log('\n🏆 TOP 5 BY REPUTATION:');
    const top5 = db.prepare(`
        SELECT address, reputation_score, total_sales, total_purchases, total_likes_received
        FROM user_profiles 
        ORDER BY reputation_score DESC 
        LIMIT 5
    `).all();
    
    top5.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.address.substring(0, 30)}... (${user.reputation_score} pts)`);
        console.log(`      Sales: ${user.total_sales} | Purchases: ${user.total_purchases} | Likes: ${user.total_likes_received}`);
    });
    
    console.log('\n✅ Analytics population completed successfully!\n');
    
} catch (error) {
    console.error('❌ Error populating analytics:', error);
    process.exit(1);
} finally {
    db.close();
}

