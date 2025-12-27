export const environment = {
    production: true,
    // apiOrigin: 'https://kanban-api-s8cs.onrender.com', // Explicit API domain
    // apiUrl: 'https://kanban-api-s8cs.onrender.com',    // Explicit API domain (Socket.IO)
    // publicPrefix: '/uploads'
     apiOrigin: (import.meta as any).env?.VITE_EXPOSE === 'true' ? '' : 'http://localhost:3000',
    apiUrl: (import.meta as any).env?.VITE_EXPOSE === 'true' ? '' : 'http://localhost:3000',
    publicPrefix: '/uploads'
};