import React, { useMemo, useState } from 'react';
import Login from './Login';
import Register from './Register';
import ResetPassword from './ResetPassword';
import FinalizePassword from './FinalizePassword';

export default function AuthWrapper() {
  const [isLogin, setIsLogin] = useState(true);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const mode = params.get('mode');
  
  // Verifica se é um link do Firebase (pode ter oobCode mesmo sem mode)
  const hasFirebaseLink = params.has('oobCode') || params.has('apiKey');
  
  // Se tiver email salvo no localStorage e for um link do Firebase, provavelmente é finalização
  const hasSignupEmail = typeof window !== 'undefined' && localStorage.getItem('signup_email');

  if (mode === 'resetPassword') {
    return <ResetPassword />;
  }

  if (mode === 'finalizeSignUp' || (hasFirebaseLink && hasSignupEmail)) {
    return <FinalizePassword />;
  }

  return isLogin ? (
    <Login onToggleMode={() => setIsLogin(false)} />
  ) : (
    <Register onToggleMode={() => setIsLogin(true)} />
  );
}