"use client"

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '@/lib/types';
import { MOCK_USERS } from '@/lib/mock-data';

interface AuthContextType {
  user: User | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('don_bosco_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string) => {
    setIsLoading(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const foundUser = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('don_bosco_user', JSON.stringify(foundUser));
    } else {
      throw new Error('Usuario no encontrado');
    }
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('don_bosco_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};