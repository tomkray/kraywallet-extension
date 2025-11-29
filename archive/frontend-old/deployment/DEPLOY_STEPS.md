# 🚀 KRAY WALLET - PASSO A PASSO DO DEPLOY

## ⏱️ TEMPO ESTIMADO: 3-4 HORAS

---

## 📋 PRÉ-REQUISITOS

### Contas Necessárias:
- [x] GitHub account
- [ ] Vercel account (gratuito ou Pro)
- [ ] Supabase account (gratuito)
- [ ] QuickNode account (já tem - $146/mês)
- [ ] Google Developer account ($5 taxa única)

### Ferramentas:
```bash
# Instalar Vercel CLI
npm i -g vercel

# Instalar Supabase CLI (opcional)
npm i -g supabase
```

---

## 🗄️ PASSO 1: SETUP SUPABASE (30 minutos)

### 1.1 Criar Projeto

1. Acesse: https://supabase.com/dashboard
2. Click "New Project"
3. Preencha:
   - **Name**: `kraywallet-production`
   - **Database Password**: (gere um seguro)
   - **Region**: `East US (North Virginia)`
   - **Plan**: Free (ou Pro se preferir)
4. Aguardar ~2 minutos (criação do banco)

### 1.2 Executar Schema

1. No dashboard, vá para **SQL Editor**
2. Click "New Query"
3. Cole o conteúdo de `deployment/database/schema.sql`
4. Click "Run" (▶️)
5. Verificar: "Success. No rows returned"

### 1.3 Copiar Credenciais

1. Vá para **Settings** > **API**
2. Copiar:
   - **URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGc...` (token público)
   - **service_role**: `eyJhbGc...` (token privado - NUNCA expor)

3. Salvar em local seguro (vamos usar depois)

✅ **Supabase pronto!**

---

## 🌐 PASSO 2: DEPLOY BACKEND NA VERCEL (45 minutos)

### 2.1 Preparar Código

```bash
cd "/Volumes/D2/KRAY WALLET- V1"

# Criar estrutura serverless
mkdir -p api/wallet api/runes api/explorer

# Copiar arquivos necessários
# (vou criar os arquivos de migração)
```

### 2.2 Criar Repositório GitHub

```bash
# Criar repo no GitHub: kraywallet-backend (PRIVADO)
# https://github.com/new

# Inicializar git
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU-USER/kraywallet-backend.git
git push -u origin main
```

### 2.3 Conectar Vercel

1. Acesse: https://vercel.com/new
2. Click "Import Project"
3. Selecione: `kraywallet-backend`
4. Framework Preset: **Other**
5. Build Command: (deixar vazio)
6. Output Directory: (deixar vazio)
7. Click "Deploy"

### 2.4 Configurar Variáveis

1. No dashboard Vercel, vá para **Settings** > **Environment Variables**
2. Adicionar (uma por uma):

```bash
# QuickNode
QUICKNODE_ENDPOINT=https://black-wider-sound.btc.quiknode.pro/xxxxx/
QUICKNODE_ENABLED=true

# Supabase (usar os valores copiados)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...

# Config
NODE_ENV=production
API_URL=https://api.kraywallet.com
ALLOWED_ORIGINS=https://kraywallet.com,chrome-extension://*
```

3. Click "Save" em cada uma

### 2.5 Configurar Domínio

1. Vá para **Settings** > **Domains**
2. Adicionar: `api.kraywallet.com`
3. Configurar DNS (no seu provedor):
   ```
   Type: CNAME
   Name: api
   Value: cname.vercel-dns.com
   ```
4. Aguardar propagação (5-30 minutos)

### 2.6 Testar Backend

```bash
# Health check
curl https://api.kraywallet.com/api/health

# Deve retornar:
# {"status":"ok","version":"1.0.0","timestamp":"..."}
```

✅ **Backend deployado!**

---

## 🦊 PASSO 3: BUILD DA EXTENSÃO (30 minutos)

### 3.1 Build para Produção

```bash
cd "/Volumes/D2/KRAY WALLET- V1/deployment/extension"

# Executar build
./build.sh

