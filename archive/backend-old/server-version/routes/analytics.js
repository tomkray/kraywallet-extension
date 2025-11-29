import express from 'express';
import { db } from '../db/init-supabase.js';
import crypto from 'crypto';

const router = express.Router();

// 📊 Track user action
router.post('/track', async (req, res) => {
    try {
        const { address, action_type, action_data, offer_id, inscription_id, rune_id, amount } = req.body;
        
        if (!address || !action_type) {
            return res.status(400).json({
                success: false,
                error: 'Address and action_type are required'
            });
        }
        
        // Ensure user profile exists
        const profile = db.prepare('SELECT * FROM user_profiles WHERE address = ?').get(address);
        
        if (!profile) {
            // Create new profile with avatar seed
            const avatarSeed = crypto.createHash('sha256').update(address).digest('hex');
            const joinDate = Date.now();
            
            db.prepare(`
                INSERT INTO user_profiles (
                    address, avatar_seed, avatar_style, reputation_score,
                    join_date, last_activity
                ) VALUES (?, ?, ?, ?, ?, ?)
            `).run(address, avatarSeed, 'identicon', 0, joinDate, joinDate);
        }
        
        // Track action
        const created_at = Date.now();
        const result = db.prepare(`
            INSERT INTO user_analytics (
                address, action_type, action_data, offer_id, inscription_id,
                rune_id, amount, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            address,
            action_type,
            action_data ? JSON.stringify(action_data) : null,
            offer_id || null,
            inscription_id || null,
            rune_id || null,
            amount || null,
            created_at
        );
        
        // Update profile last_activity
        db.prepare('UPDATE user_profiles SET last_activity = ? WHERE address = ?')
            .run(created_at, address);
        
        // Update specific counters based on action type
        if (action_type === 'like') {
            db.prepare('UPDATE user_profiles SET total_likes_given = total_likes_given + 1 WHERE address = ?')
                .run(address);
        } else if (action_type === 'list_offer') {
            // Increment when listing
            db.prepare('UPDATE user_profiles SET total_sales = total_sales + 1 WHERE address = ?')
                .run(address);
        } else if (action_type === 'purchase') {
            db.prepare('UPDATE user_profiles SET total_purchases = total_purchases + 1, total_volume_bought = total_volume_bought + ? WHERE address = ?')
                .run(amount || 0, address);
        } else if (action_type === 'sale_completed') {
            db.prepare('UPDATE user_profiles SET total_volume_sold = total_volume_sold + ? WHERE address = ?')
                .run(amount || 0, address);
        }
        
        // Calculate reputation score
        const updatedProfile = db.prepare('SELECT * FROM user_profiles WHERE address = ?').get(address);
        const reputationScore = calculateReputationScore(updatedProfile);
        
        db.prepare('UPDATE user_profiles SET reputation_score = ? WHERE address = ?')
            .run(reputationScore, address);
        
        return res.json({
            success: true,
            action_id: result.lastInsertRowid,
            reputation_score: reputationScore
        });
        
    } catch (error) {
        console.error('❌ Error tracking action:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 👤 Get user profile
router.get('/profile/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        
        
        let profile = db.prepare('SELECT * FROM user_profiles WHERE address = ?').get(address);
        
        // Create profile if doesn't exist
        if (!profile) {
            const avatarSeed = crypto.createHash('sha256').update(address).digest('hex');
            const joinDate = Date.now();
            
            db.prepare(`
                INSERT INTO user_profiles (
                    address, avatar_seed, avatar_style, reputation_score,
                    join_date, last_activity
                ) VALUES (?, ?, ?, ?, ?, ?)
            `).run(address, avatarSeed, 'identicon', 0, joinDate, joinDate);
            
            profile = db.prepare('SELECT * FROM user_profiles WHERE address = ?').get(address);
        }
        
        // Get recent activity
        const recentActivity = db.prepare(`
            SELECT * FROM user_analytics 
            WHERE address = ? 
            ORDER BY created_at DESC 
            LIMIT 20
        `).all(address);
        
        // Get likes received (on user's offers)
        const likesReceived = db.prepare(`
            SELECT COUNT(*) as count
            FROM offer_likes ol
            JOIN offers o ON ol.offer_id = o.id
            WHERE o.creator_address = ?
        `).get(address);
        
        profile.total_likes_received = likesReceived?.count || 0;
        
        
        
        return res.json({
            success: true,
            profile: profile,
            recent_activity: recentActivity.map(a => ({
                ...a,
                action_data: a.action_data ? JSON.parse(a.action_data) : null
            }))
        });
        
    } catch (error) {
        console.error('❌ Error getting profile:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🏆 Get leaderboard
router.get('/leaderboard/:type?', async (req, res) => {
    try {
        const { type = 'reputation' } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        
        
        
        let orderBy = 'up.reputation_score DESC';
        
        switch (type) {
            case 'sales':
                orderBy = 'up.total_sales DESC';
                break;
            case 'volume':
                orderBy = 'up.total_volume_sold DESC';
                break;
            case 'likes':
                orderBy = 'total_likes_received DESC';
                break;
            case 'purchases':
                orderBy = 'up.total_purchases DESC';
                break;
        }
        
        const leaderboard = db.prepare(`
            SELECT 
                up.address,
                up.avatar_seed,
                up.avatar_style,
                up.display_name,
                up.reputation_score,
                up.total_sales,
                up.total_purchases,
                up.total_likes_given,
                up.total_volume_sold,
                up.total_volume_bought,
                up.join_date,
                up.last_activity,
                COALESCE((
                    SELECT COUNT(*)
                    FROM offer_likes ol
                    JOIN offers o ON ol.offer_id = o.id
                    WHERE o.creator_address = up.address
                ), 0) as total_likes_received
            FROM user_profiles up
            ORDER BY ${orderBy}
            LIMIT ?
        `).all(limit);
        
        
        
        return res.json({
            success: true,
            type: type,
            leaderboard: leaderboard
        });
        
    } catch (error) {
        console.error('❌ Error getting leaderboard:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 📈 Get global stats
router.get('/stats', async (req, res) => {
    try {
        
        
        const stats = {
            total_users: 0,
            total_actions: 0,
            total_likes: 0,
            total_sales: 0,
            total_volume: 0,
            top_action_types: []
        };
        
        // Total users
        const users = db.prepare('SELECT COUNT(*) as count FROM user_profiles').get();
        stats.total_users = users.count;
        
        // Total actions
        const actions = db.prepare('SELECT COUNT(*) as count FROM user_analytics').get();
        stats.total_actions = actions.count;
        
        // Total likes
        const likes = db.prepare('SELECT COUNT(*) as count FROM offer_likes').get();
        stats.total_likes = likes.count;
        
        // Total sales
        const sales = db.prepare('SELECT COUNT(*) as count FROM sales_history').get();
        stats.total_sales = sales.count;
        
        // Total volume
        const volume = db.prepare('SELECT SUM(sale_price) as total FROM sales_history').get();
        stats.total_volume = volume.total || 0;
        
        // Top action types
        const topActions = db.prepare(`
            SELECT action_type, COUNT(*) as count 
            FROM user_analytics 
            GROUP BY action_type 
            ORDER BY count DESC 
            LIMIT 10
        `).all();
        stats.top_action_types = topActions;
        
        
        
        return res.json({
            success: true,
            stats: stats
        });
        
    } catch (error) {
        console.error('❌ Error getting stats:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🔍 Get user actions
router.get('/actions/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const action_type = req.query.type;
        
        
        
        let query = 'SELECT * FROM user_analytics WHERE address = ?';
        let params = [address];
        
        if (action_type) {
            query += ' AND action_type = ?';
            params.push(action_type);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);
        
        const actions = db.prepare(query).all(...params);
        
        
        
        return res.json({
            success: true,
            address: address,
            actions: actions.map(a => ({
                ...a,
                action_data: a.action_data ? JSON.parse(a.action_data) : null
            }))
        });
        
    } catch (error) {
        console.error('❌ Error getting actions:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🎨 Update user profile
router.put('/profile/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const { display_name, bio, avatar_style } = req.body;
        
        
        
        let profile = db.prepare('SELECT * FROM user_profiles WHERE address = ?').get(address);
        
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
        }
        
        // Update profile
        if (display_name !== undefined) {
            db.prepare('UPDATE user_profiles SET display_name = ? WHERE address = ?')
                .run(display_name, address);
        }
        
        if (bio !== undefined) {
            db.prepare('UPDATE user_profiles SET bio = ? WHERE address = ?')
                .run(bio, address);
        }
        
        if (avatar_style !== undefined) {
            db.prepare('UPDATE user_profiles SET avatar_style = ? WHERE address = ?')
                .run(avatar_style, address);
        }
        
        profile = db.prepare('SELECT * FROM user_profiles WHERE address = ?').get(address);
        
        
        
        return res.json({
            success: true,
            profile: profile
        });
        
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🧮 Calculate reputation score
function calculateReputationScore(profile) {
    if (!profile) return 0;
    
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

export default router;

