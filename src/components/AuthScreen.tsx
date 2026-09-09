import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole, Mail, LogIn, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AuthScreenProps = {
  recoveryMode?: boolean;
  onRecoveryComplete?: () => void;
};

export function AuthScreen({ recoveryMode = false, onRecoveryComplete }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (recoveryMode) {
      setShowReset(false);
      setMessage('');
      setError('');
    }
  }, [recoveryMode]);

  const clearFeedback = () => {
    setMessage('');
    setError('');
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    clearFeedback();
    setBusy(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (loginError) {
      setError('E-mail ou mot de passe incorrect.');
    }
  };

  const handleResetRequest = async (event: FormEvent) => {
    event.preventDefault();
    clearFeedback();
    setBusy(true);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Renseigne ton adresse e-mail.');
      setBusy(false);
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin,
    });

    setBusy(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage('E-mail de réinitialisation envoyé. Vérifie ta boîte mail.');
  };

  const handlePasswordUpdate = async (event: FormEvent) => {
    event.preventDefault();
    clearFeedback();

    if (newPassword.length < 6) {
      setError('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNewPassword('');
    setMessage('Mot de passe modifié. Tu peux maintenant utiliser Pâtur’GPS.');
    onRecoveryComplete?.();
  };

  const logo = (
    <img
      src="/icon.svg"
      alt="Pâtur'GPS"
      className="w-24 h-24 object-contain mx-auto mb-5"
    />
  );

  if (recoveryMode) {
    return (
      <div className="min-h-screen bg-[#F2F4F1] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-[#DCE2D8] p-7">
          {logo}
          <h1 className="text-2xl font-bold text-center text-[#2C3327]">Nouveau mot de passe</h1>
          <p className="text-sm text-center text-[#697064] mt-2 mb-6">
            Choisis ton nouveau mot de passe.
          </p>

          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8473]" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nouveau mot de passe"
                autoComplete="new-password"
                className="w-full rounded-xl border border-[#D6DDD1] bg-[#FAFBF9] py-3 pl-10 pr-3 outline-none focus:border-[#5A6F4E] focus:ring-2 focus:ring-[#5A6F4E]/10"
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && (
              <p className="text-sm text-[#4D613F] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#5A6F4E] text-white py-3 font-semibold disabled:opacity-60"
            >
              {busy ? 'Enregistrement…' : 'Modifier le mot de passe'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (showReset) {
    return (
      <div className="min-h-screen bg-[#F2F4F1] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-[#DCE2D8] p-7">
          {logo}
          <h1 className="text-2xl font-bold text-center text-[#2C3327]">Mot de passe oublié</h1>
          <p className="text-sm text-center text-[#697064] mt-2 mb-6">
            Nous t'envoyons un lien sur ton adresse e-mail.
          </p>

          <form onSubmit={handleResetRequest} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8473]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                autoComplete="email"
                className="w-full rounded-xl border border-[#D6DDD1] bg-[#FAFBF9] py-3 pl-10 pr-3 outline-none focus:border-[#5A6F4E] focus:ring-2 focus:ring-[#5A6F4E]/10"
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && (
              <p className="text-sm text-[#4D613F] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#5A6F4E] text-white py-3 font-semibold disabled:opacity-60"
            >
              {busy ? 'Envoi…' : 'Envoyer le lien'}
            </button>

            <button
              type="button"
              onClick={() => {
                clearFeedback();
                setShowReset(false);
              }}
              className="w-full flex items-center justify-center gap-2 text-sm text-[#5A6F4E] py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F4F1] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-[#DCE2D8] p-7">
        {logo}
        <h1 className="text-2xl font-bold text-center text-[#2C3327]">Pâtur’GPS</h1>
        <p className="text-sm text-center text-[#697064] mt-1 mb-6">Suivi des colliers de brebis</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8473]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              autoComplete="email"
              className="w-full rounded-xl border border-[#D6DDD1] bg-[#FAFBF9] py-3 pl-10 pr-3 outline-none focus:border-[#5A6F4E] focus:ring-2 focus:ring-[#5A6F4E]/10"
              required
            />
          </div>

          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8473]" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              autoComplete="current-password"
              className="w-full rounded-xl border border-[#D6DDD1] bg-[#FAFBF9] py-3 pl-10 pr-3 outline-none focus:border-[#5A6F4E] focus:ring-2 focus:ring-[#5A6F4E]/10"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#5A6F4E] text-white py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>

          <button
            type="button"
            onClick={() => {
              clearFeedback();
              setShowReset(true);
            }}
            className="w-full text-sm text-[#5A6F4E] py-1"
          >
            Mot de passe oublié ?
          </button>
        </form>
      </div>
    </div>
  );
}
