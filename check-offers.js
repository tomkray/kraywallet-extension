import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'server', 'db', 'ordinals.db');
const db = new Database(dbPath);

console.log('🔍 Verificando ofertas no banco de dados:\n');

const offers = db.prepare('SELECT * FROM offers WHERE status = "active"').all();

console.log(`Total ofertas ativas: ${offers.length}\n`);

offers.forEach((offer, index) => {
    // Decode PSBT to get UTXO
    const psbtBuffer = Buffer.from(offer.psbt, 'base64');
    const firstInputTxid = psbtBuffer.slice(10, 42).reverse().toString('hex');
    
    console.log(`${index + 1}. Offer ID: ${offer.id}`);
    console.log(`   Inscription: ${offer.inscription_id}`);
    console.log(`   Price: ${offer.offer_amount} sats`);
    console.log(`   Creator: ${offer.creator_address.substring(0, 20)}...`);
    console.log(`   PSBT first input TXID: ${firstInputTxid}`);
    console.log('');
});

db.close();
