import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Para desenvolvimento com emuladores (opcional)
try {
  const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
  const isDevelopment = import.meta.env.DEV;
  
  if (isDevelopment && useEmulator) {
    // 127.0.0.1 em vez de localhost: em algumas maquinas Windows o nome resolve
    // apenas para ::1, e o emulador escuta so em IPv4 -- a conexao falharia.
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
} catch (error) {
  // Silenciar detalhes para evitar exposição de dados sensíveis
  console.log('Firebase emulators connection skipped');
}

export default app;