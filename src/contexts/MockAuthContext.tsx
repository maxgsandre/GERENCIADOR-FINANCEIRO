import React, { createContext, useContext, useEffect, useState } from 'react';

interface MockUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface MockAuthContextType {
  currentUser: MockUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const MockAuthContext = createContext<MockAuthContextType | null>(null);

export function useMockAuth() {
  const context = useContext(MockAuthContext);
  if (!context) {
    throw new Error('useMockAuth must be used within a MockAuthProvider');
  }
  return context;
}

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Simular autenticação
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // Verificar se há usuário salvo no localStorage
        const savedUser = localStorage.getItem('mock_user');
        if (savedUser) {
          const user = JSON.parse(savedUser);
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Erro ao carregar usuário salvo:', error);
        localStorage.removeItem('mock_user');
      }
      setLoading(false);
    }, 500); // Reduzir delay para melhor UX

    return () => clearTimeout(timer);
  }, []);

  const register = async (email: string, password: string, name: string) => {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // Verificar se email já existe
      const existingUsers = JSON.parse(localStorage.getItem('mock_users') || '[]');
      if (existingUsers.some((user: any) => user.email === email)) {
        const error = new Error('Email já está em uso');
        (error as any).code = 'auth/email-already-in-use';
        throw error;
      }

      const newUser: MockUser = {
        uid: `user_${Date.now()}`,
        email,
        displayName: name
      };

      // Salvar usuário
      existingUsers.push({ ...newUser, password });
      localStorage.setItem('mock_users', JSON.stringify(existingUsers));
      localStorage.setItem('mock_user', JSON.stringify(newUser));
      
      setCurrentUser(newUser);
    } catch (error) {
      console.error('Erro no registro mock:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const existingUsers = JSON.parse(localStorage.getItem('mock_users') || '[]');
      const user = existingUsers.find((u: any) => u.email === email && u.password === password);
      
      if (!user) {
        // Verificar se é um usuário demo padrão
        if (email === 'demo@teste.com' && password === 'demo123') {
          const demoUser: MockUser = {
            uid: 'demo_user',
            email: 'demo@teste.com',
            displayName: 'Usuário Demo'
          };
          
          localStorage.setItem('mock_user', JSON.stringify(demoUser));
          setCurrentUser(demoUser);
          return;
        }
        
        const error = new Error('Email ou senha incorretos');
        (error as any).code = 'auth/wrong-password';
        throw error;
      }

      const mockUser: MockUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      };

      localStorage.setItem('mock_user', JSON.stringify(mockUser));
      setCurrentUser(mockUser);
    } catch (error) {
      console.error('Erro no login mock:', error);
      throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem('mock_user');
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    login,
    register,
    logout,
    loading
  };

  return (
    <MockAuthContext.Provider value={value}>
      {!loading && children}
    </MockAuthContext.Provider>
  );
}