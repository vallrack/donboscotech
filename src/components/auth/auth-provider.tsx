
"use client"

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole } from '@/lib/types';
import { useAuth as useFirebaseAuth, useUser, useDoc, useFirestore } from '@/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

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
  const syncRef = useRef(false);

  const adminRef = useMemo(() => authUser && db ? doc(db, 'roles_admins', authUser.uid) : null, [authUser, db]);
  const coordRef = useMemo(() => authUser && db ? doc(db, 'roles_coordinators', authUser.uid) : null, [authUser, db]);
  const sectRef = useMemo(() => authUser && db ? doc(db, 'roles_secretaries', authUser.uid) : null, [authUser, db]);
  const profileRef = useMemo(() => authUser && db ? doc(db, 'userProfiles', authUser.uid) : null, [authUser, db]);

  const { data: adminRole, loading: adminLoading } = useDoc(adminRef);
  const { data: coordRole, loading: coordLoading } = useDoc(coordRef);
  const { data: sectRole, loading: sectLoading } = useDoc(sectRef);
  const { data: userProfile, loading: profileLoading } = useDoc(profileRef);

  const isLoading = authLoading || adminLoading || coordLoading || sectLoading || profileLoading;

  const resolvedUser = useMemo(() => {
    if (!authUser) return null;

    let role: UserRole = 'docent';
    // Priority: Security Collections are the Source of Truth for privileged roles
    if (adminRole) {
      role = 'admin';
    } else if (coordRole) {
      role = 'coordinator';
    } else if (sectRole) {
      role = 'secretary';
    } else if (userProfile?.role) {
      role = userProfile.role as UserRole;
    }

    return {
      id: authUser.uid,
      name: userProfile?.name || authUser.displayName || authUser.email?.split('@')[0] || 'Usuario',
      email: authUser.email || '',
      role,
      avatarUrl: userProfile?.avatarUrl || authUser.photoURL || undefined,
      documentId: userProfile?.documentId,
      campus: userProfile?.campus,
      program: userProfile?.program,
      shiftIds: userProfile?.shiftIds
    };
  }, [authUser, adminRole, coordRole, sectRole, userProfile]);

  // Handle profile synchronization only when necessary
  useEffect(() => {
    if (authUser && db && !profileLoading && resolvedUser && !syncRef.current) {
      const pRef = doc(db, 'userProfiles', authUser.uid);
      
      if (!userProfile) {
        syncRef.current = true;
        setDoc(pRef, {
          name: authUser.displayName || authUser.email?.split('@')[0] || 'Usuario',
          email: authUser.email || '',
          role: resolvedUser.role,
          avatarUrl: authUser.photoURL || '',
          createdAt: serverTimestamp()
        }, { merge: true }).finally(() => { syncRef.current = false; });
      } else if (userProfile.role !== resolvedUser.role) {
        syncRef.current = true;
        updateDoc(pRef, { role: resolvedUser.role }).finally(() => { syncRef.current = false; });
      }
    }
  }, [authUser, userProfile, profileLoading, db, resolvedUser]);

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

    if (role === 'secretary') {
      await setDoc(doc(db, 'roles_secretaries', userCredential.user.uid), {
        email,
        assignedAt: new Date().toISOString()
      });
    }
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
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
