# 📦 ARQUIVOS NECESSÁRIOS PARA PRODUÇÃO

## ✅ BACKEND (Kray Station)

### Essenciais:
```
server/
├── package.json          ✅ Dependências
├── index.js              ✅ Entry point
├── .gitignore            ✅ Proteção
├── .env.example          ✅ Template
├── README.md             ✅ Documentação
├── routes/               ✅ Endpoints da API
│   ├── explorer.js       (TX, address, block)
│   ├── wallet-inscriptions.js  (Inscriptions + Runes)
│   ├── runes.js          (Send runes)
│   ├── kraywallet.js     (Send inscription)
│   ├── rune-thumbnail.js (Proxy de imagens)
│   ├── balance.js        (Balance)
│   ├── output.js         (UTXO check)
│   ├── ord-cli.js        (Ord utilities)
│   └── ...outros endpoints
├── utils/                ✅ Utilitários
│   ├── quicknode.js      (QuickNode client)
│   ├── bitcoinRpc.js     (Bitcoin RPC)
│   ├── runesDecoder.js   (Runes decoder)
│   ├── runeIdCache.js    (Rune ID cache)
│   ├── utxoFilter.js     (UTXO filtering)
│   ├── psbtBuilderRunes.js (PSBT builder)
│   └── ...outros utils
├── db/                   ✅ Database
│   ├── init.js           (DB initialization)
│   └── migrations/       (Schema)
└── services/             ✅ Serviços (Lightning, etc)
```

### ❌ NÃO Necessários (desenvolvimento):
```
❌ test-*.js              (Scripts de teste)
❌ check-*.js             (Verificações)
❌ scan-*.js              (Scanners)
❌ find-*.js              (Buscas)
❌ *.backup               (Backups)
❌ *.bak                  (Backups)
❌ *.old                  (Versões antigas)
❌ *.quicknode            (Versões antigas)
❌ *.broken               (Código quebrado)
❌ index.js.bkp           (Backup)
❌ *.log                  (Logs)
❌ *.db                   (Database local)
```

---

## ✅ EXTENSÃO (KrayWallet)

### Essenciais:
```
kraywallet-extension/
├── manifest.json         ✅ Chrome extension config
├── README.md             ✅ Docs
├── popup/                ✅ UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── background/           ✅ Background script
│   └── background-real.js
├── content/              ✅ Content scripts
│   └── injected.js
├── assets/               ✅ Icons
│   └── icon-*.png
├── config/               ✅ Configuração
│   └── verified-runes.json
└── wallet-lib/           ✅ Bitcoin libs
    ├── package.json
    └── (node_modules via npm install)
```

### ❌ NÃO Necessários:
```
❌ node_modules/          (Instalar com npm install)
❌ *.backup               (Backups)
❌ test files             (Testes)
```

---

## 🎯 ARQUIVOS FINAIS (Produção):

### Backend: ~50-60 arquivos
### Extensão: ~30-40 arquivos

**Total**: ~100 arquivos (vs 390+ atuais)

---

## ✅ PRÓXIMA AÇÃO:

1. Limpar repositório local
2. Deletar repo GitHub
3. Criar repo novo
4. Push apenas arquivos necessários
5. Deploy no Vercel

**Confirma que posso limpar?** 🧹

