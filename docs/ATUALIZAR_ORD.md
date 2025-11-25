# 🔄 Guia de Atualização - Ord 0.23.2 → 0.23.3

## ⚠️ IMPORTANTE: Passos Obrigatórios

**SIM! Você DEVE parar o Ord Server antes de substituir o binário!**

Se não parar:
- ❌ Arquivo pode estar em uso (erro ao substituir)
- ❌ Pode corromper o índice
- ❌ Processo pode crashar
- ❌ Dados podem ser perdidos

---

## ✅ PASSO A PASSO SEGURO

### Passo 1: Verificar Versão Atual

```bash
/Volumes/D1/Ord/ord --version
# Deve mostrar: ord 0.23.2
```

### Passo 2: Parar Ord Server (OBRIGATÓRIO!)

```bash
# Opção 1: Usar script de stop
sudo /Volumes/D1/Ord/stop_ord.sh

# Opção 2: Parar manualmente
sudo pkill ord

# Opção 3: Parar o processo específico
sudo kill 20574  # (PID que você viu no ps aux)
```

### Passo 3: Confirmar que Parou

```bash
# Verificar se ainda está rodando
ps aux | grep ord | grep -v grep

# Tentar acessar (deve falhar)
curl http://127.0.0.1:80/
# Se falhar = parou corretamente ✅
```

### Passo 4: Fazer Backup do Binário Atual

```bash
cd /Volumes/D1/Ord

# Criar backup
cp ord ord.backup.0.23.2

# Verificar backup
ls -lh ord*
```

### Passo 5: Substituir pelo Novo Binário

```bash
# Se você baixou para Downloads:
cd ~/Downloads

# Descompactar (se for .tar.gz)
tar -xzf ord-0.23.3-*.tar.gz

# Ou se for arquivo direto, copiar para pasta Ord
# Substituir o binário antigo
mv /Volumes/D1/Ord/ord /Volumes/D1/Ord/ord.old
cp ord /Volumes/D1/Ord/ord

# Dar permissão de execução
chmod +x /Volumes/D1/Ord/ord
```

### Passo 6: Verificar Nova Versão

```bash
/Volumes/D1/Ord/ord --version
# Deve mostrar: ord 0.23.3
```

### Passo 7: Reiniciar Ord Server

```bash
# Usar script de start
sudo /Volumes/D1/Ord/start_ord.sh

# Ou manualmente
sudo /Volumes/D1/Ord/ord \
  --data-dir /Volumes/D1/Ord/data \
  --bitcoin-rpc-username Tomkray7 \
  --bitcoin-rpc-password 'bobeternallove77$' \
  --commit-interval 50 \
  --bitcoin-rpc-limit 50 \
  --index-cache-size 8589934592 \
  --index-runes \
  --index-sats \
  --index-transactions \
  server --http-port 80
```

### Passo 8: Verificar que Está Rodando

```bash
# Verificar processo
ps aux | grep ord | grep -v grep

# Testar HTTP
curl http://127.0.0.1:80/ | head -10

# Deve mostrar HTML do Ord Server ✅
```

### Passo 9: Testar Marketplace

```bash
# Testar conexão
curl http://localhost:3000/api/status | jq

# Verificar nodes
# nodes.ord.connected deve ser true ✅
```

### Passo 10: Executar Testes

```bash
cd /Users/tomkray/Desktop/PSBT-Ordinals

# Testar tudo
npm run test:all
```

---

## 🔙 SE ALGO DER ERRADO

### Reverter para Versão Anterior

```bash
# 1. Parar Ord Server
sudo pkill ord

# 2. Restaurar backup
cd /Volumes/D1/Ord
rm ord
cp ord.backup.0.23.2 ord

# 3. Reiniciar
sudo ./start_ord.sh

# 4. Verificar
./ord --version
# Deve mostrar: ord 0.23.2
```

---

## 📋 CHECKLIST DE ATUALIZAÇÃO

Execute na ordem:

- [ ] 1. Verificar versão atual (`ord --version`)
- [ ] 2. **PARAR Ord Server** (`sudo pkill ord`)
- [ ] 3. Confirmar que parou (nenhum processo rodando)
- [ ] 4. Fazer backup (`cp ord ord.backup.0.23.2`)
- [ ] 5. Substituir binário
- [ ] 6. Dar permissão (`chmod +x ord`)
- [ ] 7. Verificar nova versão (`ord --version`)
- [ ] 8. Reiniciar servidor (`sudo ./start_ord.sh`)
- [ ] 9. Testar HTTP (`curl http://127.0.0.1:80/`)
- [ ] 10. Testar marketplace (`npm test`)

---

## ⚠️ AVISOS IMPORTANTES

### ✅ PODE fazer:
- ✅ Substituir binário (com servidor parado)
- ✅ Atualizar de 0.23.2 para 0.23.3
- ✅ Usar o mesmo índice (compatível)

### ❌ NÃO pode:
- ❌ Substituir com servidor rodando
- ❌ Deletar o índice (não precisa reindexar)
- ❌ Mudar diretórios de dados

### ℹ️ Importante:
- 🔸 Downtime: ~1-2 minutos
- 🔸 Índice: Compatível (não precisa reindexar)
- 🔸 Dados: Preservados
- 🔸 Configuração: Mantida

---

## 💡 RESUMO RÁPIDO

```bash
# 1. PARAR
sudo pkill ord

# 2. BACKUP
cp /Volumes/D1/Ord/ord /Volumes/D1/Ord/ord.backup.0.23.2

# 3. SUBSTITUIR
cp ~/Downloads/ord /Volumes/D1/Ord/ord
chmod +x /Volumes/D1/Ord/ord

# 4. VERIFICAR
/Volumes/D1/Ord/ord --version

# 5. REINICIAR
sudo /Volumes/D1/Ord/start_ord.sh

# 6. TESTAR
curl http://127.0.0.1:80/
```

---

## 🎯 Pronto para Atualizar?

Execute os passos acima com cuidado e você terá o Ord 0.23.3 funcionando em ~2 minutos!

**Tempo total estimado:** 2-5 minutos  
**Downtime:** 1-2 minutos  
**Dificuldade:** Fácil  
**Risco:** Baixo (tem backup)








