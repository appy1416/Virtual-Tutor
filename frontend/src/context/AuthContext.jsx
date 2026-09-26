import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if token exists on boot
    const verifySession = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/api/auth/me');
          setUser(res.data);
        } catch (err) {
          console.error("Session verification failed", err);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('role');
          sessionStorage.clear();
        }
      }
      setLoading(false);
    };
    verifySession();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { access_token } = res.data;
      localStorage.setItem('token', access_token);
      
      // Fetch full user details after token is stored
      const profileRes = await api.get('/api/auth/me');
      setUser(profileRes.data);
      return profileRes.data;
    } catch (err) {
      throw err.response?.data?.detail || (typeof err === 'string' ? err : "Login failed");
    }
  }, []);

  const register = useCallback(async (name, email, password, role) => {
    try {
      const res = await api.post('/api/auth/register', { name, email, password, role });
      return res.data;
    } catch (err) {
      throw err.response?.data?.detail || (typeof err === 'string' ? err : "Registration failed");
    }
  }, []);

  const loginWithGoogle = useCallback(async (credential, accessToken = null) => {
    try {
      const res = await api.post('/api/auth/google', { 
        credential: credential || undefined, 
        access_token: accessToken || undefined 
      });
      const { access_token } = res.data;
      localStorage.setItem('token', access_token);
      
      const profileRes = await api.get('/api/auth/me');
      setUser(profileRes.data);
      return profileRes.data;
    } catch (err) {
      const detail = err.response?.data?.detail;
      throw detail || (typeof err === 'string' ? err : "Google authentication failed. Please try again.");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // 1. Notify backend if session/token revocation endpoint exists (safe: ignore failures)
      await api.post('/api/auth/logout');
    } catch (_err) {
      // Safe logout: fail gracefully, proceed with frontend state clearance
    } finally {
      // 2. Clear all persisted authentication tokens and user data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      sessionStorage.clear();

      // 3. Clear axios Authorization header
      delete api.defaults.headers.common['Authorization'];

      // 4. Reset React authentication context state
      setUser(null);

      // 5. Navigate cleanly via React Router SPA mechanism
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Listen for unauthorized events triggered by HTTP interceptors
  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      sessionStorage.clear();
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

