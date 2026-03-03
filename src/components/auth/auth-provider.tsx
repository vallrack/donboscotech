"use client"

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User, UserRole } from '@/lib/types';
import { useAuth as useFirebaseAuth, useUser, useDoc, useFirestore } from '@/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useFirebaseAuth();
  const db = useFirestore();
  const { user: authUser, loading: authLoading } = useUser();

  // Fetch roles to determine privileges
  const { data: adminRole, loading: adminLoading } = useDoc(authUser ? doc(db!, 'roles_admins', authUser.uid) : null);
  const { data: coordRole, loading: coordLoading } = useDoc(authUser ? doc(db!, 'roles_coordinators', authUser.uid) : null);
  const { data: userProfile, loading: profileLoading } = useDoc(authUser ? doc(db!, 'userProfiles', authUser.uid) : null);

  const isLoading = authLoading || adminLoading || coordLoading || profileLoading;

  const resolvedUser = useMemo(() => {
    if (!authUser) return null;

    let role: UserRole = 'docent';
    if (adminRole) role = 'admin';
    else if (coordRole) role = 'coordinator';
    else if (userProfile?.role) role = userProfile.role as UserRole;

    return {
      id: authUser.uid,
      name: authUser.displayName || 'Usuario',
      email: authUser.email || '',
      role,
      avatarUrl: authUser.photoURL || undefined
    };
  }, [authUser, adminRole, coordRole, userProfile]);

  // Sync profile to Firestore on login if it doesn't exist or role is docent
  useEffect(() => {
    if (authUser && !profileLoading && !userProfile && db) {
      const profileRef = doc(db, 'userProfiles', authUser.uid);
      setDoc(profileRef, {
        name: authUser.displayName || 'Usuario',
        email: authUser.email || '',
        role: resolvedUser?.role || 'docent',
        avatarUrl: authUser.photoURL || ''
      }, { merge: true });
    }
  }, [authUser, userProfile, profileLoading, db, resolvedUser?.role]);

  const login = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user: resolvedUser, login, logout, isLoading }}>
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
