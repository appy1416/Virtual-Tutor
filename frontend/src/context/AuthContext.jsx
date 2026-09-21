import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
        }
      }
      setLoading(false);
    };
    verifySession();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { access_token, role, name } = res.data;
      localStorage.setItem('token', access_token);
      
      // Fetch full user details after token is stored
      const profileRes = await api.get('/api/auth/me');
      setUser(profileRes.data);
      return profileRes.data;
    } catch (err) {
      throw err.response?.data?.detail || "Login failed";
    }
  };

  const register = async (name, email, password, role) => {
    try {
      const res = await api.post('/api/auth/register', { name, email, password, role });
      return res.data;
    } catch (err) {
      throw err.response?.data?.detail || "Registration failed";
    }
  };

  const loginWithGoogle = async (credential, accessToken = null) => {
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
      throw err.response?.data?.detail || "Google login failed";
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
