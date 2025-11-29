# ✅ DEPLOYMENT CHECKLIST

Use este checklist para garantir que não esqueceu nada!

---

## 📋 PRÉ-REQUISITOS

### Contas criadas:
- [ ] GitHub account criado
- [ ] Vercel account criado (conectado ao GitHub)
- [ ] Supabase account criado
- [ ] Google Developer account criado ($5 pago)
- [ ] QuickNode account (já tem ✅)

### Ferramentas instaladas:
- [ ] Node.js >= 18 instalado
- [ ] Git instalado
- [ ] Vercel CLI instalado (`npm i -g vercel`)
- [ ] curl disponível (para testes)

---

## 🗄️ SUPABASE

- [ ] Projeto criado (`kraywallet-production`)
- [ ] Region selecionada (East US)
- [ ] Database password salvo em local seguro
- [ ] Schema SQL executado (`schema.sql`)
- [ ] Tabelas criadas verificadas (inscriptions, runes, etc)
- [ ] SUPABASE_URL copiado
- [ ] SUPABASE_ANON_KEY copiado
- [ ] SUPABASE_SERVICE_KEY copiado ⚠️ SEGREDO!
- [ ] RLS habilitado e testado

---

## 🌐 BACKEND (Vercel)

### Preparação:
- [ ] Repositório GitHub criado (`kraywallet-backend` - PRIVADO)
- [ ] Código commitado (sem .env!)
- [ ] .gitignore aplicado
- [ ] Push para GitHub feito

### Deploy:
- [ ] Projeto importado na Vercel
- [ ] Environment Variables configuradas:
  - [ ] QUICKNODE_ENDPOINT
  - [ ] QUICKNODE_ENABLED=true
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_ANON_KEY
  - [ ] SUPABASE_SERVICE_KEY
  - [ ] NODE_ENV=production
  - [ ] ALLOWED_ORIGINS
- [ ] Deploy executado com sucesso
- [ ] Domínio `api.kraywallet.com` adicionado
- [ ] DNS configurado (CNAME → cname.vercel-dns.com)
- [ ] SSL ativo (https)

### Testes:
- [ ] `curl https://api.kraywallet.com/api/health` → 200 OK
- [ ] `curl https://api.kraywallet.com/api/wallet/bc1p.../balance` → dados corretos
- [ ] CORS funcionando (testar do browser)
- [ ] Rate limiting ativo
- [ ] Logs sem erros

---

## 🦊 EXTENSÃO (Chrome Web Store)

### Build:
- [ ] `deployment/extension/build.sh` executado
- [ ] ZIP gerado (`kraywallet-v1.0.0.zip`)
- [ ] Testado localmente (`chrome://extensions/`)
- [ ] Funcionalidades testadas:
  - [ ] Criar wallet
  - [ ] Ver balance
  - [ ] Listar runes
  - [ ] Listar inscriptions
  - [ ] Activity tab
  - [ ] Send Bitcoin/Runes/Inscriptions

### Assets preparados:
- [ ] icon-16.png (16x16)
- [ ] icon-48.png (48x48)
- [ ] icon-128.png (128x128)
- [ ] 5 screenshots (1280x800 cada)
- [ ] Promotional images (opcional)

### Chrome Web Store:
- [ ] Developer account ativo ($5 pago)
- [ ] Extensão uploaded
- [ ] Store listing preenchido:
  - [ ] Nome
  - [ ] Descrição curta
  - [ ] Descrição longa
  - [ ] Screenshots
  - [ ] Category: Productivity
  - [ ] Privacy Policy URL
  - [ ] Support URL
- [ ] Permissões justificadas
- [ ] Single purpose description
- [ ] Submetido para revisão
- [ ] Aguardando aprovação (2-3 dias)

---

## 🌐 FRONTEND (Vercel)

### Preparação:
- [ ] Repositório GitHub criado (`kraywallet-frontend` - PÚBLICO)
- [ ] Arquivos essenciais commitados:
  - [ ] index.html
  - [ ] krayscan.html
  - [ ] runes-swap.html
  - [ ] js/
  - [ ] public/
- [ ] URLs atualizadas (localhost → produção)

### Deploy:
- [ ] Projeto importado na Vercel
- [ ] Deploy executado
- [ ] Domínio `kraywallet.com` configurado
- [ ] DNS configurado:
  - [ ] A record → 76.76.21.21
  - [ ] CNAME www → cname.vercel-dns.com
