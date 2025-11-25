# 🎨 Ordinals & Runes Marketplace - PSBT Edition

Uma aplicação web moderna e completa para marketplace de Ordinals e swap de Runes, construída com as mais recentes funcionalidades do protocolo Ordinals v0.23.3.

**✨ Agora com integração completa ao Bitcoin Core e Ord Server!**

## ⚡ Novas Funcionalidades - v0.23.3

Esta aplicação implementa as seguintes features da atualização mais recente do protocolo Ordinals por Casey Rodarmor:

### 1. **PSBT Offer Submission** (PR #4408)
- Submissão de ofertas usando Partially Signed Bitcoin Transactions
- Criação e envio de ofertas de forma segura e descentralizada
- Suporte completo para exportação e importação de PSBTs

### 2. **Auto-Submit Offers** (PR #4409)
- Funcionalidade de submissão automática de ofertas criadas com `ord wallet offer create`
- Opção de criar e submeter ofertas em uma única operação
- Integração direta com o wallet

### 3. **Wallet Sweep Command** (PR #4394)
- Comando para varrer todos os UTXOs da carteira
- Útil para consolidação de fundos e migração de wallets
- Interface intuitiva com confirmações de segurança

## 🚀 Funcionalidades

### Marketplace de Ordinals
- ✅ Navegação e busca de inscriptions
- ✅ Criação de ofertas com PSBT
- ✅ Submissão automática ou manual de ofertas
- ✅ Gerenciamento de ofertas ativas
- ✅ Exportação de PSBTs para assinatura externa
- ✅ Filtros e ordenação avançada

### Runes Swap
- ✅ Troca peer-to-peer de Runes usando PSBT
- ✅ Pools de liquidez
- ✅ Cálculo automático de taxas de câmbio
- ✅ Histórico de trades em tempo real
- ✅ Múltiplos métodos de swap (direto ou exportação)
- ✅ Gestão de swaps ativos

### Wallet Management
- ✅ Conexão de carteira Bitcoin
- ✅ Visualização de saldo
- ✅ Sweep de wallet (consolidação de UTXOs)
- ✅ Configuração de fee rate personalizada

## 🛠️ Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **Bitcoin**: Bitcoin Core RPC, PSBT (BIP 174)
- **Ordinals**: Ord Server HTTP API
- **Protocolo**: Ordinals v0.23.3
- **Design**: Responsive, dark theme, modern UI/UX

## 📋 Setup Rápido

### Opção 1: Setup Automático (Recomendado)

```bash
# Clone o repositório
git clone <repo-url>
cd PSBT-Ordinals

# Execute o script de setup
npm run setup

# Siga as instruções na tela
```

### Opção 2: Setup Manual

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
nano .env  # Edite com suas credenciais

# 3. Inicializar database
npm run init-db

# 4. Testar conexões
npm test

# 5. Iniciar servidor
npm start
```

### Pré-requisitos

Antes de começar, você precisa ter:

1. **Node.js 18+** instalado
2. **Bitcoin Core** instalado e sincronizado com `txindex=1`
3. **Ord Server** instalado com índice criado

📚 **Guia Completo**: Veja [NODE_SETUP.md](./NODE_SETUP.md) para instruções detalhadas de configuração dos nodes.

## 📖 Documentação

- **[NODE_SETUP.md](./NODE_SETUP.md)** - Guia completo de configuração do Bitcoin Core e Ord Server
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Referência completa da API REST
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Arquitetura do sistema
- **[QUICKSTART.md](./QUICKSTART.md)** - Guia rápido de início

## 🚀 Como Usar

### 1. Iniciar a Aplicação

Após o setup, inicie o servidor:

```bash
# Desenvolvimento (com auto-reload)
npm run dev

# Produção
npm start
```

Acesse: `http://localhost:3000`

### 2. Verificar Status

Verifique se os nodes estão conectados:

```bash
# Via API
curl http://localhost:3000/api/status

# Via script de teste
npm test
```

### 3. Conectar Carteira

Clique no botão "Connect Wallet" no topo da página para conectar sua carteira Bitcoin.

### 4. Marketplace de Ordinals

**Navegar Ordinals:**
- Browse pela grid de inscriptions
- Use a busca para encontrar inscriptions específicas
- Ordene por preço, número ou data

**Criar Ofertas:**
1. Clique em "Make Offer" em qualquer inscription ou vá para a tab "Create Offer"
2. Insira o Inscription ID
3. Defina o valor da oferta em satoshis
4. Configure a fee rate (recomendado: 5-10 sat/vB)
5. Opcionalmente, marque "Auto-submit offer" para submissão automática
6. Clique em "Create Offer"

**Exportar PSBT:**
- Após criar uma oferta, você pode exportar o PSBT
- Use o PSBT em wallets externas como Sparrow, Electrum, etc.
- Copie o PSBT para a área de transferência

### 5. Runes Swap

**Realizar Swap:**
1. Vá para a página "Runes Swap"
2. Selecione o token que deseja enviar (You Send)
3. Selecione o token que deseja receber (You Receive)
4. Insira a quantidade
5. Revise a taxa de câmbio e impacto no preço
6. Escolha o método de swap:
   - **Direct PSBT Swap**: Cria e submete automaticamente
   - **Export PSBT**: Exporta para assinatura externa
7. Clique em "Create Swap Offer"

**Pools de Liquidez:**
- Visualize pools disponíveis
- Verifique liquidez, volume 24h e APR
- Clique em "Select" para usar um pool específico

**Histórico:**
- Veja trades recentes
- Acompanhe suas swaps ativas
- Cancele swaps pendentes se necessário

