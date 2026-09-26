import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL;
const API_BASE_URL = (rawApiUrl ? rawApiUrl.trim().replace(/\/+$/, '') : '') || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto inject Bearer token on every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // If request payload is FormData, remove Content-Type so browser sets multipart boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auto catch unauthorized requests to logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      sessionStorage.clear();
      delete api.defaults.headers.common['Authorization'];
      // Dispatch custom event so AuthContext can cleanly navigate via React Router
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth:unauthorized'));
        // Fallback redirection if pathname is not already /login and not handled
        if (!window.location.pathname.includes('/login')) {
          setTimeout(() => {
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }, 100);
        }
      }
    }
    return Promise.reject(error);
  }
);

export { API_BASE_URL };
export default api;
