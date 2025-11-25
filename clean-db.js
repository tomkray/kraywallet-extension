import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'server/db/ordinals.db');
const db = new Database(DB_PATH);

console.log('🗑️  Cleaning database...\n');

// Deletar todas as offers
const deletedOffers = db.prepare('DELETE FROM offers').run();
console.log(`✅ Deleted ${deletedOffers.changes} offers`);

// Resetar inscriptions (listed = 0, price = NULL)
const resetInscriptions = db.prepare('UPDATE inscriptions SET listed = 0, price = NULL').run();
console.log(`✅ Reset ${resetInscriptions.changes} inscriptions (listed = 0)`);

// Mostrar offers restantes
const remainingOffers = db.prepare('SELECT COUNT(*) as count FROM offers').get();
console.log(`\n📊 Offers remaining: ${remainingOffers.count}`);

// Mostrar inscriptions
const inscriptions = db.prepare('SELECT id, inscription_number, listed FROM inscriptions').all();
console.log(`📊 Inscriptions in DB: ${inscriptions.length}`);
inscriptions.forEach(i => {
    console.log(`   - #${i.inscription_number}: ${i.id.substring(0, 20)}... (listed: ${i.listed})`);
});

db.close();
console.log('\n✅ Database cleaned successfully!');



