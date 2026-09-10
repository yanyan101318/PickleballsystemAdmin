import axios from 'axios';

// Dynamic API URL for Frontend
export const API_URL = import.meta.env.VITE_API_URL || 'https://pickleballsystemadmin.onrender.com';
export const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://pickleballsystemadmin.onrender.com';

// Global Axios Configuration
axios.defaults.baseURL = API_URL;

// Global Fetch Interceptor for relative /api requests
const originalFetch = window.fetch;
window.fetch = function (resource, config) {
  if (typeof resource === 'string' && resource.startsWith('/api')) {
    resource = `${API_URL}${resource}`;
  }
  return originalFetch(resource, config);
};

export default axios;

