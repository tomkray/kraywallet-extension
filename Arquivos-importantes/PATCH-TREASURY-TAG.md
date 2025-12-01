# PATCH: Treasury Tag no kray-l2.html

## Arquivo: backend-render/kray-l2.html

### ENCONTRE (linha ~891):
```javascript
        // Load accounts
        async function loadAccounts() {
```

### SUBSTITUA POR:
```javascript
        // Treasury address
        const TREASURY_ADDR = 'bc1p5u00mjuxy0c040t9jdvcjxmzjsy2yluzukdzkta0fnu0hc5m29aqhk3nhv';
        
        // Load accounts
        async function loadAccounts() {
```

---

### ENCONTRE (linha ~902):
```javascript
                list.innerHTML = data.accounts.map((acc, i) => `
                    <div class="l2-tx-item fade-in">
                        <div style="display:flex;align-items:center;gap:16px;">
                            <span style="display:inline-flex;width:36px;height:36px;background:rgba(139,92,246,0.15);border-radius:50%;align-items:center;justify-content:center;font-weight:700;color:#8b5cf6;">#${i+1}</span>
                            <div>
                                <div class="l2-hash" style="font-size:12px;">${acc.l1_address}</div>
                                <div style="font-size:11px;color:#666;margin-top:4px;">Nonce: ${acc.nonce || 0}</div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:18px;font-weight:700;">${parseInt(acc.balance || acc.balance_credits || 0).toLocaleString()}</div>
                            <div style="font-size:11px;color:#888;">KRAY</div>
                        </div>
                    </div>
                `).join('');
```

### SUBSTITUA POR:
```javascript
                list.innerHTML = data.accounts.map((acc, i) => {
                    const isTreasury = acc.id === 'treasury' || acc.l1_address === TREASURY_ADDR || acc.l1_address === 'treasury_system';
                    const shortAddr = (acc.l1_address || '').substring(0, 20) + '...';
                    
                    if (isTreasury) {
                        return `<div class="l2-tx-item fade-in" style="background:linear-gradient(135deg,rgba(245,158,11,0.05) 0%,rgba(234,88,12,0.05) 100%);border:1px solid rgba(245,158,11,0.2);">
                            <div style="display:flex;align-items:center;gap:16px;">
                                <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:2px solid #f59e0b;box-shadow:0 0 12px rgba(245,158,11,0.4);">
                                    <img src="public/images/mobile-app-icon.png" alt="KRAY" style="width:100%;height:100%;object-fit:cover;">
                                </div>
                                <div>
                                    <div style="display:flex;align-items:center;gap:8px;">
                                        <span class="l2-hash" style="font-size:12px;">${shortAddr}</span>
                                        <span style="display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,rgba(245,158,11,0.2) 0%,rgba(234,88,12,0.2) 100%);border:1px solid rgba(245,158,11,0.5);border-radius:4px;padding:2px 6px;font-size:9px;font-weight:700;color:#f59e0b;text-transform:uppercase;">
                                            <img src="public/images/mobile-app-icon.png" alt="" style="width:10px;height:10px;">Treasury
                                        </span>
                                    </div>
                                    <div style="font-size:11px;color:#666;margin-top:4px;">💰 Fee Collection</div>
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:18px;font-weight:700;color:#f59e0b;">${parseInt(acc.balance || acc.balance_credits || 0).toLocaleString()}</div>
                                <div style="font-size:11px;color:#888;">KRAY</div>
                            </div>
                        </div>`;
                    }
                    
                    return `<div class="l2-tx-item fade-in">
                        <div style="display:flex;align-items:center;gap:16px;">
                            <span style="display:inline-flex;width:36px;height:36px;background:rgba(139,92,246,0.15);border-radius:50%;align-items:center;justify-content:center;font-weight:700;color:#8b5cf6;">#${i+1}</span>
                            <div>
                                <div class="l2-hash" style="font-size:12px;">${acc.l1_address}</div>
                                <div style="font-size:11px;color:#666;margin-top:4px;">Nonce: ${acc.nonce || 0}</div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:18px;font-weight:700;">${parseInt(acc.balance || acc.balance_credits || 0).toLocaleString()}</div>
                            <div style="font-size:11px;color:#888;">KRAY</div>
                        </div>
                    </div>`;
                }).join('');
```

---

## SQL para Supabase (atualizar Treasury):

```sql
UPDATE l2_accounts 
SET l1_address = 'bc1p5u00mjuxy0c040t9jdvcjxmzjsy2yluzukdzkta0fnu0hc5m29aqhk3nhv',
    balance_credits = '3'
WHERE id = 'treasury' OR l1_address = 'treasury_system';
```


