/**
 * PIN Lock Screen
 * Full-screen overlay with 4-dot PIN input, numeric keypad, lockout logic
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore, enablePersistence, disablePersistence } from '../../store/authStore';
import { Lock, Fingerprint, ShieldAlert } from 'lucide-react';
import { APP_NAME } from '../../lib/constants';

export function PinLockScreen() {
  const { verify, isLoading, failedAttempts, lockedUntil, getRemainingLockout } = useAuthStore();
  const [pin, setPin] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lockout countdown
  useEffect(() => {
    if (!lockedUntil) {
      setLockRemaining(0);
      return;
    }
    const interval = setInterval(() => {
      const remaining = getRemainingLockout();
      setLockRemaining(remaining);
      if (remaining <= 0) {
        setError('');
      }
    }, 100);
    return () => clearInterval(interval);
  }, [lockedUntil, getRemainingLockout]);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit(pin.join(''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const handleSubmit = async (pinStr: string) => {
    const success = await verify(pinStr);
    if (success) {
      if (rememberMe) {
        enablePersistence();
      } else {
        disablePersistence();
      }
    } else {
      setShake(true);
      setError('Incorrect PIN');
      setTimeout(() => {
        setShake(false);
        setPin([]);
      }, 500);
    }
  };

  const handleDigit = useCallback((digit: string) => {
    if (lockRemaining > 0) return;
    setError('');
    setPin((prev) => (prev.length < 4 ? [...prev, digit] : prev));
  }, [lockRemaining]);

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  }, []);

  const handleClear = useCallback(() => {
    setPin([]);
    setError('');
  }, []);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockRemaining > 0) return;
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleBackspace, handleClear, lockRemaining]);

  const isLocked = lockRemaining > 0;

  return (
    <div className="fixed inset-0 bg-surface-0 flex items-center justify-center z-[100]">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-surface-0 via-surface-0 to-brand-950/20" />
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div
        ref={containerRef}
        className={`relative z-10 flex flex-col items-center gap-8 ${shake ? 'animate-shake' : ''}`}
      >
        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
            {isLocked ? (
              <ShieldAlert className="w-8 h-8 text-red-400" />
            ) : (
              <Fingerprint className="w-8 h-8 text-brand-400" />
            )}
          </div>
          <h1 className="text-xl font-bold text-surface-800">{APP_NAME}</h1>
          <p className="text-surface-400 text-sm">
            {isLocked ? 'Account locked' : 'Enter your PIN to continue'}
          </p>
        </div>

        {/* PIN Dots */}
        <div className="flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200
                ${pin.length > i
                  ? 'bg-brand-400 border-brand-400 scale-110'
                  : 'bg-transparent border-surface-300'
                }
                ${error && pin.length === 0 ? 'border-red-400' : ''}
              `}
            />
          ))}
        </div>

        {/* Error / Lockout message */}
        {(error || isLocked) && (
          <div className="text-center animate-fade-in">
            {isLocked ? (
              <p className="text-red-400 text-sm font-medium">
                Too many attempts. Try again in {Math.ceil(lockRemaining / 1000)}s
              </p>
            ) : (
              <p className="text-red-400 text-sm font-medium">{error}</p>
            )}
            {failedAttempts > 0 && !isLocked && (
              <p className="text-surface-400 text-xs mt-1">
                {5 - failedAttempts} attempts remaining
              </p>
            )}
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-4 md:gap-3 w-[260px] md:w-[220px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '←'].map((key) => {
            if (key === '') return <div key="empty" />;
            
            const isBackspace = key === '←';
            
            return (
              <button
                key={key}
                onClick={() => isBackspace ? handleBackspace() : handleDigit(key)}
                disabled={isLoading || isLocked}
                className={`w-full aspect-square rounded-2xl text-2xl md:text-xl font-display font-medium
                  transition-all duration-150 active:scale-95
                  ${isBackspace
                    ? 'bg-transparent text-surface-400 hover:bg-surface-200'
                    : 'bg-surface-100 border-b-2 border-surface-200 text-surface-900 hover:bg-surface-200'
                  }
                  disabled:opacity-30 disabled:cursor-not-allowed
                `}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* Remember me */}
        <label className="flex items-center gap-2 text-sm text-surface-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-surface-300 bg-surface-50 
                       text-brand-500 focus:ring-brand-500/30"
          />
          Remember for 7 days
        </label>

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-0/50 rounded-3xl">
            <Lock className="w-6 h-6 text-brand-400 animate-spin-slow" />
          </div>
        )}
      </div>
    </div>
  );
}
