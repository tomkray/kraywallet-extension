# ⚠️ PROBLEMA: ORD Server Não Está Rodando

## 🔍 Diagnóstico

O backend Node.js **está funcionando corretamente**, mas as **inscriptions e runes não aparecem** porque o **ORD server não está rodando**.

### Erro no Log:
```
Error: connect ECONNREFUSED 127.0.0.1:80
```

Isso significa que o backend está tentando conectar na porta 80 (ORD server), mas não há nada rodando lá.

---

## ✅ Código Está OK!

**NÃO quebramos nada!** As alterações que fizemos foram:
- ✅ `server/utils/psbtBuilderRunes.js` - Código válido
- ✅ `server/routes/runes.js` - Funcionando
- ✅ `server/routes/mywallet.js` - Funcionando
- ✅ Extension - Funcionando

O único problema é que o **ORD server precisa estar rodando** para buscar dados de inscriptions e runes.

---

## 🚀 Solução: Iniciar o ORD Server

### Opção 1: Via Terminal (Recomendado)

```bash
# 1. Verificar se ord está instalado
ord --version

# 2. Se não estiver, instalar:
cargo install --git https://github.com/ordinals/ord --locked ord

# 3. Iniciar ORD server (porta 80)
sudo ord --index-runes --index-sats server --http-port 80
```

**Nota:** Precisa de `sudo` porque porta 80 requer privilégios administrativos.

---

### Opção 2: Usar Porta Diferente (Sem sudo)

Se não quiser usar `sudo`, pode rodar em outra porta:

```bash
# 1. Iniciar ORD na porta 8080
ord --index-runes --index-sats server --http-port 8080 &

# 2. Atualizar config.js
# Mudar:  ORD_SERVER_URL = 'http://127.0.0.1:80'
# Para:   ORD_SERVER_URL = 'http://127.0.0.1:8080'

# 3. Reiniciar backend Node.js
pkill -f "node.*server/index.js"
node server/index.js > backend.log 2>&1 &
```

---

## 📊 Como Verificar se Está Funcionando

### 1. Testar ORD Server Diretamente:
```bash
curl http://127.0.0.1:80/
```

Deve retornar HTML da página inicial do ORD.

### 2. Testar API de Runes:
```bash
curl http://localhost:3000/api/runes/by-address/bc1pvz02d8z6c4d7r2m4zvx83z5ng5ggx7pkhx796hdtd9aef85hlk9q3m36gx
```

Se ORD estiver rodando, deve retornar as runes.

### 3. Abrir Extension:
- Aba **Ordinals** deve mostrar inscriptions
- Aba **Runes** deve mostrar runes

---

## 🔧 Troubleshooting

### "ord: command not found"
```bash
# Instalar ord
cargo install --git https://github.com/ordinals/ord --locked ord

# Adicionar ao PATH (se necessário)
export PATH="$HOME/.cargo/bin:$PATH"
```

### "Permission denied" na porta 80
```bash
# Use sudo
sudo ord --index-runes --index-sats server --http-port 80

# OU use outra porta (8080, 3001, etc)
ord --index-runes --index-sats server --http-port 8080
```

### "Bitcoin Core not running"
```bash
# ORD precisa do Bitcoin Core rodando
# Inicie o Bitcoin Core primeiro:
bitcoind -daemon

# Aguarde sincronizar, depois inicie ORD
ord --index-runes --index-sats server --http-port 80
```

---

## 📝 Status Atual

✅ Backend Node.js: **RODANDO**  
❌ ORD Server: **NÃO RODANDO**  
✅ Extension: **FUNCIONANDO**  
✅ Código: **SEM ERROS**

---

## 🎯 Próximo Passo

**Você precisa iniciar o ORD server manualmente:**

```bash
sudo ord --index-runes --index-sats server --http-port 80
```

Depois disso, tudo voltará a funcionar! 🚀

---

**Data:** 22 de outubro de 2025  
**Problema:** ORD server não está rodando  
**Solução:** Iniciar ORD server manualmente

