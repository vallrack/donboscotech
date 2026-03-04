
"use client"

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole } from '@/lib/types';
import { useAuth as useFirebaseAuth, useUser, useDoc, useFirestore } from '@/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useFirebaseAuth();
  const db = useFirestore();
  const { user: authUser, loading: authLoading } = useUser();
  const syncAttempted = useRef(false);

  const profileRef = useMemo(() => authUser && db ? doc(db, 'userProfiles', authUser.uid) : null, [authUser?.uid, db]);
  const adminRef = useMemo(() => authUser && db ? doc(db, 'roles_admins', authUser.uid) : null, [authUser?.uid, db]);
  const coordRef = useMemo(() => authUser && db ? doc(db, 'roles_coordinators', authUser.uid) : null, [authUser?.uid, db]);
  const sectRef = useMemo(() => authUser && db ? doc(db, 'roles_secretaries', authUser.uid) : null, [authUser?.uid, db]);

  const { data: userProfile, loading: profileLoading } = useDoc(profileRef);
  const { data: adminRole } = useDoc(adminRef);
  const { data: coordRole } = useDoc(coordRef);
  const { data: sectRole } = useDoc(sectRef);

  const isLoading = authLoading || profileLoading;

  const resolvedUser = useMemo(() => {
    if (!authUser) return null;

    let role: UserRole = (userProfile?.role as UserRole) || 'docent';
    
    if (adminRole) role = 'admin';
    else if (coordRole) role = 'coordinator';
    else if (sectRole) role = 'secretary';

    return {
      id: authUser.uid,
      name: userProfile?.name || authUser.displayName || 'Usuario',
      email: authUser.email || '',
      role,
      avatarUrl: userProfile?.avatarUrl || authUser.photoURL || undefined,
      documentId: userProfile?.documentId,
      campus: userProfile?.campus,
      program: userProfile?.program,
      shiftIds: userProfile?.shiftIds || []
    };
  }, [authUser, adminRole, coordRole, sectRole, userProfile]);

  useEffect(() => {
    async function syncProfile() {
      if (authUser && db && !profileLoading && !userProfile && !syncAttempted.current) {
        syncAttempted.current = true;
        const pRef = doc(db, 'userProfiles', authUser.uid);
        
        const existingSnap = await getDoc(pRef);
        if (!existingSnap.exists()) {
          await setDoc(pRef, {
            name: authUser.displayName || authUser.email?.split('@')[0] || 'Usuario',
            email: authUser.email || '',
            role: 'docent',
            avatarUrl: authUser.photoURL || '',
            createdAt: serverTimestamp()
          });
        }
      }
    }
    syncProfile();
  }, [authUser, userProfile, profileLoading, db]);

  const login = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    if (!auth) return;
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, name: string, role: UserRole = 'docent') => {
    if (!auth || !db) return;
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const pRef = doc(db, 'userProfiles', userCredential.user.uid);
    await setDoc(pRef, {
      name,
      email,
      role,
      createdAt: serverTimestamp()
    });

    if (role !== 'docent') {
      const col = role === 'admin' ? 'roles_admins' : role === 'coordinator' ? 'roles_coordinators' : 'roles_secretaries';
      await setDoc(doc(db, col, userCredential.user.uid), {
        email,
        assignedAt: new Date().toISOString()
      });
    }
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user: resolvedUser, login, loginWithEmail, signUpWithEmail, logout, isLoading }}>
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
