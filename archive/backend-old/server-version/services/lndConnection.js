/**
 * 🔌 LND CONNECTION SERVICE
 * Conecta backend ao Lightning Network Daemon
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { execSync } from 'child_process';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LNDConnection {
    constructor() {
        this.client = null;
        this.isConnected = false;
        // LND data está no D1 com mais espaço
        this.lndDir = '/Volumes/D1/lnd-data';
        this.macaroonPath = path.join(this.lndDir, 'data/chain/bitcoin/mainnet/admin.macaroon');
        this.tlsCertPath = path.join(this.lndDir, 'tls.cert');
    }

    /**
     * Conectar ao LND
     */
    async connect() {
        try {
            console.log('⚡ ========== CONNECTING TO LND ==========');
            console.log(`📂 LND dir: ${this.lndDir}`);
            console.log(`🔑 Macaroon: ${this.macaroonPath}`);
            console.log(`🔐 TLS cert: ${this.tlsCertPath}`);

            // Verificar se LND está rodando
            if (!fs.existsSync(this.tlsCertPath)) {
                throw new Error('LND not running! Start with: ./start-lnd.sh');
            }

            // Carregar TLS cert
            const tlsCert = fs.readFileSync(this.tlsCertPath);
            const sslCreds = grpc.credentials.createSsl(tlsCert);

            // Carregar macaroon (após wallet unlock)
            let macaroonCreds = null;
            if (fs.existsSync(this.macaroonPath)) {
                const macaroon = fs.readFileSync(this.macaroonPath).toString('hex');
                const metadata = new grpc.Metadata();
                metadata.add('macaroon', macaroon);
                
                macaroonCreds = grpc.credentials.createFromMetadataGenerator((args, callback) => {
                    callback(null, metadata);
                });
            }

            // Combinar credentials
            const credentials = macaroonCreds 
                ? grpc.credentials.combineChannelCredentials(sslCreds, macaroonCreds)
                : sslCreds;

            // Carregar proto file
            const packageDefinition = protoLoader.loadSync(
                path.join(__dirname, '../../lnd/rpc.proto'),
                {
                    keepCase: true,
                    longs: String,
                    enums: String,
                    defaults: true,
                    oneofs: true
                }
            );

            const lnrpc = grpc.loadPackageDefinition(packageDefinition).lnrpc;

            // Criar client
            this.client = new lnrpc.Lightning('localhost:10009', credentials);

            // Testar conexão
            await this.getInfo();

            this.isConnected = true;
            console.log('✅ Connected to LND successfully!');

            return { success: true };

        } catch (error) {
            console.error('❌ Failed to connect to LND:', error.message);
            this.isConnected = false;
            
            return {
                success: false,
                error: error.message,
                hint: 'Make sure LND is running: ./start-lnd.sh'
            };
        }
    }

    /**
     * Verificar se está conectado
     */
    async getInfo() {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('LND not connected'));
                return;
            }

            this.client.getInfo({}, (err, response) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Obter balance da wallet Lightning
     */
    async getWalletBalance() {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('LND not connected'));
                return;
            }

            this.client.walletBalance({}, (err, response) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        total_balance: parseInt(response.total_balance),
                        confirmed_balance: parseInt(response.confirmed_balance),
                        unconfirmed_balance: parseInt(response.unconfirmed_balance)
                    });
                }
            });
        });
    }

    /**
     * Obter balance dos channels Lightning
     */
    async getChannelBalance() {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('LND not connected'));
                return;
            }

            this.client.channelBalance({}, (err, response) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        balance: parseInt(response.balance || 0),
                        pending_open_balance: parseInt(response.pending_open_balance || 0),
                        local_balance: {
                            sat: parseInt(response.local_balance?.sat || 0),
                            msat: parseInt(response.local_balance?.msat || 0)
                        },
                        remote_balance: {
                            sat: parseInt(response.remote_balance?.sat || 0),
                            msat: parseInt(response.remote_balance?.msat || 0)
                        }
                    });
                }
            });
        });
    }

    /**
     * Listar channels
     */
    async listChannels() {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('LND not connected'));
                return;
            }

            this.client.listChannels({}, (err, response) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        channels: response.channels || [],
                        total: response.channels?.length || 0
                    });
                }
            });
        });
    }

    /**
     * Gerar novo endereço
     */
    async newAddress(type = 'p2tr') {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('LND not connected'));
                return;
            }

            const addressType = type === 'p2tr' ? 4 : 0; // 4 = TAPROOT_PUBKEY

            this.client.newAddress({ type: addressType }, (err, response) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        address: response.address
                    });
                }
            });
        });
    }

    /**
     * Criar wallet LND com seed específica (12 ou 24 palavras)
     * Usado quando MyWallet cria/restaura carteira
     * 
     * DINÂMICO: Detecta automaticamente se é 12 ou 24 palavras!
     */
    async initWalletWithSeed(mnemonic, password) {
        try {
            console.log('⚡ ========== INIT LND WALLET WITH SEED ==========');
            const wordCount = mnemonic.split(' ').length;
            console.log(`🔑 Mnemonic words: ${wordCount}`);
            console.log(`🔐 Password length: ${password.length}`);

            // Verificar se LND já tem wallet
            const lndDir = this.lndDir;

            try {
                // Tentar unlock (se wallet já existe)
                console.log('🔓 Tentando unlock wallet existente...');
                
                // Criar arquivo temporário com senha
                const tempPasswordFile = `/tmp/lnd-password-${Date.now()}.txt`;
                fs.writeFileSync(tempPasswordFile, password);
                
                try {
                    const unlockCmd = `cd /Users/tomkray/Desktop/PSBT-Ordinals && cat ${tempPasswordFile} | ./lnd-darwin-arm64-v0.17.0-beta/lncli --lnddir=${lndDir} --network=mainnet unlock`;
                    execSync(unlockCmd, { stdio: 'pipe', timeout: 5000 });
                    console.log('✅ Wallet LND já existe e foi desbloqueada!');
                    
                    // Limpar arquivo temporário
                    fs.unlinkSync(tempPasswordFile);
                    
                    // Conectar ao LND
                    await this.connect();
                    
                    return {
                        success: true,
                        message: 'Wallet LND unlocked',
                        alreadyExists: true
                    };
                } catch (unlockErr) {
                    // Limpar arquivo temporário
                    if (fs.existsSync(tempPasswordFile)) {
                        fs.unlinkSync(tempPasswordFile);
                    }
                    throw unlockErr;
                }

            } catch (unlockError) {
                // Wallet não existe, vamos criar
                console.log('📝 Wallet não existe, criando nova...');
                
                // DINÂMICO: Se 12 palavras, derivar xprv. Se 24, usar direto.
                if (wordCount === 12 || wordCount === 15 || wordCount === 18 || wordCount === 21) {
                    console.log(`📊 Detectado: ${wordCount} palavras (BIP39)`);
                    console.log('🔄 Convertendo para extended key (xprv)...');
                    
                    // Derivar extended key usando os módulos já importados no topo
                    const { mnemonicToSeedSync } = await import('bip39');
                    const { BIP32Factory } = await import('bip32');
                    const ecc = await import('tiny-secp256k1');
                    const { networks } = await import('bitcoinjs-lib');
                    
                    const seed = mnemonicToSeedSync(mnemonic);
                    const root = BIP32Factory(ecc).fromSeed(seed, networks.bitcoin);
                    const xprv = root.toBase58();
                    
                    console.log('✅ Extended key derivada');
                    console.log(`🔑 xprv: ${xprv.substring(0, 20)}...`);
                    
                    // Criar wallet usando extended key
                    console.log('🔨 Criando wallet LND com extended key...');
                    
                    // Criar script expect para simular terminal interativo
                    const expectScript = `/tmp/lnd-create-${Date.now()}.exp`;
                    const expectContent = `#!/usr/bin/expect -f
set timeout 120
spawn ./lnd-darwin-arm64-v0.17.0-beta/lncli --lnddir=${lndDir} --network=mainnet create
expect "Input wallet password:"
send "${password}\\r"
expect "Confirm password:"
send "${password}\\r"
expect "Do you have an existing cipher seed mnemonic"
send "x\\r"
expect "Input your extended master root key"
send "${xprv}\\r"
expect {
    timeout { puts "\\n❌ Timeout waiting for wallet creation"; exit 1 }
    "lnd successfully initialized!" { puts "\\n✅ Wallet creation completed"; exit 0 }
    -re ".*" { exp_continue }
    eof { puts "\\n✅ Process completed"; exit 0 }
}
`;
                    fs.writeFileSync(expectScript, expectContent);
                    fs.chmodSync(expectScript, '0755');
                    
                    try {
                        console.log('🔍 Usando expect para simular terminal interativo...');
                        const output = execSync(`cd /Users/tomkray/Desktop/PSBT-Ordinals && ${expectScript}`, { 
                            encoding: 'utf-8',
                            timeout: 120000,
                            shell: '/bin/bash'
                        });
                        console.log('✅ Wallet LND criada com extended key!');
                        console.log(`📊 Output: ${output.substring(0, 300)}...`);
                        
                        // Limpar script expect
                        fs.unlinkSync(expectScript);
                        
                        // Aguardar wallet ser processada
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        // Conectar ao LND
                        await this.connect();
                        
                        return {
                            success: true,
                            message: 'Wallet LND created with extended key',
                            alreadyExists: false,
                            method: 'extended_key'
                        };
                    } catch (createErr) {
                        console.log('❌ Erro ao criar wallet LND:', createErr.message);
                        if (createErr.stdout) console.log('📊 stdout:', createErr.stdout.toString());
                        if (createErr.stderr) console.log('📊 stderr:', createErr.stderr.toString());
                        
                        // Limpar script expect
                        if (fs.existsSync(expectScript)) {
                            fs.unlinkSync(expectScript);
                        }
                        throw createErr;
                    }
                    
                } else if (wordCount === 24) {
                    console.log('📊 Detectado: 24 palavras (AEZEED ou BIP39)');
                    console.log('🔨 Criando wallet LND com 24 palavras...');
                    
                    // Criar script expect para simular terminal interativo
                    const expectScript = `/tmp/lnd-create-${Date.now()}.exp`;
                    const expectContent = `#!/usr/bin/expect -f
set timeout 120
spawn ./lnd-darwin-arm64-v0.17.0-beta/lncli --lnddir=${lndDir} --network=mainnet create
expect "Input wallet password:"
send "${password}\\r"
expect "Confirm password:"
send "${password}\\r"
expect "Do you have an existing cipher seed mnemonic or extended master root key you want to use?"
send "y\\r"
expect "Input your 24-word mnemonic separated by spaces:"
send "${mnemonic}\\r"
expect {
    timeout { puts "❌ Timeout waiting for wallet creation"; exit 1 }
    eof { puts "✅ Wallet creation completed" }
}
`;
                    fs.writeFileSync(expectScript, expectContent);
                    fs.chmodSync(expectScript, '0755');
                    
                    try {
                        console.log('🔍 Usando expect para simular terminal interativo...');
                        const output = execSync(`cd /Users/tomkray/Desktop/PSBT-Ordinals && ${expectScript}`, { 
                            encoding: 'utf-8',
                            timeout: 120000,
                            shell: '/bin/bash'
                        });
                        console.log('✅ Wallet LND criada com 24 palavras!');
                        console.log(`📊 Output: ${output.substring(0, 300)}...`);
                        
                        // Limpar script expect
                        fs.unlinkSync(expectScript);
                        
                        // Aguardar wallet ser processada
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        // Conectar ao LND
                        await this.connect();
                        
                        return {
                            success: true,
                            message: 'Wallet LND created with 24-word seed',
                            alreadyExists: false,
                            method: 'mnemonic_24'
                        };
                    } catch (createErr) {
                        console.log('❌ Erro ao criar wallet LND:', createErr.message);
                        if (createErr.stdout) console.log('📊 stdout:', createErr.stdout.toString());
                        if (createErr.stderr) console.log('📊 stderr:', createErr.stderr.toString());
                        
                        // Limpar script expect
                        if (fs.existsSync(expectScript)) {
                            fs.unlinkSync(expectScript);
                        }
                        throw createErr;
                    }
                    
                } else {
                    throw new Error(`Invalid mnemonic word count: ${wordCount}. Expected 12, 15, 18, 21, or 24.`);
                }
            }

        } catch (error) {
            console.error('❌ Failed to init LND wallet:', error.message);
            return {
                success: false,
                error: error.message,
                hint: 'Make sure LND is running'
            };
        }
    }

    /**
     * Unlock wallet existente
     */
    async unlockWallet(password) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('LND not connected'));
                return;
            }

            this.client.unlockWallet({
                wallet_password: Buffer.from(password, 'utf8')
            }, (err, response) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ success: true });
                }
            });
        });
    }
}

// Singleton instance
const lndConnection = new LNDConnection();

export default lndConnection;

