// Utilitário para acessar variáveis de ambiente de forma segura
export const getEnvVar = (key: string, fallback: string = ''): string => {
  try {
    return (import.meta?.env && import.meta.env[key]) || fallback;
  } catch {
    return fallback;
  }
};

// Função para verificar se está em modo desenvolvimento
export const isDevelopment = (): boolean => {
  return getEnvVar('NODE_ENV', 'development') === 'development';
};

// Função para verificar se Firebase está configurado corretamente
export const isFirebaseConfigured = (): boolean => {
  const apiKey = getEnvVar('VITE_FIREBASE_API_KEY', 'demo-api-key-for-development');
  return apiKey && apiKey !== 'demo-api-key-for-development';
};

// Função para verificar se está em modo demo
export const isDemoMode = (): boolean => {
  return !isFirebaseConfigured();
};