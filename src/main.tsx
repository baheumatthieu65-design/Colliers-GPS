import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthScreen } from './components/AuthScreen';
import { supabase } from './lib/supabase';
import './index.css';

function AuthGate() {
  const [loading, setLoading] = useState(true);
  const [sessionExists, setSessionExists] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSessionExists(Boolean(data.session));
      setLoading(false);
    };

    void loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        setSessionExists(true);
        return;
      }

      setSessionExists(Boolean(session));

      if (event === 'SIGNED_OUT') {
        setRecoveryMode(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F4F1] flex items-center justify-center">
        <img src="/icon.svg" alt="Pâtur'GPS" className="w-20 h-20 object-contain animate-pulse" />
      </div>
    );
  }

  if (!sessionExists || recoveryMode) {
    return (
      <AuthScreen
        recoveryMode={recoveryMode}
        onRecoveryComplete={() => setRecoveryMode(false)}
      />
    );
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);
