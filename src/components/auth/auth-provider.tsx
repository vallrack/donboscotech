
"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '@/lib/types';
import { useAuth as useFirebaseAuth, useUser, useFirestore } from '@/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useUser();
  const [resolvedUser, setResolvedUser] = useState<User | null>(null);
  const [resolving, setResolving] = useState(false);

  const logout = useCallback(async () => {
    if (!auth) return;
    setResolvedUser(null);
    await signOut(auth);
  }, [auth]);

  // CONTROL DE INACTIVIDAD: Cierre de sesión automático tras 2 minutos (120000ms)
  useEffect(() => {
    if (!resolvedUser || !auth) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        logout();
        toast({
          variant: "destructive",
          title: "Sesión Expirada",
          description: "Se ha cerrado la sesión por inactividad (2 min) para proteger tus datos.",
        });
      }, 120000); 
    };

    const activityEvents = [
      'mousedown', 
      'mousemove', 
      'keypress', 
      'scroll', 
      'touchstart', 
      'click'
    ];

    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [resolvedUser, logout, toast, auth]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    async function setupAuth() {
      if (!authUser || !db) {
        setResolvedUser(null);
        setResolving(false);
        return;
      }

      setResolving(true);
      const uid = authUser.uid;
      const profileRef = doc(db, 'userProfiles', uid);

      unsubscribeProfile = onSnapshot(profileRef, async (docSnap) => {
        if (docSnap.exists()) {
          const profileData = docSnap.data();
          
          const [adminSnap, coordSnap, sectSnap] = await Promise.all([
            getDoc(doc(db, 'roles_admins', uid)),
            getDoc(doc(db, 'roles_coordinators', uid)),
            getDoc(doc(db, 'roles_secretaries', uid))
          ]);

          let finalRole: UserRole = (profileData.role as UserRole) || 'docent';
          if (adminSnap.exists()) finalRole = 'admin';
          else if (coordSnap.exists()) finalRole = 'coordinator';
          else if (sectSnap.exists()) finalRole = 'secretary';

          setResolvedUser({
            id: uid,
            name: profileData.name || authUser.displayName || 'Miembro Institucional',
            email: authUser.email || profileData.email || '',
            role: finalRole,
            avatarUrl: profileData.avatarUrl || authUser.photoURL || undefined,
            signatureUrl: profileData.signatureUrl || undefined,
            documentId: profileData.documentId || '',
            campus: profileData.campus || '',
            program: profileData.program || '',
            shiftIds: profileData.shiftIds || []
          } as User);
          setResolving(false);
        } else {
          const initialData = {
            name: authUser.displayName || authUser.email?.split('@')[0] || 'Nuevo Miembro',
            email: authUser.email || '',
            role: 'docent',
            createdAt: serverTimestamp(),
            documentId: '',
            campus: '',
            program: '',
            shiftIds: [],
            status: 'active'
          };
          await setDoc(profileRef, initialData);
        }
      }, (error) => {
        setResolving(false);
      });
    }

    setupAuth();

    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
    };
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
      shiftIds: [],
      status: 'active'
    });

    if (role !== 'docent') {
      const col = role === 'admin' ? 'roles_admins' : role === 'coordinator' ? 'roles_coordinators' : 'roles_secretaries';
      await setDoc(doc(db, col, uid), {
        email,
        assignedAt: new Date().toISOString()
      });
    }
  };

  const loading = authLoading || resolving;

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
}
