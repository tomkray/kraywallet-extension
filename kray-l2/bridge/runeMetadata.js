/**
 * KRAY SPACE L2 - Rune Metadata Fetcher
 * 
 * Automatically fetches divisibility and metadata for runes
 * Primary: QuickNode
 * Fallback: Ordinals.com API
 */

import axios from 'axios';

const QUICKNODE_ENDPOINT = process.env.QUICKNODE_ENDPOINT;
const ORDINALS_API = 'https://ordinals.com/api';

/**
 * Get rune metadata (divisibility, name, symbol)
 * 
 * Returns real L1 divisibility to use on L2
 */
export async function getRuneMetadata(etchingId) {
  console.log(`\n🔍 Fetching metadata for etching: ${etchingId.substring(0, 16)}...`);

  // Try QuickNode first (if they have rune endpoint)
  const quicknodeData = await fetchFromQuickNode(etchingId);
  if (quicknodeData) {
    console.log(`   ✅ Got metadata from QuickNode`);
    return quicknodeData;
  }

  // Fallback to Ordinals.com
  console.log(`   ℹ️  QuickNode unavailable, trying Ordinals.com...`);
  const ordinalsData = await fetchFromOrdinals(etchingId);
  if (ordinalsData) {
    console.log(`   ✅ Got metadata from Ordinals.com`);
    return ordinalsData;
  }

  // Last resort: Use defaults
  console.warn(`   ⚠️  Could not fetch metadata, using defaults`);
  return getDefaultMetadata(etchingId);
}

/**
 * Fetch from QuickNode (if supported)
 */
async function fetchFromQuickNode(etchingId) {
  try {
    // QuickNode might have rune endpoints like:
    // POST with method: "rune_getinfo" or similar
    
    const response = await axios.post(QUICKNODE_ENDPOINT, {
      jsonrpc: '2.0',
      id: 1,
      method: 'rune_getinfo', // Try this method
      params: [etchingId]
    }, {
      timeout: 5000
    });

    if (response.data && response.data.result) {
      return {
        etching_id: etchingId,
        name: response.data.result.name,
        symbol: response.data.result.symbol,
        divisibility: response.data.result.divisibility || 0,
        source: 'QuickNode'
      };
    }

    return null;
  } catch (error) {
    // QuickNode doesn't support this method (expected)
    return null;
  }
}

/**
 * Fetch from Ordinals.com API
 */
async function fetchFromOrdinals(etchingId) {
  try {
    // Ordinals.com API endpoint (if exists)
    const response = await axios.get(`${ORDINALS_API}/rune/${etchingId}`, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.data) {
      return {
        etching_id: etchingId,
        name: response.data.spaced_name || response.data.name,
        symbol: response.data.symbol,
        divisibility: response.data.divisibility || 0,
        source: 'Ordinals.com'
      };
    }

    return null;
  } catch (error) {
    console.warn(`   ⚠️  Ordinals.com API error:`, error.message);
    return null;
  }
}

/**
 * Default metadata if all sources fail
 */
function getDefaultMetadata(etchingId) {
  // Known tokens with manual config
  const knownTokens = {
    '4aae35965730540004765070df639d0dd0485ec5d33a7181facac970e9225449': {
      name: 'KRAY•SPACE',
      symbol: 'KRAY',
      divisibility: 0, // Verified: indivisible on L1
      source: 'Manual'
    },
    'e79134080a83fe3e0e06ed6990c5a9b63b362313341745707a2bff7d788a1375': {
      name: 'DOG•GO•TO•THE•MOON',
      symbol: 'DOG',
      divisibility: 0, // Common for most runes
      source: 'Manual'
    },
    '8a18494da6e0d1902243220c397cdecf4de9d64020cf0fa9fa16adfc6e29e4ec': {
      name: 'DOG•SOCIAL•CLUB',
      symbol: 'DOGSOCIAL',
      divisibility: 0,
      source: 'Manual'
    },
    '046e7799f87248b24e60672c11d2e09d8a85b3cd562f1ab6e48fc8b8278afaad': {
      name: 'RADIOLA•MUSIC',
      symbol: 'RADIOLA',
      divisibility: 0,
      source: 'Manual'
    }
  };

  const known = knownTokens[etchingId];
  if (known) {
    return { etching_id: etchingId, ...known };
  }

  // Unknown token - use safe defaults
  return {
    etching_id: etchingId,
    name: 'Unknown Rune',
    symbol: etchingId.substring(0, 8).toUpperCase(),
    divisibility: 0, // Safe default: no decimals
    source: 'Default'
  };
}

/**
 * Calculate credits per token based on divisibility
 */
export function calculateCreditsPerToken(divisibility) {
  // For L2, we add consistent fractionation
  // Base: 10^divisibility for the token itself
  // + 3 extra decimals for L2 micro-transactions
  
  const l1Multiplier = Math.pow(10, divisibility);
  const l2ExtraDecimals = 1000; // 3 extra decimals
  
  return l1Multiplier * l2ExtraDecimals;
}

/**
 * Auto-configure token for L2
 */
export async function autoConfigureToken(etchingId) {
  const metadata = await getRuneMetadata(etchingId);
  
  const l1Decimals = metadata.divisibility;
  const l2Decimals = l1Decimals + 3; // L1 decimals + 3 extra for L2
  const creditsPerToken = calculateCreditsPerToken(l1Decimals);

  console.log(`\n📊 Token Configuration:`);
  console.log(`   Name: ${metadata.name}`);
  console.log(`   Symbol: ${metadata.symbol}`);
  console.log(`   L1 Decimals: ${l1Decimals}`);
  console.log(`   L2 Decimals: ${l2Decimals}`);
  console.log(`   Credits: 1 token = ${creditsPerToken} credits`);
  console.log(`   Source: ${metadata.source}`);

  return {
    name: metadata.name,
    symbol: metadata.symbol,
    etching_id: etchingId,
    decimals_l1: l1Decimals,
    decimals_l2: l2Decimals,
    credits_per_token: creditsPerToken,
    min_deposit: l1Decimals > 0 ? Math.pow(10, -l1Decimals) : 1,
    min_withdrawal: l1Decimals > 0 ? Math.pow(10, -l1Decimals) : 1,
    is_gas_token: false
  };
}

export default {
  getRuneMetadata,
  calculateCreditsPerToken,
  autoConfigureToken
};







