# 🚀 Guia de Deploy Limpo (Clean Start)

Você decidiu começar do zero, e isso é ótimo! O código agora está **100% corrigido e pronto**. As configurações antigas estavam atrapalhando, então limpar tudo vai fazer funcionar de primeira.

Siga este guia passo a passo. Não pule nada!

---

## 1. GitHub (O Código)

O código no seu computador está perfeito. Precisamos garantir que ele vá para um **novo** repositório limpo.

1.  Vá no GitHub e crie um **Novo Repositório** (ex: `kray-station-v2`).
2.  Não marque "Add README", "Add .gitignore", nada. Crie vazio.
3.  No seu terminal (na pasta do projeto), rode estes comandos para "resetar" o git e enviar para o novo:

```bash
# Remove o histórico antigo (opcional, mas bom para começar limpo)
rm -rf .git

# Inicia um git novo
git init

# Adiciona todos os arquivos (agora organizados corretamente)
git add .

# Faz o primeiro commit
git commit -m "Initial Commit: Production Ready"

# Conecta ao novo repositório (troque SEU_USUARIO e O_NOVO_REPO)
git remote add origin https://github.com/SEU_USUARIO/O_NOVO_REPO.git

# Envia o código
git push -u origin main
```

---

## 2. Railway (O Backend)

Agora vamos subir o servidor. Como arrumamos o código, isso vai ser fácil.

1.  Crie um **Novo Projeto** no Railway -> **Deploy from GitHub repo**.
2.  Selecione o repositório novo (`kray-station-v2`).
3.  **IMPORTANTE:** Antes de clicar em Deploy, clique em **Variables**.
4.  Adicione as variáveis essenciais:
    *   `NODE_ENV`: `production`
    *   `PORT`: `3000`
    *   `USE_SUPABASE`: `true`
    *   `SUPABASE_URL`: (Sua URL do Supabase)
    *   `SUPABASE_SERVICE_KEY`: (Sua chave do Supabase)
    *   `QUICKNODE_ENDPOINT`: (Sua URL do QuickNode)
    *   `SESSION_SECRET`: (Invente uma senha longa)
5.  Vá em **Settings** -> **General**.
    *   **Root Directory**: Escreva `server` (Isso é crucial!).
6.  Vá em **Settings** -> **Networking**.
    *   Clique em **Generate Domain**.
    *   **COPIE ESSE DOMÍNIO** (ex: `kray-v2-production.up.railway.app`).

O deploy deve ficar **Verde** (Active).

---

## 3. Atualizar o Frontend (Linkar com Backend)

Antes de subir o site, precisamos dizer a ele onde está o backend novo.

1.  No seu computador, abra o arquivo `vercel.json` (que está na raiz).
2.  Troque o link antigo pelo **novo domínio do Railway** que você copiou:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://SEU-NOVO-DOMINIO-RAILWAY.up.railway.app/api/:path*"
    }
  ]
}
```

3.  Salve e envie essa mudança para o GitHub:
```bash
git add vercel.json
git commit -m "Config: Update Backend URL"
git push
```

---

## 4. Vercel (O Frontend)

Agora o site.

1.  Crie um **Novo Projeto** na Vercel.
2.  Importe o repositório novo (`kray-station-v2`).
3.  **Framework Preset**: Escolha `Other`.
4.  **Root Directory**: Deixe **EM BRANCO** (ou `./`). **NÃO** coloque `kray-vercel`.
    *   *Por que?* Porque eu movi as configurações para a raiz para facilitar sua vida.
5.  Clique em **Deploy**.

---

## 🎉 Resultado Esperado

*   **Railway**: Rodando o servidor Node.js (Backend).
*   **Vercel**: Mostrando o site lindo (Frontend).
*   **Conexão**: O site vai chamar `/api/...`, o Vercel vai redirecionar para o Railway, e os dados vão aparecer.

Se seguir isso, é impossível dar errado. O código está pronto! 🚀
