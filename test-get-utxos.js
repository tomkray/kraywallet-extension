import runesDecoder from './server/utils/runesDecoder.js';

const address = 'bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx';
const runeName = 'LOBO•THE•WOLF•PUP';

console.log('🧪 Testing getRuneUtxos directly...');
console.log('Address:', address);
console.log('Rune:', runeName);
console.log('');

const utxos = await runesDecoder.getRuneUtxos(address, runeName);

console.log('');
console.log('📊 RESULT:');
console.log('UTXOs found:', utxos.length);
console.log('UTXOs:', JSON.stringify(utxos, null, 2));

