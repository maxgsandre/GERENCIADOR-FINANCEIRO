import React, { useState } from 'react';
import Login from './Login';
import Register from './Register';

export default function AuthWrapper() {
  const [isLogin, setIsLogin] = useState(true);

  return isLogin ? (
    <Login onToggleMode={() => setIsLogin(false)} />
  ) : (
    <Register onToggleMode={() => setIsLogin(true)} />
  );
}