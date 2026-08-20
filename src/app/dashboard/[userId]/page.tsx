// src/app/dashboard/[userId]/page.tsx -- Linha 1
"use client";

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, TrendingUp, TrendingDown, LogOut, Calendar, QrCode, Lock } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

// Ajuste os imports abaixo dependendo do seu projeto
import { auth, db, functions } from '@/lib/firebase'; 
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { formatMinutes, formatMinutesAbs } from '@/lib/schedule';

export default function DashboardPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();

  const [userData, setUserData] = useState<any>(null);
  const [daySummaries, setDaySummaries] = useState<any[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [todayRecords, setTodayRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPin, setNewPin] = useState("");

  useEffect(() => {
    // SEGURANÇA: Bloqueia o acesso direto pela URL caso o usuário não esteja logado
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        loadData();
      }
    });

    return () => unsubscribe();
  }, [userId, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const getDashboardData = httpsCallable(functions, 'getDashboardData');
      const response = await getDashboardData({ userId });
      
      const data = response.data as any;
      
      setUserData(data.userData);
      setTotalBalance(data.totalBalance);
      setTodayRecords(data.todayRecords);
      setDaySummaries(data.daySummaries);
    } catch (e: any) {
      console.error("Erro ao carregar dados:", e);
      if (e.message.includes("permissão") || e.message.includes("logado")) {
        alert(e.message);
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const handleChangePin = async () => {
    if (newPin.length < 4) return alert("O PIN deve conter pelo menos 4 caracteres.");
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { pin: newPin });
      alert("Seu PIN foi alterado com sucesso!");
      setNewPin("");
    } catch (e) {
      alert("Erro ao alterar o PIN.");
    }
  };

  const handleDownloadQrCode = () => {
    const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `Cracha_QRCode_${userData.name.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  const handleOpenHistory = () => {
    router.push(`/historico`);
  };

  if (loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Carregando painel...</div>;
  if (!userData) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Acesso Negado ou Usuário Inexistente.</div>;

  const isPositive = totalBalance >= 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-10">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">
              {userData.name ? userData.name[0] : 'U'}
            </div>
            <div>
              <h1 className="font-semibold">{userData.name}</h1>
              <p className="text-slate-400 text-xs">Estagiário</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenHistory}
              className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm"
            >
              <Calendar className="w-4 h-4" />
              Histórico
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* Painel de Horas */}
        <div className={`rounded-2xl p-6 ${
          isPositive ? 'bg-green-900/30 border border-green-700/30' : 'bg-red-900/30 border border-red-700/30'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            {isPositive
              ? <TrendingUp className="w-6 h-6 text-green-400" />
              : <TrendingDown className="w-6 h-6 text-red-400" />}
            <h2 className="font-semibold text-lg">Banco de Horas</h2>
          </div>
          <div className={`text-4xl font-bold font-mono ${
            isPositive ? 'text-green-400' : 'text-red-400'
          }`}>
            {formatMinutes(totalBalance)}
          </div>
        </div>

        {/* Controles: Crachá e Segurança */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 flex flex-col items-center justify-between">
            <div className="flex flex-col items-center w-full">
              <div className="flex items-center gap-2 mb-4 w-full">
                <QrCode className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold">Crachá / QR Code</h3>
              </div>
              <div className="bg-white p-2 rounded-lg mb-4">
                <QRCodeCanvas 
                  id="qr-code-canvas" 
                  value={userData.qrCode || "Sem-QR-Code"} 
                  size={140} 
                  level={"H"} 
                />
              </div>
            </div>
            <button 
              onClick={handleDownloadQrCode}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition"
            >
              Baixar Imagem
            </button>
          </div>

          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold">Pin para bater ponto</h3>
              </div>
              <p className="text-sm text-slate-400 mb-4">Atualize a senha (PIN) que você utiliza no totem físico.</p>
              
              <input 
                type="password" 
                placeholder="Digite o novo PIN" 
                value={newPin} 
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 mb-4"
              />
            </div>
            <button 
              onClick={handleChangePin}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium transition"
            >
              Salvar Novo PIN
            </button>
          </div>
        </div>

        {/* Registros de Hoje */}
        {todayRecords.length > 0 && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Registros de Hoje
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {todayRecords.map((r, i) => (
                <div key={r.id || i} className={`rounded-xl px-3 py-2 text-sm ${
                  r.type === 'entry' ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                }`}>
                  <span className="font-medium">{r.type === 'entry' ? '▶ Entrada' : '◼ Saída'}</span>
                  <span className="ml-2">{format(parseISO(r.timestamp), 'HH:mm')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold">Histórico de Dias</h3>
          </div>
          
          <div className="divide-y divide-slate-700">
            {daySummaries.slice(0, 20).map(day => (
              <div key={day.dateStr} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm capitalize">
                    {format(parseISO(day.date), "EEE, dd/MM", { locale: ptBR })}
                  </div>
                  <div className="text-slate-400 text-xs">
                    {day.expected > 0 ? `Esperado: ${formatMinutesAbs(day.expected)}` : 'Sem expediente'}
                  </div>
                </div>
                <div className="text-right">
                  {day.expected > 0 ? (
                    <>
                      <div className="text-sm">{formatMinutesAbs(day.worked)} trabalhadas</div>
                      <div className={`text-xs font-mono ${
                        day.balance >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatMinutes(day.balance)}
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-500 text-xs">—</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
