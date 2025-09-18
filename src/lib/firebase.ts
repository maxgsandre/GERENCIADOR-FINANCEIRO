import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getEnvVar, isDevelopment } from './env';

// Configuração do Firebase
// Para usar configurações reais, substitua pelos valores do seu projeto Firebase
const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', 'demo-api-key-for-development'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', 'demo-project.firebaseapp.com'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', 'demo-project'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', 'demo-project.appspot.com'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', '123456789'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', '1:123456789:web:abcdef123456')
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Para desenvolvimento com emuladores (opcional)
try {
  const useEmulator = getEnvVar('VITE_USE_FIREBASE_EMULATOR', 'false') === 'true';
  
  if (isDevelopment() && useEmulator) {
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectFirestoreEmulator(db, 'localhost', 8080);
  }
} catch (error) {
  console.log('Firebase emulators connection skipped:', error);
}

export default app;