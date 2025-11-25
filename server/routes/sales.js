import express from 'express';
import { db } from '../db/init-supabase.js';

const router = express.Router();

// GET /api/sales - Listar histórico de vendas
router.get('/', (req, res) => {
    try {
        const { inscription_id, seller, buyer, limit = 50, offset = 0 } = req.query;

        let query = 'SELECT * FROM sales_history WHERE 1=1';
        const params = [];

        if (inscription_id) {
            query += ' AND inscription_id = ?';
            params.push(inscription_id);
        }

        if (seller) {
            query += ' AND seller_address = ?';
            params.push(seller);
        }

        if (buyer) {
            query += ' AND buyer_address = ?';
            params.push(buyer);
        }

        query += ' ORDER BY sale_date DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const sales = db.prepare(query).all(...params);

        // Contar total
        let countQuery = 'SELECT COUNT(*) as total FROM sales_history WHERE 1=1';
        const countParams = [];
        if (inscription_id) {
            countQuery += ' AND inscription_id = ?';
            countParams.push(inscription_id);
        }
        if (seller) {
            countQuery += ' AND seller_address = ?';
            countParams.push(seller);
        }
        if (buyer) {
            countQuery += ' AND buyer_address = ?';
            countParams.push(buyer);
        }

        const { total } = db.prepare(countQuery).get(...countParams);

        res.json({
            sales,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + sales.length < total
            }
        });
    } catch (error) {
        console.error('Error fetching sales history:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sales/inscription/:id - Histórico de uma inscription específica
router.get('/inscription/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        const sales = db.prepare(`
            SELECT * FROM sales_history 
            WHERE inscription_id = ? 
            ORDER BY sale_date DESC
        `).all(id);

        // Calcular estatísticas
        const stats = {
            total_sales: sales.length,
            highest_price: sales.length > 0 ? Math.max(...sales.map(s => s.sale_price)) : 0,
            lowest_price: sales.length > 0 ? Math.min(...sales.map(s => s.sale_price)) : 0,
            average_price: sales.length > 0 ? Math.round(sales.reduce((sum, s) => sum + s.sale_price, 0) / sales.length) : 0,
            last_sale_price: sales.length > 0 ? sales[0].sale_price : 0,
            last_sale_date: sales.length > 0 ? sales[0].sale_date : null
        };

        res.json({
            inscription_id: id,
            sales,
            stats
        });
    } catch (error) {
        console.error('Error fetching inscription sales history:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sales/stats - Estatísticas gerais do marketplace
router.get('/stats', (req, res) => {
    try {
        // Total de vendas
        const { total_sales } = db.prepare('SELECT COUNT(*) as total_sales FROM sales_history').get();
        
        // Volume total
        const { total_volume } = db.prepare('SELECT SUM(sale_price) as total_volume FROM sales_history').get();
        
        // Preço médio
        const { avg_price } = db.prepare('SELECT AVG(sale_price) as avg_price FROM sales_history').get();
        
        // Vendas nas últimas 24h
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const { sales_24h } = db.prepare('SELECT COUNT(*) as sales_24h FROM sales_history WHERE sale_date > ?').get(oneDayAgo);
        
        // Volume nas últimas 24h
        const { volume_24h } = db.prepare('SELECT SUM(sale_price) as volume_24h FROM sales_history WHERE sale_date > ?').get(oneDayAgo);
        
        // Top vendedores
        const topSellers = db.prepare(`
            SELECT seller_address, COUNT(*) as sales_count, SUM(sale_price) as total_volume
            FROM sales_history
            GROUP BY seller_address
            ORDER BY total_volume DESC
            LIMIT 10
        `).all();
        
        // Últimas vendas
        const recentSales = db.prepare(`
            SELECT * FROM sales_history
            ORDER BY sale_date DESC
            LIMIT 10
        `).all();

        res.json({
            total_sales: total_sales || 0,
            total_volume: total_volume || 0,
            average_price: Math.round(avg_price) || 0,
            sales_24h: sales_24h || 0,
            volume_24h: volume_24h || 0,
            top_sellers: topSellers,
            recent_sales: recentSales
        });
    } catch (error) {
        console.error('Error fetching marketplace stats:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;