# Resultado: kraywallet-v1.0.0.zip
```

### 3.2 Testar Localmente

1. Chrome: `chrome://extensions/`
2. Ativar "Modo desenvolvedor"
3. Click "Carregar sem compactação"
4. Selecionar pasta `dist/`
5. Testar funcionalidades:
   - [ ] Criar wallet
   - [ ] Ver balance
   - [ ] Listar runes
   - [ ] Activity tab

### 3.3 Preparar Assets

Criar/validar arquivos para Chrome Web Store:

```
assets/
├── icon-16.png    (16x16)
├── icon-48.png    (48x48)
├── icon-128.png   (128x128)
├── screenshot-1.png  (1280x800)
├── screenshot-2.png
├── screenshot-3.png
├── screenshot-4.png
└── screenshot-5.png
```

### 3.4 Preparar Textos

#### Nome:
```
KrayWallet - Bitcoin Ordinals & Runes
```

#### Descrição Curta (132 chars):
```
Bitcoin wallet with native support for Ordinals inscriptions and Runes tokens. Self-custodial, secure, and easy to use.
```

#### Descrição Longa:
```
KrayWallet is a self-custodial Bitcoin wallet with native support for:

✨ FEATURES:
• Bitcoin Mainnet support
• Ordinals Inscriptions (view & send)
• Runes Tokens (view & send)
• Taproot addresses (P2TR)
• Transaction history with enrichment
• Secure local storage (encrypted)

🔒 SECURITY:
• Your keys, your Bitcoin
• Industry-standard encryption (AES-256)
• No data collection
• Open source

🎯 PERFECT FOR:
• Ordinals collectors
• Runes traders
• Bitcoin power users
• Web3 enthusiasts

📱 EASY TO USE:
Simple and intuitive interface for managing your Bitcoin, inscriptions, and runes in one place.

🔧 TECHNICAL:
• BIP39 mnemonic support
• BIP86 Taproot derivation
• PSBT signing
• QuickNode infrastructure

Support: https://kraywallet.com/support
Privacy: https://kraywallet.com/privacy
Terms: https://kraywallet.com/terms
```

### 3.5 Criar Documentos Legais

Criar em `kraywallet.com`:

#### Privacy Policy (`/privacy`):
```markdown
# Privacy Policy

Last updated: [DATE]

## Data Collection
KrayWallet does NOT collect, store, or transmit any personal data.

## Local Storage
- Wallet keys stored locally (encrypted)
- Transaction history cached locally
- No cloud backup

## Third-Party Services
- QuickNode: Bitcoin RPC (no PII)
- Mempool.space: Public blockchain data

## Your Rights
You own your data. Delete extension = delete all data.

Contact: privacy@kraywallet.com
```

#### Terms of Service (`/terms`):
```markdown
# Terms of Service

## Use at Your Own Risk
KrayWallet is provided "as is" without warranties.

## Self-Custody
You are responsible for securing your keys.

## No Guarantees
We don't guarantee uninterrupted service.

## Open Source
Code available at github.com/kraywallet

Contact: legal@kraywallet.com
```

✅ **Extensão pronta para submissão!**

---

## 📤 PASSO 4: SUBMETER EXTENSÃO (1 hora)

### 4.1 Criar Developer Account

1. Acesse: https://chrome.google.com/webstore/devconsole
2. Sign in com Google
3. Pagar taxa: $5 (taxa única)
4. Aguardar confirmação (~1 hora)

### 4.2 Upload da Extensão

1. Click "New Item"
2. Upload: `kraywallet-v1.0.0.zip`
3. Preencher informações:

**Store Listing:**
- Detailed description: (usar texto preparado)
- Category: `Productivity`
- Language: `English`

**Privacy:**
- Single purpose: `Bitcoin wallet with Ordinals support`
- Permission justification:
  ```
  storage: Store encrypted wallet keys locally
  activeTab: Interact with Bitcoin dApps
  ```
- Privacy Policy URL: `https://kraywallet.com/privacy`

**Screenshots:**
- Upload 5 screenshots (1280x800)
- Ordem: Home, Runes, Ordinals, Activity, Send

