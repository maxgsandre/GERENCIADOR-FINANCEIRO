import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { MockAuthProvider, useMockAuth } from './MockAuthContext';
import { isFirebaseConfigured } from '../lib/env';

interface AuthContextType {
  currentUser: any; // User para Firebase, MockUser para modo demo
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}



function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const register = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
    } catch (error: any) {
      console.error('Erro no registro Firebase:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error('Erro no login Firebase:', error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    }, (error) => {
      console.error('Erro na autenticação Firebase:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    login,
    register,
    logout,
    loading,
    isDemo: false
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const mockAuth = useMockAuth();

  const value = {
    currentUser: mockAuth.currentUser,
    login: mockAuth.login,
    register: mockAuth.register,
    logout: mockAuth.logout,
    loading: mockAuth.loading,
    isDemo: true
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const useFirebase = isFirebaseConfigured();

  if (useFirebase) {
    return <FirebaseAuthProvider>{children}</FirebaseAuthProvider>;
  } else {
    return (
      <MockAuthProvider>
        <DemoAuthProvider>{children}</DemoAuthProvider>
      </MockAuthProvider>
    );
  }
}