import axios from 'axios';

// Dynamic API URL for Frontend
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
export const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Global Axios Configuration
axios.defaults.baseURL = API_URL;

export default axios;
