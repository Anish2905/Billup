import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { router } from './routes';
import { AuthGuard } from './features/auth/AuthGuard';
import { useSyncStore } from './store/syncStore';

function App() {
  const initSync = useSyncStore((s) => s.init);

  useEffect(() => {
    initSync();
  }, [initSync]);

  return (
    <AuthGuard>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#18181b',
            color: '#fafafa',
            border: '1px solid #27272a',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#34d399', secondary: '#18181b' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#18181b' },
          },
        }}
      />
    </AuthGuard>
  );
}

export default App;
