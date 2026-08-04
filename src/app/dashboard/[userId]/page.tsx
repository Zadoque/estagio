"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, TrendingUp, TrendingDown, LogOut, Calendar, CheckCircle } from 'lucide-react';
import { getUserById } from '@/lib/users';
import { getPunchesForUser } from '@/lib/firestore';
import {
  calculateDailyMinutes,
  getDayExpectedMinutes,
  formatMinutes,
  formatMinutesAbs,
  getWeeklyExpectedMinutes,
  DAY_NAMES,
  type PunchRecord,
} from '@/lib/schedule';

interface DaySummary {
  date: Date;
  dateStr: string;
  expected: number;
  worked: number;
  balance: number;
  records: PunchRecord[];
}

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const user = getUserById(userId);

  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [todayRecords, setTodayRecords] = useState<PunchRecord[]>([]);

  useEffect(() => {
    const session = sessionStorage.getItem('currentUser');
    if (!session) { router.push('/login?role=estagiario'); return; }
    const s = JSON.parse(session);
    if (s.id !== userId) { router.push('/login?role=estagiario'); return; }
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();

      // Data de inicio do estagio deste usuario (nunca contar dias anteriores a ela)
      const internshipStart = user?.startDate
        ? parseISO(user.startDate + 'T00:00:00')
        : startOfWeek(subWeeks(now, 3), { weekStartsOn: 1 });

      const fourWeeksAgo = startOfWeek(subWeeks(now, 3), { weekStartsOn: 1 });
      // O inicio do periodo analisado eh o mais recente entre "4 semanas atras" e o inicio do estagio
      const weekStart = isBefore(fourWeeksAgo, internshipStart) ? internshipStart : fourWeeksAgo;
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      const startStr = format(weekStart, 'yyyy-MM-dd');
      const endStr = format(weekEnd, 'yyyy-MM-dd');

      const allRecords = await getPunchesForUser(userId, startStr, endStr);
      const today = format(now, 'yyyy-MM-dd');
      const todayRecs = allRecords.filter(r => r.date === today);
      setTodayRecords(todayRecs);

      // Build day summaries apenas a partir do inicio do estagio
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const summaries: DaySummary[] = [];
      let balance = 0;

      for (const day of days) {
        // Nunca contar dias anteriores ao inicio do estagio
        if (isBefore(day, internshipStart)) continue;

        const dayName = DAY_NAMES[day.getDay()];
        if (['saturday', 'sunday'].includes(dayName)) continue;
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayRecords = allRecords.filter(r => r.date === dateStr);
        const expected = getDayExpectedMinutes(day);
        const worked = calculateDailyMinutes(dayRecords);
        const dayBalance = worked - expected;
        // Only count past days (not future)
        if (day <= now) balance += dayBalance;
        summaries.push({ date: day, dateStr, expected, worked, balance: dayBalance, records: dayRecords });
      }

      setDaySummaries(summaries.reverse());
      setTotalBalance(balance);
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

  if (!user) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Usuário não encontrado.</div>;

  const isPositive = totalBalance >= 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">
              {user.name[0]}
            </div>
            <div>
              <h1 className="font-semibold">{user.name}</h1>
              <p className="text-slate-400 text-xs">Estagiário</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Bank of Hours */}
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
          <p className="text-slate-400 text-sm mt-1">
            Saldo acumulado desde {user.startDate ? format(parseISO(user.startDate + 'T00:00:00'), "dd/MM/yyyy") : 'o início'}
          </p>
        </div>

        {/* Today's punches */}
        {todayRecords.length > 0 && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Registros de Hoje
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {todayRecords.map((r, i) => (
                <div key={r.id} className={`rounded-xl px-3 py-2 text-sm ${
                  r.type === 'entry' ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                }`}>
                  <span className="font-medium">{r.type === 'entry' ? '▶ Entrada' : '◼ Saída'}</span>
                  <span className="ml-2">{format(r.timestamp, 'HH:mm')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily History */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold">Histórico de Dias</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Carregando...</div>
          ) : (
            <div className="divide-y divide-slate-700">
              {daySummaries.slice(0, 20).map(day => (
                <div key={day.dateStr} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm capitalize">
                      {format(day.date, "EEE, dd/MM", { locale: ptBR })}
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
          )}
        </div>
      </main>
    </div>
  );
}
