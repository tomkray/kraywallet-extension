import express from 'express';
import { db } from '../db/init-supabase.js';
import ordApi from '../utils/ordApi.js';

const router = express.Router();

// GET /api/ordinals - Listar todas as inscriptions
router.get('/', (req, res) => {
    try {
        const { search, sort = 'recent', listed = 'all', limit = 50, offset = 0 } = req.query;

        // 🔗 JOIN com offers para incluir offer_id e só mostrar com ofertas ativas
        let query = `
            SELECT 
                i.*,
                o.id as offer_id,
                o.offer_amount,
                o.status as offer_status
            FROM inscriptions i
            LEFT JOIN offers o ON i.id = o.inscription_id AND o.status = 'active'
            WHERE 1=1
        `;
        const params = [];

        // Filtro de busca
        if (search) {
            query += ' AND (i.id LIKE ? OR i.inscription_number LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // Filtro de listado
        if (listed !== 'all') {
            if (listed === 'true') {
                // Se listed=true, só mostrar inscriptions que TÊM ofertas ativas
                query += ' AND o.id IS NOT NULL';
            } else {
                // Se listed=false, só mostrar inscriptions SEM ofertas
                query += ' AND o.id IS NULL';
            }
        }

        // Ordenação
        switch (sort) {
            case 'price-low':
                query += ' ORDER BY price ASC';
                break;
            case 'price-high':
                query += ' ORDER BY price DESC';
                break;
            case 'number':
                query += ' ORDER BY inscription_number ASC';
                break;
            default:
                query += ' ORDER BY inscription_number DESC';
        }

        // Paginação
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const inscriptions = db.prepare(query).all(...params);
        
        console.log(`📋 Loaded ${inscriptions.length} inscriptions (listed=${listed}, total=${inscriptions.length})`);
        if (listed === 'true') {
            console.log(`   → Showing only inscriptions WITH active offers`);
        }

        // Contar total com o mesmo JOIN
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM inscriptions i
            LEFT JOIN offers o ON i.id = o.inscription_id AND o.status = 'active'
            WHERE 1=1
        `;
        const countParams = [];
        if (search) {
            countQuery += ' AND (i.id LIKE ? OR i.inscription_number LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }
        if (listed !== 'all') {
            if (listed === 'true') {
                countQuery += ' AND o.id IS NOT NULL';
            } else {
                countQuery += ' AND o.id IS NULL';
            }
        }

        const { total } = db.prepare(countQuery).get(...countParams);

        res.json({
            inscriptions,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + inscriptions.length < total
            }
        });
    } catch (error) {
        console.error('Error fetching inscriptions:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/ordinals/:id - Buscar inscription específica
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Primeiro tentar buscar no banco de dados local
        let inscription = db.prepare('SELECT * FROM inscriptions WHERE id = ? OR inscription_number = ?').get(id, id);

        // Se não encontrar, buscar no Ord Server
        if (!inscription) {
            try {
                inscription = await ordApi.getInscription(id);
            } catch (ordError) {
                return res.status(404).json({ error: 'Inscription not found' });
            }
        }

        res.json(inscription);
    } catch (error) {
        console.error('Error fetching inscription:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/ordinals/:id/content - Obter conteúdo da inscription
router.get('/:id/content', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Buscar conteúdo do Ord Server
        const content = await ordApi.getInscriptionContent(id);
        
        // Detectar tipo de conteúdo
        let contentType = 'application/octet-stream';
        
        // Tentar detectar automaticamente pelo magic bytes
        const buffer = Buffer.from(content);
        
        // PNG
        if (buffer.slice(0, 4).toString('hex') === '89504e47') {
            contentType = 'image/png';
        } 
        // JPEG
        else if (buffer.slice(0, 2).toString('hex') === 'ffd8') {
            contentType = 'image/jpeg';
        } 
        // GIF
        else if (buffer.slice(0, 6).toString() === 'GIF87a' || buffer.slice(0, 6).toString() === 'GIF89a') {
            contentType = 'image/gif';
        } 
        // WEBP (RIFF header)
        else if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') {
            contentType = 'image/webp';
        }
        // SVG
        else if (buffer.slice(0, 5).toString() === '<?xml' || buffer.slice(0, 4).toString() === '<svg' || buffer.toString().includes('<svg')) {
            contentType = 'image/svg+xml';
        }
        // Tentar buscar do Ord Server também
        else {
            try {
                const inscription = await ordApi.getInscription(id);
                if (inscription?.content_type) {
                    contentType = inscription.content_type;
                }
            } catch (err) {
                // Manter detecção automática
            }
        }
        
        // Headers para exibição correta
        res.set({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*'
        });
        
        res.send(content);
    } catch (error) {
        console.error('Error fetching inscription content:', error);
        
        // Retornar placeholder SVG em caso de erro
        res.set('Content-Type', 'image/svg+xml');
        res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
            <rect width="200" height="200" fill="#1a1a2e"/>
            <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#666" font-size="60">📄</text>
            <text x="50%" y="75%" text-anchor="middle" fill="#888" font-size="12">Content not found</text>
        </svg>`);
    }
});

