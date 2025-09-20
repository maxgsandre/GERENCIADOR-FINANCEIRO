import React, { useMemo, useState } from 'react';
import Login from './Login';
import Register from './Register';
import ResetPassword from './ResetPassword';

export default function AuthWrapper() {
  const [isLogin, setIsLogin] = useState(true);
  const mode = useMemo(() => new URLSearchParams(window.location.search).get('mode'), []);

  if (mode === 'resetPassword') {
    return <ResetPassword />;
  }

  return isLogin ? (
    <Login onToggleMode={() => setIsLogin(false)} />
  ) : (
    <Register onToggleMode={() => setIsLogin(true)} />
  );
}