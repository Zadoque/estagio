"use client";
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { getUserByCredentials } from '@/lib/users';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'estagiario';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const user = getUserByCredentials(email, password);
    if (!user) {
      setError('Email ou senha incorretos.');
      setLoading(false);
      return;
    }
    if (role === 'supervisor' && user.role !== 'supervisor') {
      setError('Acesso não autorizado para esta área.');
      setLoading(false);
      return;
    }
    if (role === 'estagiario' && user.role !== 'estagiario') {
      setError('Use o acesso de Supervisora.');
      setLoading(false);
      return;
    }

    // Store session
    sessionStorage.setItem('currentUser', JSON.stringify({ id: user.id, name: user.name, role: user.role }));

    if (user.role === 'supervisor') {
      router.push('/supervisor');
    } else {
      router.push(`/dashboard/${user.id}`);
    }
  };

  const isSupervisor = role === 'supervisor';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${
            isSupervisor ? 'bg-purple-500/20' : 'bg-blue-500/20'
          }`}>
            <Clock className={`w-8 h-8 ${isSupervisor ? 'text-purple-400' : 'text-blue-400'}`} />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isSupervisor ? 'Acesso Supervisora' : 'Acesso Estagiário'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">Controle de Ponto</p>
        </div>

        <form onSubmit={handleLogin} className="bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-700 space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-600"
              placeholder="seu@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-600"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-colors ${
              isSupervisor
                ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800'
            }`}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-300 text-sm py-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <LoginForm />
    </Suspense>
  );
}
