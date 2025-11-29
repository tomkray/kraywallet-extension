/**
 * KRAY SPACE L2 - Ordinal Trading
 * 
 * Instant Ordinal inscription trading on L2
 * Zero confirmation risk, instant settlement
 */

import { getDatabase, transaction } from '../core/database.js';
import { getAccount, transfer } from '../state/accountManager.js';
import { executeTransaction } from '../state/transactionExecutor.js';
import crypto from 'crypto';

/**
 * List ordinal for sale on L2
 */
export function listOrdinal(sellerAccount, inscriptionId, priceCredits) {
  return transaction(() => {
    const db = getDatabase();

    console.log('\n🖼️  Listing ordinal on L2...');
    console.log(`   Seller: ${sellerAccount}`);
    console.log(`   Inscription: ${inscriptionId}`);
    console.log(`   Price: ${priceCredits} credits`);

    const seller = getAccount(sellerAccount);

    if (!seller) {
      throw new Error('Seller account not found');
    }

    const price = BigInt(priceCredits);

    if (price <= 0n) {
      throw new Error('Price must be positive');
    }

    // Verify seller owns the inscription (would check L1 or L2 state)
    // For now, assume ownership is verified

    const listingId = `list_${crypto.randomBytes(16).toString('hex')}`;
    const timestamp = Date.now();

    db.prepare(`
      INSERT INTO l2_marketplace_listings (
        listing_id, seller_account,
        asset_type, asset_id, asset_amount,
        price_credits, status,
        listed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      listingId,
      sellerAccount,
      'ordinal',
      inscriptionId,
      null, // Ordinals are 1:1, no amount
      priceCredits.toString(),
      'active',
      timestamp
    );

    console.log(`✅ Ordinal listed: ${listingId}`);

    return {
      listing_id: listingId,
      inscription_id: inscriptionId,
      price: priceCredits.toString(),
      status: 'active'
    };
  });
}

/**
 * Buy ordinal from L2 listing
 */
export function buyOrdinal(listingId, buyerAccount) {
  return transaction(() => {
    const db = getDatabase();

    console.log(`\n💰 Buying ordinal...`);
    console.log(`   Listing: ${listingId}`);
    console.log(`   Buyer: ${buyerAccount}`);

    const listing = getListing(listingId);

    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.status !== 'active') {
      throw new Error(`Listing not active: ${listing.status}`);
    }

    const buyer = getAccount(buyerAccount);
    const seller = getAccount(listing.seller_account);

    if (!buyer) {
      throw new Error('Buyer account not found');
    }

    if (!seller) {
      throw new Error('Seller account not found');
    }

    if (buyerAccount === listing.seller_account) {
      throw new Error('Cannot buy your own listing');
    }

    const price = BigInt(listing.price_credits);
    const buyerBalance = BigInt(buyer.balance_credits);

    if (buyerBalance < price) {
      throw new Error(`Insufficient balance: ${buyerBalance} < ${price}`);
    }

    // Transfer payment (buyer → seller)
    transfer(buyerAccount, listing.seller_account, price);

    // Update listing
    const timestamp = Date.now();

    db.prepare(`
      UPDATE l2_marketplace_listings
      SET status = 'sold',
          buyer_account = ?,
          sold_at = ?
      WHERE listing_id = ?
    `).run(buyerAccount, timestamp, listingId);

    console.log(`✅ Ordinal purchased!`);
    console.log(`   Buyer paid: ${price} credits`);
    console.log(`   Instant settlement!`);

    return {
      listing_id: listingId,
      inscription_id: listing.asset_id,
      buyer: buyerAccount,
      seller: listing.seller_account,
      price: price.toString(),
      timestamp
    };
  });
}

/**
 * Cancel listing
 */
export function cancelListing(listingId, sellerAccount) {
  return transaction(() => {
    const db = getDatabase();

    console.log(`\n❌ Cancelling listing ${listingId}...`);

    const listing = getListing(listingId);

    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.seller_account !== sellerAccount) {
      throw new Error('Only seller can cancel listing');
    }

    if (listing.status !== 'active') {
      throw new Error(`Cannot cancel ${listing.status} listing`);
    }

    const timestamp = Date.now();

    db.prepare(`
      UPDATE l2_marketplace_listings
      SET status = 'cancelled',
          cancelled_at = ?
      WHERE listing_id = ?
    `).run(timestamp, listingId);

    console.log(`✅ Listing cancelled`);

    return { listing_id: listingId, status: 'cancelled' };
  });
}

/**
 * Get listing by ID
 */
export function getListing(listingId) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM l2_marketplace_listings WHERE listing_id = ?
  `).get(listingId);
}

/**
 * Get active listings
 */
export function getActiveListings(assetType = null, limit = 50, offset = 0) {
  const db = getDatabase();

  let query = `
    SELECT * FROM l2_marketplace_listings
    WHERE status = 'active'
  `;

  const params = [];

  if (assetType) {
    query += ` AND asset_type = ?`;
    params.push(assetType);
  }

  query += ` ORDER BY listed_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

/**
 * Get user's listings
 */
export function getUserListings(accountId, status = null) {
  const db = getDatabase();

  let query = `
    SELECT * FROM l2_marketplace_listings
    WHERE seller_account = ?
  `;

  const params = [accountId];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY listed_at DESC`;

  return db.prepare(query).all(...params);
}

/**
 * Get marketplace statistics
 */
export function getMarketplaceStats() {
  const db = getDatabase();

  return {
    total_listings: db.prepare('SELECT COUNT(*) as count FROM l2_marketplace_listings').get()?.count || 0,
    
    active_listings: db.prepare(`
      SELECT COUNT(*) as count FROM l2_marketplace_listings WHERE status = 'active'
    `).get()?.count || 0,

    sold: db.prepare(`
      SELECT COUNT(*) as count FROM l2_marketplace_listings WHERE status = 'sold'
    `).get()?.count || 0,

    total_volume: db.prepare(`
      SELECT SUM(CAST(price_credits AS INTEGER)) as total 
      FROM l2_marketplace_listings 
      WHERE status = 'sold'
    `).get()?.total || 0,

    by_type: db.prepare(`
      SELECT asset_type, COUNT(*) as count, status
      FROM l2_marketplace_listings
      GROUP BY asset_type, status
    `).all()
  };
}

export default {
  listOrdinal,
  buyOrdinal,
  cancelListing,
  getListing,
  getActiveListings,
  getUserListings,
  getMarketplaceStats
};

