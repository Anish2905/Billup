/**
 * Auth Guard
 * Wraps protected routes — shows PinLockScreen if not authenticated
 */

import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { PinLockScreen } from './PinLockScreen';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (!isAuthenticated) {
    return <PinLockScreen />;
  }

  return <>{children}</>;
}
