import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PawPrint } from 'lucide-react';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);

  const { login, isLoading, error } = useAuth();

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirm('');
    setSignupError(null);
  };

  const switchMode = (next: 'login' | 'signup') => {
    resetForm();
    setMode(next);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    await login(username.trim(), password);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    if (password !== confirm) {
      setSignupError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setSignupError('Password must be at least 6 characters');
      return;
    }

    setSignupLoading(true);
    try {
      await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      // After signup, log in automatically
      await login(username.trim(), password);
    } catch (err) {
      setSignupError(err instanceof ApiError ? err.message : 'Sign up failed');
    } finally {
      setSignupLoading(false);
    }
  };

  const isSignup = mode === 'signup';

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4">
            <PawPrint className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">MooMetrics</CardTitle>
          <CardDescription>
            {isSignup
              ? 'Create an employee account'
              : 'Sign in to manage your farm records'}
          </CardDescription>
        </CardHeader>

        <form onSubmit={isSignup ? handleSignup : handleLogin}>
          <CardContent className="space-y-4">
            {/* Error display */}
            {(isSignup ? signupError : error) && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {isSignup ? signupError : error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder={isSignup ? 'Choose a username' : 'admin'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            </div>

            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            )}

            {isSignup && (
              <p className="text-xs text-muted-foreground">
                New accounts are created as <span className="font-medium">employee</span> role.
                Contact your manager to be assigned a manager role.
              </p>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button
              className="w-full"
              type="submit"
              disabled={isSignup ? signupLoading : isLoading}
            >
              {isSignup
                ? signupLoading ? 'Creating account...' : 'Create Account'
                : isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              {isSignup ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={() => switchMode('login')}
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={() => switchMode('signup')}
                  >
                    Sign up
                  </button>
                </>
              )}
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
