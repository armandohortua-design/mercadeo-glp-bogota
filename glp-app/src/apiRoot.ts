// URL del backend del CRM — configurable vía VITE_API_URL (.env.local).
// Sin esa variable, cae a localhost:3001 (solo funciona si el sitio y el backend
// corren en la misma máquina — no sirve para producción/despliegue remoto).
export const API_ROOT: string = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
