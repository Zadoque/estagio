"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {format, startOfWeek, endOfWeek, isBefore, parseISO} from "date-fns";
import {ptBR} from "date-fns/locale";
import {CalendarDays, Clock, LogOut, Mail, Plus, RefreshCw, Shield, Users} from "lucide-react";
import {onAuthStateChanged, sendPasswordResetEmail} from "firebase/auth";
import {httpsCallable} from "firebase/functions";
import {auth, functions} from "@/lib/firebase";
import {getAllPunches} from "@/lib/firestore";
import {calculateDailyMinutes, getDayExpectedMinutes, formatMinutes, formatMinutesAbs, type PunchRecord} from "@/lib/schedule";

type Intern = {id: string; name: string; email: string; pin: string; qrCode: string; role: string; startDate: string; lastPunchDate?: string; lastPunchType?: "entry" | "exit"};
type UserStatus = {userId: string; name: string; isPresent: boolean; todayWorked: number; todayExpected: number; weekBalance: number; lastPunch?: Date};

const listInterns = httpsCallable<void, Intern[]>(functions, "listInterns");
const createInvite = httpsCallable<{name: string; email: string; pin: string; startDate: string}, {uid: string; email: string; name: string; qrCode: string}>(functions, "createInternshipInvite");

export default function SupervisorPage() {
  const router = useRouter();
  const [interns, setInterns] = useState<Intern[]>([]);
  const [statuses, setStatuses] = useState<UserStatus[]>([]);
  const [recentPunches, setRecentPunches] = useState<PunchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({name: "", email: "", pin: "", startDate: format(new Date(), "yyyy-MM-dd")});
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login?role=supervisor"); return; }
      await loadData();
    });
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const internsResult = await listInterns();
      const loadedInterns = internsResult.data;
      setInterns(loadedInterns);

      const now = new Date();
      const today = format(now, "yyyy-MM-dd");
      const weekStart = format(startOfWeek(now, {weekStartsOn: 1}), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(now, {weekStartsOn: 1}), "yyyy-MM-dd");
      const allPunches = await getAllPunches();
      const todayPunches = allPunches.filter((p) => p.date === today);
      const weekPunches = allPunches.filter((p) => p.date >= weekStart && p.date <= weekEnd);

      setStatuses(loadedInterns.map((user) => {
        const internshipStart = user.startDate ? parseISO(user.startDate + "T00:00:00") : null;
        const userTodayPunches = todayPunches.filter((p) => p.userId === user.id);
        const userWeekPunches = weekPunches.filter((p) => p.userId === user.id);
        const todayWorked = calculateDailyMinutes(userTodayPunches);
        const todayExpected = internshipStart && isBefore(now, internshipStart) ? 0 : getDayExpectedMinutes(now);

        const uniqueDays = [...new Set(userWeekPunches.map((p) => p.date))];
        let weekWorked = 0;
        let weekExpected = 0;
        for (const day of uniqueDays) {
          const dayDate = new Date(day + "T12:00:00");
          if (internshipStart && isBefore(dayDate, internshipStart)) continue;
          const dayPunches = userWeekPunches.filter((p) => p.date === day);
          weekWorked += calculateDailyMinutes(dayPunches);
          weekExpected += getDayExpectedMinutes(dayDate);
        }

        return {
          userId: user.id,
          name: user.name,
          isPresent: userTodayPunches.length % 2 === 1,
          todayWorked,
          todayExpected,
          weekBalance: weekWorked - weekExpected,
          lastPunch: userTodayPunches.at(-1)?.timestamp,
        };
      }));

      setRecentPunches([...allPunches].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 20));
      setLastUpdate(new Date());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviting(true); setInviteError(""); setInviteMessage("");
    try {
      const result = await createInvite(invite);
      await sendPasswordResetEmail(auth, result.data.email);
      setInviteMessage(`Convite criado. Um e-mail para criar a senha foi enviado para ${result.data.email}.`);
      setInvite({name: "", email: "", pin: "", startDate: format(new Date(), "yyyy-MM-dd")});
      await loadData();
    } catch (error: any) {
      setInviteError(error?.message || "Não foi possível criar o convite.");
    } finally {
      setInviting(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-[#1B365D] text-white">
      <header className="bg-[#2A2A86] border-b border-white/10 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F2A900] text-[#1B365D] rounded-xl flex items-center justify-center"><Shield className="w-5 h-5" /></div>
            <div><h1 className="font-semibold">Painel da Supervisora</h1><p className="text-white/60 text-xs">Gestão de estágio</p></div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={loadData} className="text-white/60 hover:text-white"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
            <button onClick={handleLogout} className="flex items-center gap-2 text-white/60 hover:text-white text-sm"><LogOut className="w-4 h-4" /> Sair</button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between"><p className="text-white/50 text-xs">Atualizado: {format(lastUpdate, "HH:mm:ss")}</p><button onClick={() => setInviteOpen((open) => !open)} className="flex items-center gap-2 bg-[#F2A900] text-[#1B365D] px-4 py-2 rounded-xl font-semibold text-sm"><Plus className="w-4 h-4" /> Convidar estagiário</button></div>

        {inviteOpen && (
          <form onSubmit={handleInvite} className="bg-white rounded-2xl p-5 text-[#1B365D] shadow-xl space-y-4">
            <div><h2 className="font-bold text-lg">Novo estagiário</h2><p className="text-sm text-[#1B365D]/60">O sistema cria a conta e envia o link para o estagiário definir a própria senha.</p></div>
            {inviteError && <p className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{inviteError}</p>}
            {inviteMessage && <p className="bg-green-50 text-green-700 p-3 rounded-xl text-sm">{inviteMessage}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm font-medium">Nome<input required value={invite.name} onChange={(e) => setInvite({...invite, name: e.target.value})} className="mt-1 w-full border border-gray-200 rounded-xl p-3" /></label>
              <label className="text-sm font-medium">E-mail<input required type="email" value={invite.email} onChange={(e) => setInvite({...invite, email: e.target.value})} className="mt-1 w-full border border-gray-200 rounded-xl p-3" /></label>
              <label className="text-sm font-medium">PIN do ponto<input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={invite.pin} onChange={(e) => setInvite({...invite, pin: e.target.value.replace(/\D/g, "").slice(0, 4)})} className="mt-1 w-full border border-gray-200 rounded-xl p-3" /></label>
              <label className="text-sm font-medium">Início do estágio<input required type="date" value={invite.startDate} onChange={(e) => setInvite({...invite, startDate: e.target.value})} className="mt-1 w-full border border-gray-200 rounded-xl p-3" /></label>
            </div>
            <button disabled={inviting} className="bg-[#2A2A86] text-white px-5 py-3 rounded-xl font-semibold disabled:opacity-50">{inviting ? "Criando..." : "Criar e enviar convite"}</button>
          </form>
        )}

        <section>
          <h2 className="flex items-center gap-2 font-semibold text-lg mb-3"><Users className="w-5 h-5 text-[#F2A900]" /> Presença Atual</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {statuses.map((status) => (
              <div key={status.userId} className="bg-[#2A2A86] rounded-2xl p-5 border border-white/10">
                <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-[#F2A900] text-[#1B365D] rounded-xl flex items-center justify-center font-bold">{status.name[0]}</div><div><div className="font-semibold">{status.name}</div><div className="text-white/50 text-xs">Estagiário</div></div></div><span className={`px-3 py-1 rounded-full text-xs font-medium ${status.isPresent ? "bg-green-900/50 text-green-200" : "bg-white/10 text-white/50"}`}>{status.isPresent ? "● Presente" : "○ Ausente"}</span></div>
                <div className="grid grid-cols-2 gap-2 text-sm"><div className="bg-[#1B365D] rounded-xl p-3"><div className="text-white/50 text-xs mb-1">Hoje</div><div className="font-mono">{formatMinutesAbs(status.todayWorked)}</div></div><div className={`rounded-xl p-3 ${status.weekBalance >= 0 ? "bg-green-900/20" : "bg-red-900/20"}`}><div className="text-white/50 text-xs mb-1">Banco (semana)</div><div className={`font-mono ${status.weekBalance >= 0 ? "text-green-300" : "text-red-300"}`}>{formatMinutes(status.weekBalance)}</div></div></div>
                {status.lastPunch && <p className="text-white/40 text-xs mt-2">Último ponto: {format(status.lastPunch, "HH:mm")}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#2A2A86] rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2"><Clock className="w-4 h-4 text-[#F2A900]" /><h3 className="font-semibold">Registros Recentes</h3></div>
          {loading ? <div className="p-8 text-center text-white/50">Carregando...</div> : <div className="divide-y divide-white/10">{recentPunches.length === 0 && <div className="p-6 text-center text-white/50 text-sm">Nenhum registro encontrado.</div>}{recentPunches.map((p) => <div key={p.id} className="px-4 py-3 flex items-center justify-between"><div><div className="font-medium text-sm">{interns.find((u) => u.id === p.userId)?.name ?? p.userId}</div><div className="text-white/40 text-xs">{format(p.timestamp, "dd/MM/yyyy", {locale: ptBR})}</div></div><div className="text-right"><div className={`text-sm ${p.type === "entry" ? "text-green-300" : "text-[#F2A900]"}`}>{p.type === "entry" ? "▶ Entrada" : "◼ Saída"}</div><div className="text-white/40 text-xs">{format(p.timestamp, "HH:mm")}</div></div></div>)}</div>}
        </section>

        <section className="bg-white text-[#1B365D] rounded-2xl p-5">
          <h2 className="font-bold mb-3">Estagiários cadastrados</h2>
          <div className="space-y-3">{interns.map((intern) => <div key={intern.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3"><div><div className="font-semibold">{intern.name}</div><div className="text-sm text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" />{intern.email}</div></div><div className="text-sm text-gray-500 flex items-center gap-1"><CalendarDays className="w-3 h-3" />{format(parseISO(intern.startDate), "dd/MM/yyyy")}</div></div>)}</div>
        </section>
      </div>
    </main>
  );
}
