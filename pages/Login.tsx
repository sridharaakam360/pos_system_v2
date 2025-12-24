import React, { useState } from 'react';
import { UserRole, User } from '../types';
import { Button, Input, Card } from '../components/UI';
import { authApi } from '../src/api/auth';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Signing in...');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setLoadingMessage('Authenticating...');

    try {
      // Basic Validation
      if (!username || !password) {
        setError('Please enter username and password');
        setLoading(false);
        return;
      }

      // Call login API
      console.log('🔍 Logging in user:', username);
      const { token, user } = await authApi.login(username, password);

      // Store token in localStorage
      localStorage.setItem('auth_token', token);

      // Create user object based on role
      const userRole = user.role as UserRole;

      if ((userRole === 'STORE_ADMIN' || userRole === 'CASHIER')) {
        // Store ID must come from the user account in database
        if (!user.storeId) {
          setError('Your account is not assigned to a store. Please contact admin.');
          setLoading(false);
          return;
        }

        const finalUser: User = {
          id: user.id,
          username: user.username,
          role: userRole,
          storeId: user.storeId,
          email: user.email,
          imageUrl: user.imageUrl
        };

        console.log('✅ Login successful! Loading store data...', finalUser);
        setLoadingMessage('Loading store data...');
        await onLogin(finalUser);
      } else {
        // Super Admin
        const finalUser: User = {
          id: user.id,
          username: user.username,
          role: userRole,
          storeId: undefined,
          email: user.email,
          imageUrl: user.imageUrl
        };

        console.log('✅ Login successful! Loading data...', finalUser);
        setLoadingMessage('Loading data...');
        await onLogin(finalUser);
      }

    } catch (err: any) {
      console.error('❌ Login error:', err);
      const errorMessage = err.response?.data?.error || 'Login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-3xl">U</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">UniBill POS</h1>
          <p className="text-slate-500 mt-2">Sign in to your account</p>
        </div>

        <Card className="shadow-xl border-0">
          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              label="Username"
              placeholder="Enter username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full py-3 text-lg shadow-lg shadow-indigo-200"
              disabled={loading}
            >
              {loading ? loadingMessage : 'Sign In'}
            </Button>

            {/* <div className="text-center text-xs text-slate-400 mt-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-blue-700">
                <strong>Test Credentials:</strong><br />
                admin / admin123 (Super Admin)<br />
                cashier / cashier123 (Cashier)
              </div>
            </div> */}
          </form>
        </Card>
      </div>
    </div>
  );
};
