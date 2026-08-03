"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Shield, LogOut, Users, Clock, RefreshCw } from 'lucide-react';
import { USERS } from '@/lib/users';
import { getAllPunches } from '@/lib/firestore';
import {
  calculateDailyMinutes,
  getDayExpectedMinutes,
  formatMinutes,
  formatMinutesAbs,
  type PunchRecord,
} from '@/lib/schedule';

interface UserStatus {
  userId: string;
  name: string;
  isPresent: boolean;
  todayWorked: number;
  todayExpected: number;
  weekBalance: number;
  lastPunch?: Date;
}

export default function SupervisorPage() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<UserStatus[]>([]);
  const [recentPunches, setRecentPunches] = useState<PunchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const session = sessionStorage.getItem('currentUser');
    if (!session) { router.push('/login?role=supervisor'); return; }
    const s = JSON.parse(session);
    if (s.role !== 'supervisor') { router.push('/login?role=supervisor'); return; }
    loadData();
    const interval = setInterval(loadData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

      const allPunches = await getAllPunches();
      const todayPunches = allPunches.filter(p => p.date === today);
      const weekPunches = allPunches.filter(p => p.date >= weekStart && p.date <= weekEnd);

      const estagiarios = USERS.filter(u => u.role === 'estagiario');
      const statuses: UserStatus[] = estagiarios.map(user => {
        const userTodayPunches = todayPunches.filter(p => p.userId === user.id);
        const userWeekPunches = weekPunches.filter(p => p.userId === user.id);

        const todayWorked = calculateDailyMinutes(userTodayPunches);
        const todayExpected = getDayExpectedMinutes(now);
        const isPresent = userTodayPunches.length % 2 === 1; // odd = checked in

        // Calculate week balance
        const uniqueDays = [...new Set(userWeekPunches.map(p => p.date))];
        let weekWorked = 0;
        let weekExpected = 0;
        for (const day of uniqueDays) {
          const dayPunches = userWeekPunches.filter(p => p.date === day);
          const dayDate = new Date(day + 'T12:00:00');
          weekWorked += calculateDailyMinutes(dayPunches);
          weekExpected += getDayExpectedMinutes(dayDate);
        }

        const lastPunch = userTodayPunches.length > 0
          ? userTodayPunches[userTodayPunches.length - 1].timestamp
          : undefined;

        return {
          userId: user.id,
          name: user.name,
          isPresent,
          todayWorked,
          todayExpected,
          weekBalance: weekWorked - weekExpected,
          lastPunch,
        };
      });

      setStatuses(statuses);

      // Recent punches (last 20)
      const recent = [...allPunches].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 20);
      setRecentPunches(recent);
      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold">Painel da Supervisora</h1>
              <p className="text-slate-400 text-xs">Marília</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        <p className="text-slate-500 text-xs">Atualizado: {format(lastUpdate, 'HH:mm:ss')}</p>

        {/* Presence Cards */}
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-lg mb-3">
            <Users className="w-5 h-5 text-purple-400" />
            Presença Atual
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {statuses.map(s => (
              <div key={s.userId} className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold">
                      {s.name[0]}
                    </div>
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-slate-400 text-xs">Estagiário</div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    s.isPresent ? 'bg-green-900/50 text-green-300' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {s.isPresent ? '● Presente' : '○ Ausente'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <div className="text-slate-400 text-xs mb-1">Hoje</div>
                    <div className="font-mono">{formatMinutesAbs(s.todayWorked)}</div>
                  </div>
                  <div className={`rounded-xl p-3 ${
                    s.weekBalance >= 0 ? 'bg-green-900/20' : 'bg-red-900/20'
                  }`}>
                    <div className="text-slate-400 text-xs mb-1">Banco (semana)</div>
                    <div className={`font-mono ${
                      s.weekBalance >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>{formatMinutes(s.weekBalance)}</div>
                  </div>
                </div>
                {s.lastPunch && (
                  <p className="text-slate-500 text-xs mt-2">
                    Último ponto: {format(s.lastPunch, 'HH:mm')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Punches */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold">Registros Recentes</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Carregando...</div>
          ) : (
            <div className="divide-y divide-slate-700">
              {recentPunches.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-sm">Nenhum registro encontrado.</div>
              )}
              {recentPunches.map(p => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${
                      p.type === 'entry' ? 'bg-green-400' : 'bg-red-400'
                    }`} />
                    <div>
                      <div className="font-medium text-sm">{getUserById(p.userId)?.name ?? p.userId}</div>
                      <div className="text-slate-400 text-xs">
                        {format(p.date ? new Date(p.date + 'T00:00:00') : p.timestamp, 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm ${
                      p.type === 'entry' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {p.type === 'entry' ? '▶ Entrada' : '◼ Saída'}
                    </div>
                    <div className="text-slate-400 text-xs">{format(p.timestamp, 'HH:mm')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function getUserById(id: string) {
  const { USERS } = require('@/lib/users');
  return USERS.find((u: any) => u.id === id);
}
