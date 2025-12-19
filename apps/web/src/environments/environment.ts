export const environment = {
    production: false,
    apiOrigin: (import.meta as any).env?.VITE_EXPOSE === 'true' ? '' : 'http://localhost:3000',
    apiUrl: (import.meta as any).env?.VITE_EXPOSE === 'true' ? '' : 'http://localhost:3000',
    publicPrefix: '/uploads'
};
