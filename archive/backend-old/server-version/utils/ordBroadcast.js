import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Broadcast transaction using ord CLI
 * Ord has better support for Runes/Ordinals transactions
 */
export async function broadcastViaOrd(txHex) {
    try {
        console.log('🔷 Attempting broadcast via ord CLI...');
        
        // Path to ord binary
        const ordPath = '/Volumes/D1/Ord/ord';
        
        // Command: ord wallet send --fee-rate 1 <hex>
        // Using stdin to pass hex
        const command = `echo "${txHex}" | ${ordPath} --data-dir /Volumes/D1/Ord/data --bitcoin-rpc-username Tomkray7 --bitcoin-rpc-password bobeternallove77$ wallet broadcast`;
        
        const { stdout, stderr } = await execAsync(command, {
            timeout: 30000,
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        
        if (stderr && !stderr.includes('warning')) {
            console.error('   ord stderr:', stderr);
        }
        
        console.log('   ord stdout:', stdout);
        
        // Extract TXID from output (ord usually prints the TXID)
        const txidMatch = stdout.match(/[a-f0-9]{64}/i);
        if (txidMatch) {
            const txid = txidMatch[0];
            console.log('✅ Transaction broadcast successfully via ord CLI!');
            console.log('   TXID:', txid);
            return txid;
        }
        
        throw new Error(`Ord broadcast succeeded but couldn't extract TXID: ${stdout}`);
        
    } catch (error) {
        console.error('❌ Ord CLI broadcast failed:', error.message);
        if (error.stdout) console.error('   stdout:', error.stdout);
        if (error.stderr) console.error('   stderr:', error.stderr);
        throw error;
    }
}

export default { broadcastViaOrd };

