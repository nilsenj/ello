export const environment = {
    production: false,
    apiOrigin: '',
    apiUrl: '',
    publicPrefix: '/uploads',
    billingProvider: (import.meta as any).env?.VITE_BILLING_PROVIDER || 'mock'
};