### 6. Wallet Sweep

**⚠️ ATENÇÃO: Operação irreversível!**

1. Vá para a tab "Wallet Sweep"
2. Insira o endereço Bitcoin de destino
3. Configure a fee rate
4. Leia o aviso e confirme
5. Clique em "Sweep Wallet"
6. Revise a transação gerada
7. Transmita para a rede

## 🔐 Segurança

### Melhores Práticas

- ✅ Sempre verifique endereços de destino antes de confirmar
- ✅ Use fee rates adequadas para garantir confirmação
- ✅ Faça backup da sua carteira antes de usar Wallet Sweep
- ✅ Teste com pequenas quantidades primeiro
- ✅ Nunca compartilhe suas chaves privadas
- ✅ Verifique PSBTs antes de assinar

### PSBTs (Partially Signed Bitcoin Transactions)

Os PSBTs permitem:
- Criação de transações sem expor chaves privadas
- Assinatura em múltiplas etapas
- Integração com hardware wallets
- Auditoria completa antes da transmissão

## 🎨 UI/UX Features

- **Dark Theme**: Interface escura moderna e confortável
- **Responsive**: Funciona em desktop, tablet e mobile
- **Animações**: Transições suaves e feedback visual
- **Notificações**: Alertas em tempo real para ações do usuário
- **Loading States**: Indicadores de carregamento para operações assíncronas

## 🔧 Integração com ord CLI

Para usar esta aplicação com o ord CLI real:

```bash
# Instalar ord (se ainda não tiver)
cargo install ord

# Criar uma oferta
ord wallet offer create <INSCRIPTION_ID> --amount <SATS> --fee-rate <FEE>

# Submeter oferta (novo na v0.23.3!)
ord wallet offer submit <PSBT>

# Sweep wallet (novo na v0.23.3!)
ord wallet sweep <ADDRESS> --fee-rate <FEE>
```

## 📊 Estrutura do Projeto

```
PSBT-Ordinals/
├── index.html                  # Página principal - Marketplace
├── runes-swap.html             # Página de swap de Runes
├── styles.css                  # Estilos globais
├── app.js                      # Lógica do marketplace
├── runes-swap.js              # Lógica do swap
├── config.js                   # Configuração do frontend
├── server/
│   ├── index.js               # Servidor Express
│   ├── routes/
│   │   ├── ordinals.js        # API de inscriptions
│   │   ├── runes.js           # API de runes
│   │   ├── offers.js          # API de ofertas
│   │   ├── wallet.js          # API de wallet
│   │   └── psbt.js            # API de PSBT
│   ├── utils/
│   │   ├── bitcoinRpc.js      # Cliente Bitcoin Core RPC
│   │   ├── ordApi.js          # Cliente Ord Server API
│   │   └── helpers.js         # Funções auxiliares
│   └── db/
│       └── init.js            # Inicialização do banco
├── setup.sh                    # Script de setup automático
├── test-connections.js         # Script de teste de conexões
├── .env.example               # Exemplo de configuração
├── NODE_SETUP.md              # Guia de setup dos nodes
├── API_REFERENCE.md           # Referência da API
└── README.md                  # Este arquivo
```

## 🔌 Integração com APIs

Esta aplicação integra com:

### Bitcoin Core RPC
- ✅ Obter informações da blockchain
- ✅ Consultar balances e UTXOs
- ✅ Criar e decodificar PSBTs
- ✅ Broadcast de transações
- ✅ Estimativa de fees dinâmica

### Ord Server HTTP API
- ✅ Buscar inscriptions por ID ou número
- ✅ Obter conteúdo de inscriptions
- ✅ Listar runes disponíveis
- ✅ Consultar balances de runes
- ✅ Explorar satoshis e outputs

📖 Veja [API_REFERENCE.md](./API_REFERENCE.md) para lista completa de endpoints.

## 🚧 Próximos Passos

- [ ] Integração com wallets browser (Unisat, Xverse, etc.)
- [ ] Cache Redis para performance
- [ ] WebSocket para atualizações em tempo real
- [ ] Suporte para satscards (ordinals.com)
- [ ] Charts e analytics avançados
- [ ] Notificações push
- [ ] Multi-idioma
- [ ] Modo testnet/signet

## 🧪 Testando

```bash
# Testar conexões com os nodes
npm test

# Testar API específica
curl http://localhost:3000/api/status | jq

# Testar fees
curl http://localhost:3000/api/psbt/fees | jq

# Testar balance
curl http://localhost:3000/api/wallet/balance/bc1q... | jq
```

## 📚 Referências

- [Ordinals Protocol](https://github.com/ordinals/ord)
- [Bitcoin Core RPC](https://bitcoin.org/en/developer-reference#bitcoin-core-apis)
- [Release v0.23.3](https://github.com/ordinals/ord/releases/tag/0.23.3)
- [PR #4408 - PSBT Offer Submission](https://github.com/ordinals/ord/pull/4408)
- [PR #4409 - Allow Submitting Offers](https://github.com/ordinals/ord/pull/4409)
- [BIP 174 - PSBT Specification](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki)

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se livre para:
- Reportar bugs
- Sugerir novas funcionalidades
- Melhorar a documentação
- Enviar pull requests

## 📄 Licença

MIT License - Sinta-se livre para usar em seus projetos!

## 👨‍💻 Autor

Construído com base nas atualizações mais recentes do protocolo Ordinals por Casey Rodarmor.

---

**⚡ Construído com Ordinals Protocol v0.23.3**


