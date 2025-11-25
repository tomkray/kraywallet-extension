# 🚀 Production Deployment Guide

This guide outlines the steps to deploy the Kray Wallet and KrayScan to production, ensuring perfect parity with the local environment.

## Architecture Overview

*   **Frontend**: Deployed on **Vercel** (Static Site with API Proxy).
*   **Backend**: Deployed on **Railway** (Node.js API).
*   **Database**: **Supabase** (PostgreSQL) replaces the local SQLite.
*   **Blockchain Data**: **QuickNode** (Bitcoin RPC & Indexer).

---

## Part 1: Backend Deployment (Railway)

The backend requires a persistent Node.js environment, which Vercel Serverless does not fully support for this specific architecture (due to background jobs and custom Bitcoin RPC handling).

1.  **Prepare the Backend Repository**
    *   Create a new GitHub repository (e.g., `kray-wallet-backend`).
    *   Copy the contents of the `server/` directory to the root of this new repository.
    *   Ensure `package.json` and `init-supabase.js` are included.
    *   Push the code to GitHub.

2.  **Deploy to Railway**
    *   Log in to [Railway](https://railway.app/).
    *   Click "New Project" -> "Deploy from GitHub repo".
    *   Select your `kray-wallet-backend` repository.
    *   Railway will automatically detect Node.js and the start command.

3.  **Configure Environment Variables**
    *   In the Railway project settings, add the following variables:
        *   `PORT`: `4000` (or let Railway assign one and use `0.0.0.0`)
        *   `NODE_ENV`: `production`
        *   `USE_LOCAL_DB`: `false` (Disables SQLite)
        *   `USE_SUPABASE`: `true`
        *   `SUPABASE_URL`: `your_supabase_project_url`
        *   `SUPABASE_SERVICE_KEY`: `your_supabase_service_role_key`
        *   `QUICKNODE_ENDPOINT`: `your_quicknode_http_url`
        *   `QUICKNODE_ENABLED`: `true`

4.  **Generate Domain**
    *   In Railway, go to "Settings" -> "Networking" -> "Generate Domain".
    *   Copy this URL (e.g., `https://kray-backend-production.up.railway.app`). **You will need this for the Frontend.**

---

## Part 2: Frontend Deployment (Vercel)

The frontend is a static site that connects to the backend via API calls. We have configured it to proxy requests to the backend.

1.  **Update Configuration**
    *   Open `kray-vercel/vercel.json`.
    *   Replace `https://YOUR_RAILWAY_APP_URL` with your actual Railway domain from Part 1.
    *   Example:
        ```json
        "destination": "https://kray-backend-production.up.railway.app/api/:path*"
        ```
    *   Commit and push this change to your repository.

2.  **Deploy to Vercel**
    *   Log in to [Vercel](https://vercel.com/).
    *   Click "Add New..." -> "Project".
    *   Import your main repository (`kray-station`).
    *   **Root Directory**: Edit this and select `kray-vercel`.
    *   **Framework Preset**: "Other" (or leave default, it's static HTML/JS).
    *   Click "Deploy".

---

## Part 3: Verification

Once both are deployed:

1.  **Check KrayScan**:
    *   Open your Vercel URL (e.g., `https://kray-wallet.vercel.app/krayscan.html`).
    *   Search for a known inscription or rune.
    *   Verify that details load correctly (images, names, symbols).
    *   *Note: We updated `krayscan.js` to use the API instead of scraping a local `ord` server, so this should work seamlessly.*

2.  **Check Wallet**:
    *   Connect your wallet.
    *   Verify UTXOs are loaded.
    *   *Note: The backend now correctly handles JSON responses for UTXOs.*

## Troubleshooting

*   **CORS Errors**: If you see CORS errors in the browser console, ensure your Railway backend allows requests from your Vercel domain. You may need to update `cors` settings in `server/index.js` to allow the Vercel origin.
*   **Images not loading**: Check if the `vercel.json` rewrite is correct and that the backend is returning valid URLs for thumbnails.
