# 📝 CRIAR REPOSITÓRIOS - PASSO A PASSO VISUAL

## ⏱️ TEMPO: 5 MINUTOS

---

## 🎯 VOCÊ VAI CRIAR 3 REPOSITÓRIOS

```
1. kraywallet-extension  (PÚBLICO)   ← Chrome Extension
2. kraywallet-backend    (PRIVADO)   ← API Backend
3. kraywallet-mobile     (PÚBLICO)   ← iOS/Android App
```

---

## 📋 REPO 1: kraywallet-extension

### Passo 1: Abrir GitHub
1. Acesse: **https://github.com/new**
2. Ou: GitHub.com > Click no **+** (canto superior direito) > **New repository**

### Passo 2: Preencher Formulário

**Repository name:**
```
kraywallet-extension
```

**Description:**
```
Bitcoin wallet with Ordinals and Runes - Chrome Extension
```

**Visibility:**
- ✅ **Public** (marcar Public)

**Initialize repository:**
- ❌ **NÃO** marcar "Add a README file"
- ❌ **NÃO** marcar "Add .gitignore"
- ❌ **NÃO** marcar "Choose a license"

### Passo 3: Criar
- Click **"Create repository"** (botão verde)

### Passo 4: Copiar URL
Na página que abrir, copiar a URL que aparece:
```
https://github.com/SEU-USER/kraywallet-extension.git
```

**Guardar essa URL!** Vai usar daqui a pouco.

---

## 📋 REPO 2: kraywallet-backend

### Passo 1: Criar Novo Repo
- Click **"+"** > **"New repository"** de novo

### Passo 2: Preencher

**Repository name:**
```
kraywallet-backend
```

**Description:**
```
KrayWallet Backend API (Private)
```

**Visibility:**
- ⚠️ **Private** (marcar Private - IMPORTANTE!)

**Initialize repository:**
- ❌ Deixar TUDO desmarcado

### Passo 3: Criar
- Click **"Create repository"**

### Passo 4: Copiar URL
```
https://github.com/SEU-USER/kraywallet-backend.git
```

**Guardar essa URL!**

---

## 📋 REPO 3: kraywallet-mobile

### Passo 1: Criar Novo Repo
- Click **"+"** > **"New repository"** de novo

### Passo 2: Preencher

**Repository name:**
```
kraywallet-mobile
```

**Description:**
```
KrayWallet Mobile - iOS & Android Bitcoin Wallet
```

**Visibility:**
- ✅ **Public**

**Initialize repository:**
- ❌ Deixar TUDO desmarcado

### Passo 3: Criar
- Click **"Create repository"**

### Passo 4: Copiar URL
```
https://github.com/SEU-USER/kraywallet-mobile.git
```

**Guardar essa URL!**

---

## ✅ PRONTO! Agora Você Tem 3 URLs

Exemplo:
```
1. https://github.com/seu-user/kraywallet-extension.git
2. https://github.com/seu-user/kraywallet-backend.git
3. https://github.com/seu-user/kraywallet-mobile.git
```

---

## 🚀 PRÓXIMO PASSO: FAZER PUSH

Copie e execute estes comandos (substitua SEU-USER pelo seu username):

```bash
# Extension
cd "/Volumes/D2/KRAY WALLET- V1/github-ready/kraywallet-extension"
git remote add origin https://github.com/SEU-USER/kraywallet-extension.git
git push -u origin main

# Backend
cd "/Volumes/D2/KRAY WALLET- V1/github-ready/kraywallet-backend"
git remote add origin https://github.com/SEU-USER/kraywallet-backend.git
git push -u origin main

# Mobile
cd "/Volumes/D2/KRAY WALLET- V1/github-ready/kraywallet-mobile"
git remote add origin https://github.com/SEU-USER/kraywallet-mobile.git
git push -u origin main
```

---

## 🎉 DEPOIS DO PUSH

Verificar que tudo subiu:
1. Acesse cada repo no GitHub
2. Veja se README aparece
3. Veja se código está lá
4. ✅ Sucesso!

---

## 🆘 SE DER ERRO

### "Authentication failed":
```bash
# GitHub pedindo senha?
# Use Personal Access Token:

# 1. Criar token:
#    https://github.com/settings/tokens/new
#    Scopes: ✅ repo (marcar tudo em repo)
#    Generate token
#    Copiar token (só aparece uma vez!)

# 2. Usar como senha no push
#    Username: seu-user
#    Password: [colar token]
```

### "Permission denied (publickey)":
```bash
# Configurar SSH:
ssh-keygen -t ed25519 -C "seu@email.com"
cat ~/.ssh/id_ed25519.pub
# Copiar output e adicionar em:
# https://github.com/settings/keys
```

---

**FÁCIL, NÉ? 5 MINUTOS E ESTÁ PRONTO! 🚀**






