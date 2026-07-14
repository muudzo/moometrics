import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/services/api', async (importActual) => {
  const actual = await importActual<typeof import('@/services/api')>();
  return { ...actual, restoreSession: vi.fn().mockResolvedValue(null), apiFetch: vi.fn() };
});

import { AuthProvider } from '@/features/auth/context/AuthContext';
import { Login } from '@/features/auth/components/Login';

beforeEach(() => {
  // jsdom doesn't implement these scroll/resize APIs Radix touches.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

function renderLogin() {
  return render(
    <AuthProvider>
      <Login />
    </AuthProvider>
  );
}

describe('Login', () => {
  it('renders the sign-in form by default', () => {
    renderLogin();
    expect(
      screen.getByText('Farm management software — sign in to manage your records')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });

  it('reveals the farm-name field when switching to sign-up', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    await waitFor(() => expect(screen.getByLabelText('Farm Name')).toBeTruthy());
    expect(screen.getByText('Create your farm account')).toBeTruthy();
  });
});
