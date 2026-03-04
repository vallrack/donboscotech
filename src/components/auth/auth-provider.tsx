
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
  const [resolvedUser, setResolvedUser] = useState<User | null>(null);
  const [resolving, setResolving] = useState(false);
  const syncAttempted = useRef(false);

  // Monitor authUser and fetch profile once
  useEffect(() => {
    async function resolveInstitutionalData() {
      if (!authUser || !db) {
        setResolvedUser(null);
        setResolving(false);
        return;
      }

      setResolving(true);
      try {
        const uid = authUser.uid;
        const profileRef = doc(db, 'userProfiles', uid);
        const profileSnap = await getDoc(profileRef);
        
        let profileData = profileSnap.exists() ? profileSnap.data() : null;

        // Sync basic profile if missing
        if (!profileSnap.exists() && !syncAttempted.current) {
          syncAttempted.current = true;
          const initialData = {
            name: authUser.displayName || authUser.email?.split('@')[0] || 'Usuario',
            email: authUser.email || '',
            role: 'docent',
            createdAt: serverTimestamp()
          };
          await setDoc(profileRef, initialData);
          profileData = initialData;
        }

        // Check for elevated roles in parallel
        const [adminSnap, coordSnap, sectSnap] = await Promise.all([
          getDoc(doc(db, 'roles_admins', uid)),
          getDoc(doc(db, 'roles_coordinators', uid)),
          getDoc(doc(db, 'roles_secretaries', uid))
        ]);

        let finalRole: UserRole = (profileData?.role as UserRole) || 'docent';
        if (adminSnap.exists()) finalRole = 'admin';
        else if (coordSnap.exists()) finalRole = 'coordinator';
        else if (sectSnap.exists()) finalRole = 'secretary';

        setResolvedUser({
          id: uid,
          name: profileData?.name || authUser.displayName || 'Usuario',
          email: authUser.email || '',
          role: finalRole,
          avatarUrl: profileData?.avatarUrl || authUser.photoURL || undefined,
          documentId: profileData?.documentId,
          campus: profileData?.campus,
          program: profileData?.program,
          shiftIds: profileData?.shiftIds || []
        } as User);
      } catch (error) {
        console.error("Error resolving institutional user:", error);
      } finally {
        setResolving(false);
      }
    }

    resolveInstitutionalData();
  }, [authUser, db]);

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
    const uid = userCredential.user.uid;
    
    await setDoc(doc(db, 'userProfiles', uid), {
      name,
      email,
      role,
      createdAt: serverTimestamp(),
      documentId: '',
      campus: '',
      program: '',
      shiftIds: []
    });

    if (role !== 'docent') {
      const col = role === 'admin' ? 'roles_admins' : role === 'coordinator' ? 'roles_coordinators' : 'roles_secretaries';
      await setDoc(doc(db, col, uid), {
        email,
        assignedAt: new Date().toISOString()
      });
    }
  };

  const logout = async () => {
    if (!auth) return;
    setResolvedUser(null);
    await signOut(auth);
  };

  const loading = authLoading || (!!authUser && resolving && !resolvedUser);

  return (
    <AuthContext.Provider value={{ 
      user: resolvedUser, 
      login, 
      loginWithEmail, 
      signUpWithEmail, 
      logout, 
      isLoading: loading 
    }}>
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
