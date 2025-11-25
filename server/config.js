// Configuração do frontend
const CONFIG = {
    // URL da API
    API_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:4000/api'
        : '/api',
    
    // Versão do protocolo
    ORDINALS_VERSION: '0.23.3',
    
    // Fee rates padrão
    DEFAULT_FEE_RATE: 10,
    MIN_FEE_RATE: 1,
    MAX_FEE_RATE: 1000,
    
    // Paginação
    PAGE_SIZE: 50,
    
    // Refresh intervals (ms)
    REFRESH_INTERVAL: 30000,
    
    // Timeouts
    REQUEST_TIMEOUT: 10000,
    
    // Networks suportadas
    NETWORKS: ['mainnet', 'testnet', 'signet'],
    CURRENT_NETWORK: 'mainnet'
};

async function apiRequest(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        timeout: CONFIG.REQUEST_TIMEOUT
    };
    
    try {
        const response = await fetch(url, { ...defaultOptions, ...options });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}
