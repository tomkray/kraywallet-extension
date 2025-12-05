# 🏠 Migração para Self-Hosted (Umbrel)

> **Status**: Planejado para após conclusão do desenvolvimento
> **Prioridade**: Alta (Segurança)
> **Última atualização**: Dezembro 2024

---

## 📋 Sumário

1. [Por que Self-Hosted?](#-por-que-self-hosted)
2. [Arquitetura Atual vs Futura](#-arquitetura-atual-vs-futura)
3. [Checklist de Migração](#-checklist-de-migração)
4. [Configuração do Umbrel](#-configuração-do-umbrel)
5. [Segurança das Chaves](#-segurança-das-chaves)
6. [Bitcoin Core Direto](#-bitcoin-core-direto)
7. [Backup e Recuperação](#-backup-e-recuperação)

---

## 🎯 Por que Self-Hosted?

### Problemas com Cloud (Render/AWS/etc):

| Risco | Descrição |
|-------|-----------|
| 🔴 **Terceiros** | Render tem acesso físico aos servidores |
| 🔴 **Logs** | Variáveis de ambiente podem aparecer em logs |
| 🔴 **Compliance** | Podem ser obrigados a entregar dados |
| 🔴 **Downtime** | Dependência de infraestrutura externa |
| 🔴 **Custos** | Pagamento mensal crescente |

### Vantagens do Self-Hosted:

| Benefício | Descrição |
|-----------|-----------|
| 🟢 **Controle Total** | Você é dono do hardware |
| 🟢 **Privacidade** | Chaves nunca saem da sua rede |
| 🟢 **Sem Terceiros** | Ninguém pode acessar seus dados |
| 🟢 **Bitcoin Core** | Node próprio, sem APIs externas |
| 🟢 **Tor Integrado** | Privacidade de rede |
| 🟢 **Custo Único** | Só o hardware, sem mensalidades |

---

## 🏗️ Arquitetura Atual vs Futura

### ATUAL (Desenvolvimento) - Render Cloud

```
┌─────────────────────────────────────────────────────────────────┐
│                        ☁️  RENDER CLOUD                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   Kray      │     │   SQLite    │     │   Env Vars  │       │
│  │   Backend   │────▶│   Database  │     │   (Keys)    │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│         │                                                       │
│         │ API calls                                             │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │  QuickNode  │  ← Dependência externa!                       │
│  │  (Bitcoin)  │                                               │
│  └─────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### FUTURO (Produção) - Umbrel Self-Hosted

```
┌─────────────────────────────────────────────────────────────────┐
│                      🏠 UMBREL NODE (Local)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │  Bitcoin    │     │   Kray      │     │  PostgreSQL │       │
│  │  Core       │────▶│   Backend   │────▶│  (Local)    │       │
│  │  (Full)     │     │             │     │             │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│         │                  │                                    │
│         │                  │                                    │
│         ▼                  ▼                                    │
│  ┌─────────────┐     ┌─────────────┐                           │
│  │  Mempool    │     │   Secure    │                           │
│  │  (Direto)   │     │   Keys      │  ← Arquivo local!         │
│  └─────────────┘     │   Storage   │                           │
│                      └─────────────┘                           │
│         │                                                       │
│         │ Tor Hidden Service                                    │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │  Internet   │                                               │
│  └─────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist de Migração

### Fase 1: Preparação

- [ ] Comprar hardware para Umbrel (Raspberry Pi 4/5 ou Mini PC)
- [ ] SSD de pelo menos 1TB (para Bitcoin Core)
- [ ] Instalar Umbrel OS
- [ ] Sincronizar Bitcoin Core (pode levar dias)
- [ ] Testar conectividade Tor

### Fase 2: Configuração do Backend

- [ ] Instalar Node.js no Umbrel
- [ ] Clonar repositório do backend
- [ ] Configurar PostgreSQL local (substituir SQLite)
- [ ] Migrar dados do banco atual
- [ ] Configurar variáveis de ambiente locais

### Fase 3: Migração de Chaves

- [ ] Gerar NOVAS chaves de criptografia
- [ ] Criar arquivo de chaves seguro (fora do container)
- [ ] Migrar `SIGNATURE_ENCRYPTION_KEY`
- [ ] Migrar chaves dos Guardians
- [ ] Testar descriptografia de assinaturas antigas
- [ ] DELETAR chaves antigas do Render

### Fase 4: Bitcoin Core

- [ ] Configurar RPC do Bitcoin Core
- [ ] Atualizar backend para usar Bitcoin Core direto
- [ ] Remover dependência do QuickNode
- [ ] Testar broadcast de transações
- [ ] Testar consulta de UTXOs

### Fase 5: DNS e Exposição

- [ ] Configurar Tor Hidden Service
- [ ] OU configurar Cloudflare Tunnel
- [ ] Atualizar DNS do kray.space
- [ ] Testar conectividade externa
- [ ] Configurar SSL/TLS

### Fase 6: Finalização

- [ ] Redirecionar tráfego para novo servidor
- [ ] Monitorar por 1 semana
- [ ] Desligar serviço no Render
- [ ] Deletar dados sensíveis do Render

---

## 🖥️ Configuração do Umbrel

### Hardware Recomendado

**Opção 1: Raspberry Pi 5 (Econômico)**
```
- Raspberry Pi 5 (8GB RAM)
- SSD NVMe 2TB (via adaptador USB 3.0)
- Case com cooler
- Fonte de alimentação oficial
- Custo: ~$250-300
```

**Opção 2: Mini PC (Performance)**
```
- Intel NUC ou similar
- 16GB+ RAM
- SSD NVMe 2TB interno
- Custo: ~$400-600
```

### Instalação do Umbrel

```bash
# 1. Baixar Umbrel OS
# https://umbrel.com/

# 2. Gravar no SSD com Balena Etcher

# 3. Conectar hardware e ligar

# 4. Acessar via browser
# http://umbrel.local
```

### Apps Necessários no Umbrel

1. **Bitcoin Node** - Full node
2. **Electrs** - Servidor Electrum (opcional)
3. **Mempool** - Explorer local (opcional)

---

## 🔐 Segurança das Chaves

### Estrutura de Arquivos Segura

```
/home/umbrel/
├── kray-backend/           # Código do backend
│   ├── src/
│   ├── package.json
│   └── ...
│
└── kray-secrets/           # FORA do repositório Git!
    ├── keys.json           # Chaves criptografadas
    ├── guardians.json      # Chaves dos guardians
    └── backup.enc          # Backup criptografado
```

### Arquivo keys.json

```json
{
  "version": 1,
  "created": "2024-12-XX",
  "keys": {
    "SIGNATURE_ENCRYPTION_KEY": "nova-chave-gerada-localmente",
    "JWT_SECRET": "outro-secret-local",
    "SESSION_SECRET": "mais-um-secret"
  }
}
```

### Permissões de Arquivo

```bash
# Apenas o usuário umbrel pode ler
chmod 600 /home/umbrel/kray-secrets/keys.json
chown umbrel:umbrel /home/umbrel/kray-secrets/keys.json

# Diretório protegido
chmod 700 /home/umbrel/kray-secrets/
```

### Carregamento no Backend

```javascript
// config/secrets.js
import fs from 'fs';
import path from 'path';

const SECRETS_PATH = '/home/umbrel/kray-secrets/keys.json';

let secrets = null;

export function loadSecrets() {
    if (secrets) return secrets;
    
    try {
        const content = fs.readFileSync(SECRETS_PATH, 'utf8');
        secrets = JSON.parse(content).keys;
        console.log('✅ Secrets loaded from secure file');
        return secrets;
    } catch (error) {
        console.error('❌ Failed to load secrets:', error.message);
        throw new Error('Cannot start without secrets file');
    }
}

export function getSecret(key) {
    if (!secrets) loadSecrets();
    return secrets[key];
}
```

---

## ₿ Bitcoin Core Direto

### Configuração do bitcoin.conf

```ini
# /home/umbrel/umbrel/app-data/bitcoin/data/bitcoin/bitcoin.conf

# RPC
server=1
rpcuser=krayspace
rpcpassword=senha-super-segura-aqui
rpcallowip=127.0.0.1
rpcbind=127.0.0.1

# Performance
dbcache=1000
maxmempool=300

# Tor (opcional)
proxy=127.0.0.1:9050
listen=1
bind=127.0.0.1
```

### Cliente RPC no Backend

```javascript
// services/bitcoinCore.js
import Client from 'bitcoin-core';

const client = new Client({
    host: '127.0.0.1',
    port: 8332,
    username: 'krayspace',
    password: process.env.BITCOIN_RPC_PASSWORD
});

// Broadcast transaction
export async function broadcastTransaction(txHex) {
    return await client.sendRawTransaction(txHex);
}

// Get UTXO info
export async function getTransaction(txid) {
    return await client.getRawTransaction(txid, true);
}

// Get address UTXOs (requer index)
export async function getAddressUtxos(address) {
    // Usar scantxoutset ou electrs
}
```

### Substituir QuickNode

Atualizar todos os endpoints que usam QuickNode:

| Função | QuickNode (Atual) | Bitcoin Core (Futuro) |
|--------|-------------------|----------------------|
| Broadcast | POST /api/broadcast | sendrawtransaction |
| Get TX | GET /tx/{txid} | getrawtransaction |
| Get UTXOs | QuickNode API | scantxoutset / electrs |
| Fee estimate | QuickNode API | estimatesmartfee |

---

## 💾 Backup e Recuperação

### O que fazer backup

```
CRÍTICO (perda = perda de fundos de usuários):
├── kray-secrets/keys.json        # Chaves de criptografia
├── kray-secrets/guardians.json   # Chaves dos guardians
└── database/                     # Listings, signatures, etc

IMPORTANTE (perda = retrabalho):
├── Bitcoin blockchain            # Pode re-sincronizar
└── Código fonte                  # Está no GitHub
```

### Script de Backup

```bash
#!/bin/bash
# /home/umbrel/scripts/backup-kray.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/media/backup-drive/kray-backups"

# Backup secrets (criptografado)
gpg --symmetric --cipher-algo AES256 \
    -o "$BACKUP_DIR/secrets_$DATE.gpg" \
    /home/umbrel/kray-secrets/keys.json

# Backup database
pg_dump krayspace | gpg --symmetric --cipher-algo AES256 \
    -o "$BACKUP_DIR/database_$DATE.sql.gpg"

# Manter apenas últimos 30 backups
find $BACKUP_DIR -name "*.gpg" -mtime +30 -delete

echo "✅ Backup completed: $DATE"
```

### Cron Job

```bash
# Backup diário às 3am
0 3 * * * /home/umbrel/scripts/backup-kray.sh >> /var/log/kray-backup.log 2>&1
```

### Recuperação de Desastre

```bash
# 1. Restaurar secrets
gpg -d secrets_YYYYMMDD.gpg > /home/umbrel/kray-secrets/keys.json

# 2. Restaurar database
gpg -d database_YYYYMMDD.sql.gpg | psql krayspace

# 3. Reiniciar serviços
docker restart kray-backend
```

---

## 🚨 Procedimentos de Emergência

### Se chaves vazarem

1. **IMEDIATAMENTE**: Pausar todas as listings
2. Gerar novas chaves de criptografia
3. Re-criptografar todas assinaturas ativas
4. Investigar vazamento
5. Notificar usuários se necessário

### Se servidor for comprometido

1. Desligar servidor da internet
2. Não deletar nada (preservar evidências)
3. Restaurar backup em novo hardware
4. Gerar TODAS as chaves novas
5. Migrar dados criptografados

### Contatos de Emergência

```
- [Seu contato pessoal]
- [Contato técnico de backup]
- [Advogado/Legal se necessário]
```

---

## 📅 Timeline Estimada

| Fase | Duração | Dependências |
|------|---------|--------------|
| Comprar hardware | 1 semana | Orçamento |
| Setup Umbrel | 1 dia | Hardware |
| Sync Bitcoin | 3-7 dias | Internet |
| Migrar backend | 2-3 dias | Sync completo |
| Testes | 1 semana | Backend funcionando |
| Go-live | 1 dia | Testes OK |

**Total estimado: 2-3 semanas**

---

## 📝 Notas Finais

1. **Não tenha pressa** - migração mal feita = perda de dados
2. **Teste TUDO** antes de desligar o Render
3. **Mantenha Render como backup** por 1 mês após migração
4. **Documente tudo** que fizer diferente deste guia

---

*Documento criado em Dezembro 2024*
*Última revisão: [Atualizar quando modificar]*

