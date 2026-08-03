"use client";
import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, QrCode, Hash, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { getUserByPin, getUserByQrCode } from '@/lib/users';
import { savePunch, getTodayPunches } from '@/lib/firestore';
import { useRouter } from 'next/navigation';

type KioskMode = 'idle' | 'pin' | 'qr' | 'success' | 'error';

export default function KioskPage() {
  const router = useRouter();
  const [mode, setMode] = useState<KioskMode>('idle');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [userName, setUserName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [qrInput, setQrInput] = useState('');
  const qrRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mode === 'qr' && qrRef.current) {
      qrRef.current.focus();
    }
  }, [mode]);

  const handlePunch = async (userId: string, name: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayPunches = await getTodayPunches(userId);
      const type = todayPunches.length % 2 === 0 ? 'entry' : 'exit';

      await savePunch({
        userId,
        userName: name,
        type,
        date: today,
      });

      setUserName(name);
      setMessage(type === 'entry' ? `Entrada registrada com sucesso!` : `Saída registrada com sucesso!`);
      setMode('success');
      setTimeout(() => {
        setMode('idle');
        setPin('');
        setQrInput('');
        setMessage('');
        setUserName('');
      }, 3000);
    } catch (err) {
      setMessage('Erro ao registrar ponto. Verifique a conexão.');
      setMode('error');
      setTimeout(() => { setMode('idle'); setPin(''); setQrInput(''); }, 3000);
    }
  };

  const handlePinDigit = async (digit: string) => {
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      const user = getUserByPin(newPin);
      if (user) {
        await handlePunch(user.id, user.name);
      } else {
        setMessage('PIN incorreto.');
        setMode('error');
        setTimeout(() => { setMode('idle'); setPin(''); }, 2000);
      }
    }
  };

  const handleQrSubmit = async (value: string) => {
    const user = getUserByQrCode(value.trim());
    if (user) {
      await handlePunch(user.id, user.name);
    } else {
      setMessage('QR Code não reconhecido.');
      setMode('error');
      setTimeout(() => { setMode('idle'); setQrInput(''); }, 2000);
    }
  };

  const handleQrKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleQrSubmit(qrInput);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      {/* Clock */}
      <div className="text-center mb-8">
        <div className="text-6xl font-mono font-bold text-white tracking-widest">
          {format(currentTime, 'HH:mm:ss')}
        </div>
        <div className="text-slate-400 mt-2 text-lg capitalize">
          {format(currentTime, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-slate-800 rounded-3xl p-8 shadow-2xl">
        {mode === 'idle' && (
          <div className="space-y-4">
            <h2 className="text-white text-center text-xl font-semibold mb-6">Como deseja registrar?</h2>
            <button
              onClick={() => setMode('qr')}
              className="w-full flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-4 transition-colors"
            >
              <QrCode className="w-6 h-6" />
              <span className="font-medium">Ler QR Code</span>
            </button>
            <button
              onClick={() => setMode('pin')}
              className="w-full flex items-center gap-3 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl p-4 transition-colors"
            >
              <Hash className="w-6 h-6" />
              <span className="font-medium">Digitar PIN</span>
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full flex items-center gap-3 text-slate-400 hover:text-slate-300 rounded-2xl p-3 transition-colors justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Voltar ao menu</span>
            </button>
          </div>
        )}

        {mode === 'pin' && (
          <div>
            <h2 className="text-white text-center text-xl font-semibold mb-2">Digite seu PIN</h2>
            <div className="flex justify-center gap-3 mb-6">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full ${i < pin.length ? 'bg-blue-400' : 'bg-slate-600'}`} />
              ))}
            </div>
            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (d === '⌫') setPin(p => p.slice(0, -1));
                    else if (d !== '') handlePinDigit(d);
                  }}
                  disabled={d === ''}
                  className={`h-14 rounded-2xl text-xl font-semibold transition-colors ${
                    d === '' ? 'opacity-0 pointer-events-none' :
                    d === '⌫' ? 'bg-slate-600 hover:bg-slate-500 text-slate-300' :
                    'bg-slate-700 hover:bg-slate-600 text-white active:bg-blue-600'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <button onClick={() => { setMode('idle'); setPin(''); }} className="mt-4 w-full text-slate-400 hover:text-slate-300 text-sm text-center">
              Cancelar
            </button>
          </div>
        )}

        {mode === 'qr' && (
          <div className="text-center">
            <QrCode className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-white text-xl font-semibold mb-2">Aproxime o QR Code</h2>
            <p className="text-slate-400 text-sm mb-4">Use um leitor USB ou câmera. O código será lido automaticamente.</p>
            <input
              ref={qrRef}
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              onKeyDown={handleQrKeyDown}
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Aguardando leitura..."
              autoFocus
            />
            <button onClick={() => { setMode('idle'); setQrInput(''); }} className="mt-4 w-full text-slate-400 hover:text-slate-300 text-sm text-center">
              Cancelar
            </button>
          </div>
        )}

        {mode === 'success' && (
          <div className="text-center py-4">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-white text-2xl font-bold">{userName}</h2>
            <p className="text-green-300 mt-2">{message}</p>
            <p className="text-slate-400 text-sm mt-4">{format(currentTime, 'HH:mm:ss')}</p>
          </div>
        )}

        {mode === 'error' && (
          <div className="text-center py-4">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <p className="text-red-300 text-lg">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
