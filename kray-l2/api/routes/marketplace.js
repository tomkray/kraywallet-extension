/**
 * KRAY SPACE L2 - Marketplace API Routes
 */

import express from 'express';
import { listOrdinal, buyOrdinal, cancelListing, getActiveListings, getUserListings, getMarketplaceStats } from '../../marketplace/ordinalTrading.js';

const router = express.Router();

/**
 * GET /api/marketplace/listings
 * Get active listings
 */
router.get('/listings', async (req, res) => {
  try {
    const assetType = req.query.type || null;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const listings = getActiveListings(assetType, limit, offset);

    res.json({
      listings,
      limit,
      offset
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketplace/list
 * List item for sale
 */
router.post('/list', async (req, res) => {
  try {
    const { seller_account, inscription_id, price_credits } = req.body;

    if (!seller_account || !inscription_id || !price_credits) {
      return res.status(400).json({ 
        error: 'seller_account, inscription_id, and price_credits are required' 
      });
    }

    const result = listOrdinal(seller_account, inscription_id, price_credits);

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/marketplace/buy
 * Buy listed item
 */
router.post('/buy', async (req, res) => {
  try {
    const { listing_id, buyer_account } = req.body;

    if (!listing_id || !buyer_account) {
      return res.status(400).json({ 
        error: 'listing_id and buyer_account are required' 
      });
    }

    const result = buyOrdinal(listing_id, buyer_account);

    res.json({
      ...result,
      message: 'Purchase completed instantly on L2!'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/marketplace/cancel
 * Cancel listing
 */
router.post('/cancel', async (req, res) => {
  try {
    const { listing_id, seller_account } = req.body;

    if (!listing_id || !seller_account) {
      return res.status(400).json({ 
        error: 'listing_id and seller_account are required' 
      });
    }

    const result = cancelListing(listing_id, seller_account);

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/marketplace/user/:account/listings
 * Get user's listings
 */
router.get('/user/:account/listings', async (req, res) => {
  try {
    const { account } = req.params;
    const status = req.query.status || null;

    const listings = getUserListings(account, status);

    res.json({ listings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/marketplace/stats
 * Get marketplace statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = getMarketplaceStats();

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;





