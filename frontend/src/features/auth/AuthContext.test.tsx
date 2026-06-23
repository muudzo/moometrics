import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('@/services/api', async (importActual) => {
  const actual = await importActual<typeof import('@/services/api')>();
  return {
    ...actual,
    restoreSession: vi.fn(),
    apiFetch: vi.fn(),
    setAccessToken: vi.fn(),
  };
});

import { restoreSession, apiFetch } from '@/services/api';
import { AuthProvider, useAuth } from '@/features/auth/context/AuthContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const mockedRestore = restoreSession as unknown as ReturnType<typeof vi.fn>;
const mockedApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedRestore.mockReset();
  mockedApiFetch.mockReset();
});

describe('AuthContext', () => {
  it('finishes bootstrap unauthenticated when there is no session', async () => {
    mockedRestore.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('restores the session from the refresh cookie on load', async () => {
    mockedRestore.mockResolvedValue({
      access_token: 't',
      role: 'manager',
      user_id: 7,
      username: 'boss',
      farm_id: 3,
      farm_name: 'Acme',
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user).toMatchObject({ farmId: 3, farmName: 'Acme', role: 'manager' });
  });

  it('logs in and exposes farm context', async () => {
    mockedRestore.mockResolvedValue(null);
    mockedApiFetch.mockResolvedValue({
      access_token: 't',
      role: 'employee',
      user_id: 9,
      username: 'hand',
      farm_id: 5,
      farm_name: 'Green',
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    await act(async () => {
      await result.current.login('hand', 'Passw0rd1');
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.farmName).toBe('Green');
  });
});