// POST /api/ordinals/:id/list - Listar inscription para venda
router.post('/:id/list', async (req, res) => {
    try {
        const { id } = req.params;
        const { price, address } = req.body;

        if (!price || price <= 0) {
            return res.status(400).json({ error: 'Invalid price' });
        }

        // Tentar atualizar primeiro
        const result = db.prepare(`
            UPDATE inscriptions 
            SET listed = 1, price = ?, owner = ?
            WHERE id = ?
        `).run(price, address, id);

        // Se não existir, criar
        if (result.changes === 0) {
            // Buscar info do Ord Server
            let inscriptionNumber = null;
            let contentType = 'unknown';
            
            try {
                const inscData = await ordApi.getInscription(id);
                inscriptionNumber = inscData.number || inscData.inscription_number;
                contentType = inscData.content_type || 'unknown';
            } catch (err) {
                // Usar dados básicos se não conseguir do Ord
                inscriptionNumber = parseInt(id.match(/i(\d+)$/)?.[1]) || null;
            }
            
            // Criar nova inscription
            db.prepare(`
                INSERT INTO inscriptions (id, inscription_number, content_type, listed, price, owner)
                VALUES (?, ?, ?, 1, ?, ?)
            `).run(id, inscriptionNumber, contentType, price, address);
        }

        res.json({ success: true, message: 'Inscription listed successfully' });
    } catch (error) {
        console.error('Error listing inscription:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/ordinals/:id/unlist - Remover inscription da venda
router.delete('/:id/unlist', (req, res) => {
    try {
        const { id } = req.params;

        const result = db.prepare(`
            UPDATE inscriptions 
            SET listed = 0, price = NULL
            WHERE id = ?
        `).run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Inscription not found' });
        }

        res.json({ success: true, message: 'Inscription unlisted successfully' });
    } catch (error) {
        console.error('Error unlisting inscription:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/ordinals/latest - Buscar últimas inscriptions
router.get('/latest', async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        
        const inscriptions = await ordApi.getLatestInscriptions(parseInt(limit));
        
        res.json({
            success: true,
            inscriptions
        });
    } catch (error) {
        console.error('Error fetching latest inscriptions:', error);
        res.status(500).json({ 
            error: error.message,
            inscriptions: []
        });
    }
});

// GET /api/ordinals/by-address/:address - Buscar inscriptions por address
router.get('/by-address/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const { search } = req.query; // 🔍 Novo: query parameter para busca
        
        console.log(`🔍 Searching inscriptions for address: ${address} via ORD server`);
        if (search) {
            console.log(`   🔎 Search query: "${search}"`);
        }
        
        // ✅ BUSCAR DIRETO DO ORD SERVER (não do banco de dados)
        let inscriptions = await ordApi.getInscriptionsByAddress(address);
        
        console.log(`✅ Found ${inscriptions.length} inscriptions for ${address}`);
        
        // 🔍 APLICAR FILTRO DE BUSCA se fornecido
        if (search && search.trim()) {
            const searchLower = search.toLowerCase().trim();
            console.log(`   📊 Total before filter: ${inscriptions.length}`);
            
            inscriptions = inscriptions.filter(inscription => {
                const id = (inscription.inscription_id || inscription.id || '').toLowerCase();
                const number = (inscription.inscription_number || inscription.number || '').toString();
                
                const matchId = id.includes(searchLower);
                const matchNumber = number.includes(searchLower);
                
                if (matchId || matchNumber) {
                    console.log(`      ✅ Match: #${number} (${id.substring(0, 16)}...)`);
                }
                
                return matchId || matchNumber;
            });
            
            console.log(`   🎯 Total after filter: ${inscriptions.length}`);
        }
        
        res.json({
            success: true,
            inscriptions,
            count: inscriptions.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching inscriptions by address:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            inscriptions: []
        });
    }
});

// GET /api/ordinals/search-by-wallet/:address/:query - Buscar inscription específica via ORD direto
router.get('/search-by-wallet/:address/:query', async (req, res) => {
    try {
        const { address, query } = req.params;
        
        console.log(`🔍 Direct ORD search for address: ${address}`);
        console.log(`   Query: "${query}"`);
        
        // 🔍 BUSCAR DIRETO NO ORD SERVER pela inscription específica
        // Primeiro tentar buscar por inscription ID
        try {
            const inscriptionDetails = await ordApi.getInscriptionDetails(query);
            console.log(`   📋 Found inscription by ID:`, inscriptionDetails);
            
            // Verificar se pertence ao endereço
            if (inscriptionDetails && inscriptionDetails.address === address) {
                console.log(`   ✅ Inscription belongs to address!`);
                return res.json({
                    success: true,
                    inscriptions: [{
                        inscription_id: inscriptionDetails.inscription_id || query,
                        inscription_number: inscriptionDetails.inscription_number,
                        content_type: inscriptionDetails.content_type,
                        address: inscriptionDetails.address
                    }],
                    count: 1
                });
            } else {
                console.log(`   ⚠️  Inscription does NOT belong to this address`);
            }
        } catch (inscError) {
            console.log(`   ℹ️  Not found by ID, trying by number...`);
        }
        
        // Se não encontrou por ID, buscar todas e filtrar
        const allInscriptions = await ordApi.getInscriptionsByAddress(address);
        console.log(`   📦 Total inscriptions: ${allInscriptions.length}`);
        
        const queryLower = query.toLowerCase();
        const filtered = allInscriptions.filter(inscription => {
            const id = (inscription.inscription_id || inscription.id || '').toLowerCase();
            const number = (inscription.inscription_number || inscription.number || '').toString();
            
            return id.includes(queryLower) || number.includes(queryLower);
        });
        
        console.log(`   🎯 Filtered results: ${filtered.length}`);
        
        res.json({
            success: true,
            inscriptions: filtered,
            count: filtered.length
        });
        
    } catch (error) {
        console.error('❌ Error in direct ORD search:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            inscriptions: []
        });
    }
});

// GET /api/ordinals/details/:inscriptionId - Buscar detalhes completos de uma inscription
router.get('/details/:inscriptionId', async (req, res) => {
    try {
        const { inscriptionId } = req.params;
        
        console.log(`🔍 Fetching detailed info for inscription: ${inscriptionId}`);
        
        // Buscar detalhes do ORD server
        const details = await ordApi.getInscriptionDetails(inscriptionId);
        
        console.log(`✅ Fetched details for ${inscriptionId}:`, details);
        
        res.json({
            success: true,
            inscription: details
        });
        
    } catch (error) {
        console.error('❌ Error fetching inscription details:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;