- [ ] SSL ativo

### Testes:
- [ ] https://kraywallet.com carrega
- [ ] KrayScan funciona
- [ ] Runes Swap funciona
- [ ] Links para extensão funcionam

---

## 📄 DOCUMENTOS LEGAIS

- [ ] Privacy Policy criado e publicado
- [ ] Terms of Service criado e publicado
- [ ] Support page criada
- [ ] About page criada (opcional)

---

## 🔐 SEGURANÇA

### Verificações finais:
- [ ] Nenhum arquivo .env commitado
- [ ] Nenhuma key hardcoded no código
- [ ] QuickNode endpoint não exposto
- [ ] Supabase SERVICE_KEY apenas no backend
- [ ] CORS configurado corretamente
- [ ] Rate limiting ativo
- [ ] Input validation em todas APIs
- [ ] HTTPS everywhere
- [ ] Logs sem dados sensíveis

---

## 🎯 VALIDAÇÃO FINAL

### Testes end-to-end:

#### Backend API:
```bash
# Health
curl https://api.kraywallet.com/api/health

# Balance
curl https://api.kraywallet.com/api/wallet/bc1p.../balance

# Runes
curl https://api.kraywallet.com/api/runes/fast/bc1p...

# Deve retornar JSON válido, sem erros
```

#### Frontend:
- [ ] Abrir https://kraywallet.com
- [ ] Marketplace carrega
- [ ] KrayScan busca TX
- [ ] Runes Swap lista runes
- [ ] Links funcionam

#### Extensão (após aprovação):
- [ ] Instalar da Chrome Web Store
- [ ] Criar wallet
- [ ] Importar wallet
- [ ] Ver balance
- [ ] Listar runes
- [ ] Listar inscriptions
- [ ] Activity tab mostra histórico
- [ ] Enviar Bitcoin
- [ ] Enviar Rune
- [ ] Enviar Inscription
- [ ] Conectar com dApp (opcional)

---

## 📊 MONITORAMENTO

### Dashboards para acompanhar:

- [ ] **Vercel Analytics**: https://vercel.com/dashboard
  - Requests/minuto
  - Response time
  - Erros 4xx/5xx
  - Bandwidth usage

- [ ] **Supabase Dashboard**: https://supabase.com/dashboard
  - Database size
  - Queries/segundo
  - Connection pool
  - Table sizes

- [ ] **QuickNode Dashboard**: https://dashboard.quicknode.com
  - API calls/dia
  - Créditos restantes
  - Rate limit status
  - Latência média

- [ ] **Chrome Web Store**: https://chrome.google.com/webstore/devconsole
  - Downloads
  - Ratings
  - Reviews
  - Crash reports

---

## 🆘 PROBLEMAS?

### Se algo der errado:

1. **Backend não responde**:
   ```bash
   # Ver logs
   vercel logs
   
   # Verificar env vars
   vercel env ls
   ```

2. **Extensão rejeitada**:
   - Ler feedback do Google
   - Ajustar descrição/permissões
   - Re-submeter

3. **CORS errors**:
   - Verificar ALLOWED_ORIGINS
   - Testar com curl
   - Verificar headers

4. **Database errors**:
   - Verificar schema no Supabase
   - Checar RLS policies
   - Ver logs do Supabase

---

## 🎊 SUCESSO!

Quando tudo estiver ✅:

```
✅ Backend: https://api.kraywallet.com/api/health
✅ Frontend: https://kraywallet.com
✅ Extensão: Aguardando aprovação (ou publicada!)
✅ Database: Supabase operacional
✅ Monitoramento: Dashboards ativos
```

**PARABÉNS! Sua wallet está no ar! 🚀🎉**

---

## 📞 PRÓXIMOS PASSOS

Após o launch:

1. **Marketing**:
   - Tweet sobre o lançamento
   - Post no Reddit (r/Bitcoin, r/Ordinals)
   - Post no Discord communities

2. **Feedback**:
   - Coletar reviews na Chrome Store
   - Ajustar conforme feedback
   - Iteração contínua

3. **Crescimento**:
   - Monitorar métricas
   - Otimizar performance
   - Adicionar features

---

**BOA SORTE! Você consegue! 💪🚀**






