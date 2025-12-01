# 🖥️ MIGRAÇÃO PARA SERVIDOR PRÓPRIO - GUIA COMPLETO

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Hardware Recomendado](#hardware-recomendado)
3. [Instalação do Bitcoin Core](#instalação-do-bitcoin-core)
4. [Instalação do Ord Server](#instalação-do-ord-server)
5. [Configuração de Rede](#configuração-de-rede)
6. [Migração do Backend](#migração-do-backend)
7. [Migração da Extension](#migração-da-extension)
8. [Mapeamento de Endpoints](#mapeamento-de-endpoints)
9. [Checklist Final](#checklist-final)

---

## 🎯 Visão Geral

### O que você está pagando hoje (QuickNode):
| Serviço | Custo/mês | O que faz |
|---------|-----------|-----------|
| QuickNode Base | ~$50-100 | Bitcoin RPC básico |
| Ordinals & Runes API | $100 | Inscriptions, Runes, ord_* methods |
| Blockbook RPC | ~$50-75 | UTXOs, Address info, bb_* methods |
| **TOTAL** | **~$200-275/mês** | |

### O que você terá com servidor próprio:
| Serviço | Custo | O que faz |
|---------|-------|-----------|
| Bitcoin Core | GRÁTIS | Bitcoin RPC completo |
| Ord Server | GRÁTIS | Ordinals + Runes API |
| Electrs (opcional) | GRÁTIS | Substitui Blockbook |
| **TOTAL** | **~$30/mês eletricidade** | |

### Economia anual: **~$2,400 - $3,000** 💰

---

## 🖥️ Hardware Recomendado

### Mínimo (funciona, mas lento):
```
CPU: Intel i5 ou AMD Ryzen 5 (4+ cores)
RAM: 16GB
SSD: 1TB NVMe (Bitcoin) + 500GB (Ord index)
Internet: 50 Mbps upload
```

### Recomendado (performance boa):
```
CPU: Intel i7/i9 ou AMD Ryzen 7/9 (8+ cores)
RAM: 32GB
SSD: 2TB NVMe (tudo junto)
Internet: 100+ Mbps upload
```

### Ideal (máxima performance):
```
CPU: Intel i9 ou AMD Ryzen 9 (12+ cores)
RAM: 64GB
SSD: 4TB NVMe
Internet: 500+ Mbps simétrico
```

### Opções de Hardware:

#### Opção 1: Mini PC (~$500-800)
- Intel NUC 12/13 Pro
- Beelink SER7
- Minisforum UM790 Pro

#### Opção 2: PC Desktop usado (~$300-500)
- Dell OptiPlex 7080
- HP EliteDesk 800 G6
- Lenovo ThinkCentre M920

#### Opção 3: Servidor dedicado (~$800-1500)
- Dell PowerEdge T340
- HP ProLiant ML350

---

## ₿ Instalação do Bitcoin Core

### 1. Download e Instalação

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential libtool autotools-dev automake pkg-config \
  bsdmainutils python3 libssl-dev libevent-dev libboost-system-dev \
  libboost-filesystem-dev libboost-chrono-dev libboost-test-dev \
  libboost-thread-dev libminiupnpc-dev libzmq3-dev libsqlite3-dev

# Download Bitcoin Core (versão 27.0 ou mais recente)
cd ~
wget https://bitcoincore.org/bin/bitcoin-core-27.0/bitcoin-27.0-x86_64-linux-gnu.tar.gz
tar -xzf bitcoin-27.0-x86_64-linux-gnu.tar.gz
sudo install -m 0755 -o root -g root -t /usr/local/bin bitcoin-27.0/bin/*
```

### 2. Configuração do bitcoin.conf

```bash
mkdir -p ~/.bitcoin
nano ~/.bitcoin/bitcoin.conf
```

Conteúdo do `bitcoin.conf`:
```ini
# ═══════════════════════════════════════════════════════════════
# BITCOIN CORE - Configuração para KrayWallet
# ═══════════════════════════════════════════════════════════════

# Network
server=1
daemon=1
txindex=1

# RPC Settings
rpcuser=kraywallet
rpcpassword=SUA_SENHA_SEGURA_AQUI
rpcallowip=127.0.0.1
rpcallowip=192.168.0.0/16
rpcbind=0.0.0.0
rpcport=8332

# Performance
dbcache=4096
maxmempool=300
maxconnections=125

# ZMQ (para Ord Server)
zmqpubrawblock=tcp://127.0.0.1:28332
zmqpubrawtx=tcp://127.0.0.1:28333

# Pruning (NÃO usar se quiser Ord Server!)
# prune=0  # Desabilitado - precisamos do blockchain completo

# Logging
debug=rpc
printtoconsole=0
```

### 3. Iniciar Bitcoin Core

```bash
# Iniciar
bitcoind

# Verificar status
bitcoin-cli getblockchaininfo

# Acompanhar sincronização (pode levar 1-3 dias)
watch -n 10 'bitcoin-cli getblockchaininfo | grep -E "(blocks|headers|verificationprogress)"'
```

### 4. Criar serviço systemd

```bash
sudo nano /etc/systemd/system/bitcoind.service
```

```ini
[Unit]
Description=Bitcoin Core
After=network.target

[Service]
Type=forking
User=SEU_USUARIO
ExecStart=/usr/local/bin/bitcoind -daemon
ExecStop=/usr/local/bin/bitcoin-cli stop
Restart=on-failure
RestartSec=30
TimeoutStartSec=infinity

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable bitcoind
sudo systemctl start bitcoind
```

---

## 🔮 Instalação do Ord Server

### 1. Instalar Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### 2. Instalar Ord

```bash
# Instalar dependências
sudo apt install -y build-essential pkg-config libssl-dev

# Instalar ord via cargo
cargo install ord

# Ou baixar binário pré-compilado
wget https://github.com/ordinals/ord/releases/download/0.23.3/ord-0.23.3-x86_64-unknown-linux-gnu.tar.gz
tar -xzf ord-0.23.3-x86_64-unknown-linux-gnu.tar.gz
sudo mv ord /usr/local/bin/
```

### 3. Configurar Ord

```bash
mkdir -p ~/.ord
nano ~/.ord/ord.yaml
```

```yaml
# ═══════════════════════════════════════════════════════════════
# ORD SERVER - Configuração para KrayWallet
# ═══════════════════════════════════════════════════════════════

bitcoin_rpc_url: http://127.0.0.1:8332
bitcoin_rpc_username: kraywallet
bitcoin_rpc_password: SUA_SENHA_SEGURA_AQUI

# Index settings
index_runes: true
index_sats: true
index_transactions: true

# Data directory
data_dir: /home/SEU_USUARIO/.ord

# Server settings
http_port: 80
```

### 4. Criar índice (DEMORA! 12-48 horas)

```bash
# Indexar blockchain (pode levar 12-48 horas)
ord --bitcoin-rpc-url http://127.0.0.1:8332 \
    --bitcoin-rpc-username kraywallet \
    --bitcoin-rpc-password SUA_SENHA_AQUI \
    index update

# Acompanhar progresso
watch -n 30 'ord --bitcoin-rpc-url http://127.0.0.1:8332 index info'
```

### 5. Iniciar servidor Ord

```bash
ord --bitcoin-rpc-url http://127.0.0.1:8332 \
    --bitcoin-rpc-username kraywallet \
    --bitcoin-rpc-password SUA_SENHA_AQUI \
    server --http-port 3000
```

### 6. Criar serviço systemd para Ord

```bash
sudo nano /etc/systemd/system/ord.service
```

```ini
[Unit]
Description=Ord Server
After=bitcoind.service
Requires=bitcoind.service

[Service]
Type=simple
User=SEU_USUARIO
Environment="RUST_LOG=info"
ExecStart=/usr/local/bin/ord --bitcoin-rpc-url http://127.0.0.1:8332 --bitcoin-rpc-username kraywallet --bitcoin-rpc-password SUA_SENHA_AQUI server --http-port 3000
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ord
sudo systemctl start ord
```

---

## 🌐 Configuração de Rede

### 1. IP Fixo Local

```bash
# Descobrir interface de rede
ip addr

# Configurar IP fixo (Ubuntu 22.04+)
sudo nano /etc/netplan/01-netcfg.yaml
```

```yaml
network:
  version: 2
  ethernets:
    eth0:  # ou eno1, enp0s3, etc
      dhcp4: no
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
```

```bash
sudo netplan apply
```

### 2. Abrir portas no Firewall

```bash
sudo ufw allow 8332/tcp  # Bitcoin RPC
sudo ufw allow 3000/tcp  # Ord Server
sudo ufw allow 8333/tcp  # Bitcoin P2P
sudo ufw enable
```

### 3. Port Forwarding no Roteador

Acesse seu roteador (geralmente 192.168.1.1) e configure:

| Serviço | Porta Externa | Porta Interna | IP Interno |
|---------|---------------|---------------|------------|
| Bitcoin RPC | 8332 | 8332 | 192.168.1.100 |
| Ord Server | 3000 | 3000 | 192.168.1.100 |

### 4. DNS Dinâmico (se não tiver IP fixo)

Use serviços como:
- **No-IP**: https://www.noip.com (grátis)
- **DuckDNS**: https://www.duckdns.org (grátis)
- **Cloudflare**: https://cloudflare.com (grátis com domínio)

Exemplo com DuckDNS:
```bash
# Instalar cliente
echo url="https://www.duckdns.org/update?domains=SEU_DOMINIO&token=SEU_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -

# Adicionar ao crontab
crontab -e
# Adicionar linha:
*/5 * * * * echo url="https://www.duckdns.org/update?domains=SEU_DOMINIO&token=SEU_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -
```

### 5. HTTPS com Let's Encrypt (recomendado)

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d seu-dominio.duckdns.org

# Renovar automaticamente
sudo certbot renew --dry-run
```

---

## 🔄 Migração do Backend

### Arquivos que precisam ser alterados:

```
backend-render/
├── utils/
│   └── quicknode.js          ← PRINCIPAL: Substituir por localNode.js
├── routes/
│   ├── explorer.js           ← Usar novo cliente
│   ├── balance.js            ← Usar novo cliente
│   ├── wallet.js             ← Usar novo cliente
│   └── psbt.js               ← Usar novo cliente
├── l2/
│   ├── core/
│   │   └── solvencyGuard.js  ← Usar novo cliente
│   └── bridge/
│       └── bitcoinRpc.js     ← Usar novo cliente
└── .env                       ← Novas variáveis
```

### 1. Criar novo cliente: `utils/localNode.js`

```javascript
/**
 * 🖥️ LOCAL NODE API Client
 * Substitui QuickNode - Conecta ao seu próprio Bitcoin Core + Ord Server
 * 
 * SEM RATE LIMITS! SEM CUSTOS MENSAIS! 🚀
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// ═══════════════════════════════════════════════════════════════
// CONFIGURAÇÃO - Editar no .env
// ═══════════════════════════════════════════════════════════════

const BITCOIN_RPC_URL = process.env.BITCOIN_RPC_URL || 'http://127.0.0.1:8332';
const BITCOIN_RPC_USER = process.env.BITCOIN_RPC_USER || 'kraywallet';
const BITCOIN_RPC_PASS = process.env.BITCOIN_RPC_PASS || '';
const ORD_SERVER_URL = process.env.ORD_SERVER_URL || 'http://127.0.0.1:3000';

class LocalNodeClient {
    constructor() {
        this.bitcoinRpcUrl = BITCOIN_RPC_URL;
        this.bitcoinAuth = {
            username: BITCOIN_RPC_USER,
            password: BITCOIN_RPC_PASS
        };
        this.ordServerUrl = ORD_SERVER_URL;
        this.enabled = true; // Sempre habilitado quando configurado
        
        console.log('✅ Local Node client initialized');
        console.log(`📍 Bitcoin RPC: ${this.bitcoinRpcUrl}`);
        console.log(`📍 Ord Server: ${this.ordServerUrl}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // BITCOIN RPC (substitui QuickNode Bitcoin RPC)
    // ═══════════════════════════════════════════════════════════════

    async bitcoinRpc(method, params = []) {
        try {
            const response = await axios.post(this.bitcoinRpcUrl, {
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params
            }, {
                auth: this.bitcoinAuth,
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });

            if (response.data.error) {
                throw new Error(`Bitcoin RPC Error: ${response.data.error.message}`);
            }

            return response.data.result;
        } catch (error) {
            if (error.response) {
                throw new Error(`Bitcoin RPC Error: ${error.response.status}`);
            }
            throw error;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ORD SERVER API (substitui QuickNode Ordinals & Runes API)
    // ═══════════════════════════════════════════════════════════════

    async ordApi(endpoint) {
        try {
            const response = await axios.get(`${this.ordServerUrl}${endpoint}`, {
                headers: { 'Accept': 'application/json' },
                timeout: 30000
            });
            return response.data;
        } catch (error) {
            throw new Error(`Ord API Error: ${error.message}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // MÉTODOS EQUIVALENTES AO QUICKNODE
    // ═══════════════════════════════════════════════════════════════

    // --- ORDINALS API ---

    async getInscription(inscriptionId) {
        return await this.ordApi(`/inscription/${inscriptionId}`);
    }

    async getInscriptions(offset = 0, limit = 100) {
        return await this.ordApi(`/inscriptions?offset=${offset}&limit=${limit}`);
    }

    async getInscriptionContent(inscriptionId) {
        const response = await axios.get(
            `${this.ordServerUrl}/content/${inscriptionId}`,
            { responseType: 'arraybuffer', timeout: 30000 }
        );
        return Buffer.from(response.data);
    }

    async getTx(txid) {
        return await this.ordApi(`/tx/${txid}`);
    }

    async getOutput(outpoint) {
        // outpoint format: "txid:vout"
        return await this.ordApi(`/output/${outpoint}`);
    }

    async getSat(satNumber) {
        return await this.ordApi(`/sat/${satNumber}`);
    }

    async getChildren(inscriptionId) {
        return await this.ordApi(`/inscription/${inscriptionId}/children`);
    }

    // --- RUNES API ---

    async getRune(runeId) {
        return await this.ordApi(`/rune/${runeId}`);
    }

    async getRunes() {
        return await this.ordApi(`/runes`);
    }

    async getOutputWithRunes(outpoint) {
        return await this.ordApi(`/output/${outpoint}`);
    }

    // --- BLOCKCHAIN INFO ---

    async getCurrentBlockHeight() {
        return await this.bitcoinRpc('getblockcount');
    }

    async getCurrentBlockHash() {
        const height = await this.getCurrentBlockHeight();
        return await this.bitcoinRpc('getblockhash', [height]);
    }

    async getBlockInfo(hashOrHeight) {
        let hash = hashOrHeight;
        if (typeof hashOrHeight === 'number') {
            hash = await this.bitcoinRpc('getblockhash', [hashOrHeight]);
        }
        return await this.bitcoinRpc('getblock', [hash, 2]);
    }

    async getStatus() {
        const info = await this.bitcoinRpc('getblockchaininfo');
        return {
            chain: info.chain,
            blocks: info.blocks,
            headers: info.headers,
            synced: info.verificationprogress > 0.9999
        };
    }

    // --- UTXO / ADDRESS (substitui Blockbook) ---

    async getUtxos(address) {
        // Usar scantxoutset do Bitcoin Core
        const result = await this.bitcoinRpc('scantxoutset', [
            'start',
            [`addr(${address})`]
        ]);
        
        if (!result || !result.unspents) return [];
        
        return result.unspents.map(u => ({
            txid: u.txid,
            vout: u.vout,
            value: Math.round(u.amount * 100000000), // BTC to sats
            height: u.height,
            confirmations: result.height - u.height + 1
        }));
    }

    async getAddress(address) {
        const utxos = await this.getUtxos(address);
        const balance = utxos.reduce((sum, u) => sum + u.value, 0);
        
        return {
            address,
            balance: balance.toString(),
            totalReceived: balance.toString(), // Aproximação
            totalSent: '0',
            unconfirmedBalance: '0',
            txs: utxos.length
        };
    }

    async getTransaction(txid) {
        return await this.bitcoinRpc('getrawtransaction', [txid, true]);
    }

    // --- BITCOIN RPC METHODS ---

    async sendRawTransaction(hex) {
        return await this.bitcoinRpc('sendrawtransaction', [hex]);
    }

    async getRawTransaction(txid, verbose = true) {
        return await this.bitcoinRpc('getrawtransaction', [txid, verbose]);
    }

    async getBlockchainInfo() {
        return await this.bitcoinRpc('getblockchaininfo');
    }

    async estimateSmartFee(blocks = 6) {
        return await this.bitcoinRpc('estimatesmartfee', [blocks]);
    }

    async getTxOut(txid, vout, includeMempool = true) {
        return await this.bitcoinRpc('gettxout', [txid, vout, includeMempool]);
    }

    async getBlock(blockHash, verbosity = 1) {
        return await this.bitcoinRpc('getblock', [blockHash, verbosity]);
    }

    async getBlockHeader(blockHash, verbose = true) {
        return await this.bitcoinRpc('getblockheader', [blockHash, verbose]);
    }

    async getMempoolInfo() {
        return await this.bitcoinRpc('getmempoolinfo');
    }

    async getRawMempool(verbose = false) {
        return await this.bitcoinRpc('getrawmempool', [verbose]);
    }

    async testConnection() {
        try {
            const btcInfo = await this.getBlockchainInfo();
            const ordStatus = await this.ordApi('/status');
            
            return {
                connected: true,
                bitcoin: {
                    chain: btcInfo.chain,
                    blocks: btcInfo.blocks,
                    synced: btcInfo.verificationprogress > 0.9999
                },
                ord: ordStatus
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // MÉTODO CALL - Compatibilidade com QuickNode
    // ═══════════════════════════════════════════════════════════════

    async call(method, params = []) {
        // Mapear métodos QuickNode para métodos locais
        const methodMap = {
            // Ordinals
            'ord_getInscription': () => this.getInscription(params[0]),
            'ord_getInscriptions': () => this.getInscriptions(params[0], params[1]),
            'ord_getContent': () => this.getInscriptionContent(params[0]),
            'ord_getTx': () => this.getTx(params[0]),
            'ord_getOutput': () => this.getOutput(params[0]),
            'ord_getSat': () => this.getSat(params[0]),
            'ord_getChildren': () => this.getChildren(params[0]),
            'ord_getRune': () => this.getRune(params[0]),
            'ord_getRunes': () => this.getRunes(),
            'ord_getCurrentBlockHeight': () => this.getCurrentBlockHeight(),
            'ord_getCurrentBlockHash': () => this.getCurrentBlockHash(),
            'ord_getBlockInfo': () => this.getBlockInfo(params[0]),
            'ord_getStatus': () => this.getStatus(),
            
            // Blockbook
            'bb_getUTXOs': () => this.getUtxos(params[0]),
            'bb_getAddress': () => this.getAddress(params[0]),
            'bb_getTx': () => this.getTransaction(params[0]),
            
            // Bitcoin RPC
            'sendrawtransaction': () => this.sendRawTransaction(params[0]),
            'getrawtransaction': () => this.getRawTransaction(params[0], params[1]),
            'getblockchaininfo': () => this.getBlockchainInfo(),
            'estimatesmartfee': () => this.estimateSmartFee(params[0]),
            'gettxout': () => this.getTxOut(params[0], params[1], params[2]),
            'getblock': () => this.getBlock(params[0], params[1]),
            'getblockheader': () => this.getBlockHeader(params[0], params[1]),
            'getmempoolinfo': () => this.getMempoolInfo(),
            'getrawmempool': () => this.getRawMempool(params[0])
        };

        const handler = methodMap[method];
        if (handler) {
            return await handler();
        }

        // Fallback: tentar como Bitcoin RPC direto
        return await this.bitcoinRpc(method, params);
    }
}

// Export singleton instance
export default new LocalNodeClient();
```

### 2. Atualizar `.env`

```bash
# ═══════════════════════════════════════════════════════════════
# LOCAL NODE CONFIGURATION (substitui QuickNode)
# ═══════════════════════════════════════════════════════════════

# Escolher modo: 'quicknode' ou 'local'
NODE_MODE=local

# Bitcoin Core RPC
BITCOIN_RPC_URL=http://SEU_IP_OU_DOMINIO:8332
BITCOIN_RPC_USER=kraywallet
BITCOIN_RPC_PASS=SUA_SENHA_SEGURA

# Ord Server
ORD_SERVER_URL=http://SEU_IP_OU_DOMINIO:3000

# ═══════════════════════════════════════════════════════════════
# QUICKNODE (manter como backup/fallback)
# ═══════════════════════════════════════════════════════════════
QUICKNODE_ENABLED=false
QUICKNODE_ENDPOINT=https://seu-endpoint.btc.quiknode.pro/sua-chave/
```

### 3. Criar switcher: `utils/nodeClient.js`

```javascript
/**
 * 🔄 NODE CLIENT SWITCHER
 * Escolhe entre QuickNode ou Local Node baseado em configuração
 */

import dotenv from 'dotenv';
dotenv.config();

const NODE_MODE = process.env.NODE_MODE || 'quicknode';

let nodeClient;

if (NODE_MODE === 'local') {
    console.log('🖥️  Using LOCAL NODE (Bitcoin Core + Ord Server)');
    nodeClient = (await import('./localNode.js')).default;
} else {
    console.log('☁️  Using QUICKNODE (Cloud API)');
    nodeClient = (await import('./quicknode.js')).default;
}

export default nodeClient;
```

### 4. Atualizar imports em todos os arquivos

Substituir em todos os arquivos:
```javascript
// ANTES
import quicknode from '../utils/quicknode.js';

// DEPOIS
import nodeClient from '../utils/nodeClient.js';
```

Arquivos para atualizar:
- `routes/explorer.js`
- `routes/balance.js`
- `routes/wallet.js`
- `routes/psbt.js`
- `l2/core/solvencyGuard.js`
- `l2/bridge/bitcoinRpc.js`
- `l2/api/routes/bridge.js`

---

## 📱 Migração da Extension

### Arquivos que precisam ser alterados:

```
extension-prod/
├── popup/
│   ├── popup.js              ← Já usa backend API ✅
│   └── krayL2.js             ← Já usa backend API ✅
└── background/
    └── background.js         ← Verificar se chama APIs direto
```

A extension já usa o backend como intermediário, então **não precisa de mudanças**!

O backend é que faz as chamadas para QuickNode/Local Node.

---

## 🗺️ Mapeamento de Endpoints

### QuickNode → Local Node

| QuickNode Method | Local Node Equivalent | Endpoint |
|------------------|----------------------|----------|
| **Ordinals & Runes API** | | |
| `ord_getInscription` | GET `/inscription/{id}` | Ord Server |
| `ord_getInscriptions` | GET `/inscriptions` | Ord Server |
| `ord_getContent` | GET `/content/{id}` | Ord Server |
| `ord_getTx` | GET `/tx/{txid}` | Ord Server |
| `ord_getOutput` | GET `/output/{txid:vout}` | Ord Server |
| `ord_getSat` | GET `/sat/{number}` | Ord Server |
| `ord_getRune` | GET `/rune/{id}` | Ord Server |
| `ord_getRunes` | GET `/runes` | Ord Server |
| `ord_getChildren` | GET `/inscription/{id}/children` | Ord Server |
| `ord_getCurrentBlockHeight` | `getblockcount` | Bitcoin RPC |
| `ord_getCurrentBlockHash` | `getbestblockhash` | Bitcoin RPC |
| `ord_getBlockInfo` | `getblock` | Bitcoin RPC |
| `ord_getStatus` | GET `/status` | Ord Server |
| **Blockbook RPC** | | |
| `bb_getUTXOs` | `scantxoutset` | Bitcoin RPC |
| `bb_getAddress` | `scantxoutset` + calc | Bitcoin RPC |
| `bb_getTx` | `getrawtransaction` | Bitcoin RPC |
| `bb_getBalanceHistory` | Custom query | Bitcoin RPC |
| **Bitcoin RPC** | | |
| `sendrawtransaction` | `sendrawtransaction` | Bitcoin RPC |
| `getrawtransaction` | `getrawtransaction` | Bitcoin RPC |
| `getblockchaininfo` | `getblockchaininfo` | Bitcoin RPC |
| `estimatesmartfee` | `estimatesmartfee` | Bitcoin RPC |
| `gettxout` | `gettxout` | Bitcoin RPC |
| `getblock` | `getblock` | Bitcoin RPC |
| `getblockheader` | `getblockheader` | Bitcoin RPC |
| `getmempoolinfo` | `getmempoolinfo` | Bitcoin RPC |
| `getrawmempool` | `getrawmempool` | Bitcoin RPC |

---

## ✅ Checklist Final

### Antes de Migrar:

- [ ] Hardware comprado e configurado
- [ ] Ubuntu/Debian instalado
- [ ] IP fixo configurado
- [ ] Portas abertas no firewall
- [ ] Port forwarding no roteador
- [ ] DNS dinâmico configurado (se necessário)

### Bitcoin Core:

- [ ] Bitcoin Core instalado
- [ ] `bitcoin.conf` configurado
- [ ] Blockchain sincronizado (100%)
- [ ] Serviço systemd funcionando
- [ ] RPC respondendo: `bitcoin-cli getblockchaininfo`

### Ord Server:

- [ ] Ord instalado
- [ ] Índice criado (pode levar 12-48h)
- [ ] Serviço systemd funcionando
- [ ] API respondendo: `curl http://localhost:3000/status`

### Backend:

- [ ] `localNode.js` criado
- [ ] `nodeClient.js` criado
- [ ] `.env` atualizado com `NODE_MODE=local`
- [ ] Todos os imports atualizados
- [ ] Testado localmente
- [ ] Deploy no Render

### Testes:

- [ ] `/api/explorer/address/:address` funcionando
- [ ] `/api/balance/:address/balance` funcionando
- [ ] `/l2/bridge/balance` funcionando
- [ ] Solvency Guard funcionando
- [ ] Deposits detectados
- [ ] Withdrawals funcionando

---

## 🆘 Troubleshooting

### Bitcoin Core não sincroniza
```bash
# Verificar logs
tail -f ~/.bitcoin/debug.log

# Verificar conexões
bitcoin-cli getconnectioncount
```

### Ord Server não indexa
```bash
# Verificar se Bitcoin está sincronizado
bitcoin-cli getblockchaininfo | grep verificationprogress

# Reiniciar indexação
ord index update --index-runes
```

### Conexão recusada
```bash
# Verificar se serviços estão rodando
systemctl status bitcoind
systemctl status ord

# Verificar portas
netstat -tlnp | grep -E '(8332|3000)'
```

### Timeout nas requisições
```bash
# Aumentar timeout no bitcoin.conf
rpcservertimeout=300
```

---

## 📞 Suporte

Quando seu servidor estiver pronto, me envie:

1. **IP ou domínio** do seu servidor
2. **Porta** do Bitcoin RPC (default: 8332)
3. **Porta** do Ord Server (default: 3000)
4. **Usuário e senha** do RPC

E eu faço toda a configuração no código! 🚀

---

## 💰 Economia Total

| Item | QuickNode | Servidor Próprio |
|------|-----------|------------------|
| Custo Mensal | ~$250 | ~$30 (eletricidade) |
| Custo Anual | ~$3,000 | ~$360 |
| **Economia Anual** | - | **$2,640** |
| Rate Limits | 10 req/seg | **ILIMITADO** |
| Controle | Nenhum | **TOTAL** |

---

*Documento criado em: Dezembro 2024*
*Versão: 1.0*
*Autor: KrayWallet Team*