**Promotional Images:**
- Small tile: 440x280 (opcional)
- Marquee: 1400x560 (opcional)

**Additional Fields:**
- Website: `https://kraywallet.com`
- Support URL: `https://kraywallet.com/support`

3. Click "Submit for Review"

### 4.3 Aguardar Aprovação

- **Tempo**: 2-3 dias úteis
- **Status**: Acompanhar no dashboard
- **Possíveis issues**: 
  - Clarificar permissões
  - Adicionar mais screenshots
  - Ajustar descrição

✅ **Extensão submetida!**

---

## 🌐 PASSO 5: DEPLOY FRONTEND (30 minutos)

### 5.1 Preparar Código

```bash
cd "/Volumes/D2/KRAY WALLET- V1"

# Criar repo: kraywallet-frontend (PÚBLICO)
git init
git add index.html krayscan.html runes-swap.html js/ public/
git commit -m "Frontend v1.0.0"
git remote add origin https://github.com/SEU-USER/kraywallet-frontend.git
git push -u origin main
```

### 5.2 Deploy na Vercel

1. Vercel Dashboard > New Project
2. Import: `kraywallet-frontend`
3. Framework: **Other**
4. Build Command: (vazio)
5. Output Directory: `.`
6. Deploy

### 5.3 Configurar Domínio

1. Settings > Domains
2. Adicionar: `kraywallet.com`
3. Configurar DNS:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21
   
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

### 5.4 Testar Frontend

```bash
# Abrir no browser
https://kraywallet.com

# Verificar:
- [ ] Marketplace carrega
- [ ] KrayScan funciona
- [ ] Runes Swap funciona
```

✅ **Frontend no ar!**

---

## ✅ PASSO 6: VALIDAÇÃO FINAL (30 minutos)

### 6.1 Checklist Técnico

```bash
# Backend
curl https://api.kraywallet.com/api/health
curl https://api.kraywallet.com/api/wallet/bc1p.../balance

# Frontend
curl https://kraywallet.com
curl https://kraywallet.com/privacy

# Extensão (após aprovação)
# Testar no Chrome instalando da Web Store
```

### 6.2 Checklist Funcional

- [ ] Criar wallet na extensão
- [ ] Ver balance
- [ ] Listar inscriptions
- [ ] Listar runes
- [ ] Enviar Bitcoin
- [ ] Activity tab funciona
- [ ] KrayScan funciona no site
- [ ] Marketplace funciona

### 6.3 Checklist Segurança

- [ ] Nenhuma key hardcoded
- [ ] HTTPS em tudo
- [ ] CORS configurado
- [ ] Rate limiting ativo
- [ ] Backup database ativo
- [ ] Logs sem dados sensíveis

---

## 🎉 CONCLUSÃO

### URLs Finais:

```
Extensão:    chrome://extensions (após aprovação)
Website:     https://kraywallet.com
API:         https://api.kraywallet.com
GitHub:      https://github.com/kraywallet
Supabase:    https://supabase.com/dashboard
Vercel:      https://vercel.com/dashboard
```

### Custos Mensais:

```
QuickNode:   $146/mês
Supabase:    $0 (Free tier) ou $25 (Pro)
Vercel:      $0 (Hobby) ou $20 (Pro)
Domain:      $12/ano
───────────────────────
TOTAL:       ~$146-191/mês
```

### Monitoramento:

- Vercel Analytics (requests, errors)
- Supabase Dashboard (queries, storage)
- QuickNode Dashboard (API calls)
- Chrome Web Store (downloads, ratings)

---

## 🆘 PROBLEMAS COMUNS

### Backend não responde:
```bash
# Verificar logs
vercel logs [deployment-url]

# Verificar env vars
vercel env ls
```

### Extensão rejeitada:
- Revisar feedback do Google
- Ajustar manifest/descrição
- Re-submeter

### CORS errors:
- Verificar ALLOWED_ORIGINS
- Adicionar origin no Vercel headers

---

## 📞 SUPORTE

- **Email**: support@kraywallet.com
- **GitHub Issues**: github.com/kraywallet/extension/issues
- **Twitter**: @kraywallet

---

**BOA SORTE COM O DEPLOY! 🚀**






