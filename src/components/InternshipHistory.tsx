"use client";

import {useEffect, useMemo, useState} from "react";
import {format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, isAfter, isBefore} from "date-fns";
import {ptBR} from "date-fns/locale";
import {CalendarDays, ChevronLeft, ChevronRight, Clock, FileText, Check, X} from "lucide-react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/lib/firebase";
import {formatMinutes, formatMinutesAbs} from "@/lib/schedule";

type DaySummary = {date:string; weekday:string; expected:number; worked:number; approvedAbonoMinutes:number; required:number; rawBalance:number; compensatedMinutes:number; balance:number; carryIn:number; carryOut:number; status:string};
type HistoryResponse = {userData:{id:string; name:string; startDate:string}; days:DaySummary[]; week?:any};
type Abono = {id:string; userId:string; userName:string; date:string; minutes:number; reason:string; status:string};

const getHistory = httpsCallable<any, HistoryResponse>(functions, "getInternshipHistory");
const requestAbono = httpsCallable<any, any>(functions, "requestAbono");
const listAbonoRequests = httpsCallable<any, Abono[]>(functions, "listAbonoRequests");
const reviewAbono = httpsCallable<any, any>(functions, "reviewAbono");

const cacheKey = (userId:string, mode:string, date:string) => `estagio:history:${userId}:${mode}:${date}`;
const readCache = <T,>(key:string):T|null => { try { const raw = localStorage.getItem(key); if (!raw) return null; const x = JSON.parse(raw); return Date.now() - x.savedAt < 5 * 60_000 ? x.value : null; } catch { return null; } };
const writeCache = (key:string, value:any) => { try { localStorage.setItem(key, JSON.stringify({savedAt:Date.now(), value})); } catch {} };
const clearHistoryCache = (userId:string) => { try { Object.keys(localStorage).filter(k => k.startsWith(`estagio:history:${userId}:`)).forEach(k => localStorage.removeItem(k)); } catch {} };

function monthWeeks(month:string) {
  const d = parseISO(`${month}-01`); const start = startOfWeek(startOfMonth(d), {weekStartsOn:1}); const end = endOfWeek(endOfMonth(d), {weekStartsOn:1});
  return eachDayOfInterval({start,end}).filter(d => d.getDay() === 1).map(d => ({value:format(d,"yyyy-MM-dd"), label:`Semana de ${format(d,"dd/MM")} a ${format(endOfWeek(d,{weekStartsOn:1}),"dd/MM")}`}));
}

export default function InternshipHistory({userId, canReview=false}: {userId:string; canReview?:boolean}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [mode,setMode] = useState<"month"|"week"|"day">("month");
  const [month,setMonth] = useState(format(new Date(),"yyyy-MM"));
  const [selectedWeek,setSelectedWeek] = useState(format(startOfWeek(new Date(),{weekStartsOn:1}),"yyyy-MM-dd"));
  const [selectedDay,setSelectedDay] = useState(today);
  const [data,setData] = useState<HistoryResponse|null>(null);
  const [abonos,setAbonos] = useState<Abono[]>([]);
  const [loading,setLoading] = useState(false);
  const [showAbono,setShowAbono] = useState(false);
  const [reason,setReason] = useState("");
  const [minutes,setMinutes] = useState("60");
  const [message,setMessage] = useState("");

  const weeks = useMemo(() => monthWeeks(month), [month]);
  useEffect(() => { if (!weeks.some(w => w.value === selectedWeek)) setSelectedWeek(weeks[0]?.value ?? selectedWeek); }, [month,weeks,selectedWeek]);
  useEffect(() => { load(mode, mode === "month" ? month : mode === "week" ? selectedWeek : selectedDay); }, [userId,mode,month,selectedWeek,selectedDay]);
  useEffect(() => { loadAbonos(); }, [userId]);

  async function load(currentMode:string, date:string) {
    const key=cacheKey(userId,currentMode,date); const cached=readCache<HistoryResponse>(key); if(cached){setData(cached);return;}
    setLoading(true); try { const result=await getHistory({userId,mode:currentMode,date}); setData(result.data); writeCache(key,result.data); } catch(e){console.error(e);} finally{setLoading(false);}
  }
  async function loadAbonos() { try { const result=await listAbonoRequests({userId}); setAbonos(result.data); } catch(e){console.error(e);} }
  const current = mode === "day" ? data?.days.find(d=>d.date===selectedDay) : undefined;

  const daysByDate = useMemo(() => new Map((data?.days ?? []).map(d=>[d.date,d])),[data]);
  const calendar = useMemo(() => { const d=parseISO(`${month}-01`); return eachDayOfInterval({start:startOfWeek(startOfMonth(d),{weekStartsOn:1}),end:endOfWeek(endOfMonth(d),{weekStartsOn:1})}); },[month]);

  const submitAbono = async () => {
    const value=Number(minutes); if(!reason.trim() || value<=0) return;
    try { await requestAbono({userId,date:selectedDay,minutes:value,reason:reason.trim()}); setMessage("Requerimento enviado para a supervisora."); setShowAbono(false); setReason(""); await loadAbonos(); } catch(e:any){setMessage(e?.message ?? "Não foi possível enviar o requerimento.");}
  };
  const decideAbono = async (id:string,status:"approved"|"rejected") => { try { await reviewAbono({requestId:id,status}); clearHistoryCache(userId); await loadAbonos(); await load(mode,mode === "month" ? month : mode === "week" ? selectedWeek : selectedDay); } catch(e:any){setMessage(e?.message ?? "Não foi possível atualizar o requerimento.");} };

  return <section className="bg-white text-slate-800 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
    <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5"/> Histórico de horas</h2><p className="text-xs text-slate-500 mt-1">Os dados ficam em cache por 5 minutos para evitar consultas repetidas.</p></div>
      <div className="flex rounded-xl bg-slate-100 p-1 text-sm"><button onClick={()=>setMode("month")} className={`px-3 py-2 rounded-lg ${mode==="month"?"bg-white shadow font-semibold":"text-slate-500"}`}>Mês</button><button onClick={()=>setMode("week")} className={`px-3 py-2 rounded-lg ${mode==="week"?"bg-white shadow font-semibold":"text-slate-500"}`}>Semana</button><button onClick={()=>setMode("day")} className={`px-3 py-2 rounded-lg ${mode==="day"?"bg-white shadow font-semibold":"text-slate-500"}`}>Dia</button></div>
    </div>

    <div className="p-4 space-y-4">
      <div className="flex flex-wrap gap-2 items-center"><label className="text-sm font-medium">Mês <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="ml-1 border rounded-lg px-2 py-2"/></label>{mode !== "month" && <label className="text-sm font-medium">Semana <select value={selectedWeek} onChange={e=>setSelectedWeek(e.target.value)} className="ml-1 border rounded-lg px-2 py-2">{weeks.map(w=><option key={w.value} value={w.value}>{w.label}</option>)}</select></label>}{mode === "day" && <label className="text-sm font-medium">Dia <select value={selectedDay} onChange={e=>setSelectedDay(e.target.value)} className="ml-1 border rounded-lg px-2 py-2">{(data?.days??[]).map(d=><option key={d.date} value={d.date}>{format(parseISO(d.date),"dd/MM/yyyy")}</option>)}</select></label>}</div>

      {loading && <div className="py-8 text-center text-slate-400">Carregando histórico...</div>}

      {!loading && mode === "month" && <>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(x=><div key={x} className="py-2">{x}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">{calendar.map(day=>{const date=format(day,"yyyy-MM-dd"); const inMonth=date.startsWith(month); const weekend=[0,6].includes(day.getDay()); const before=data?.userData.startDate && date<data.userData.startDate; const future=date>today; const item=daysByDate.get(date); const clickable=inMonth&&!weekend&&!before&&!future&&!!item; return <button type="button" disabled={!clickable} key={date} onClick={()=>{setSelectedDay(date);setMode("day");}} className={`min-h-[88px] rounded-xl border p-2 text-left transition ${!inMonth?"opacity-20 bg-slate-50":weekend?"opacity-40 bg-slate-100 cursor-not-allowed":before||future?"opacity-40 bg-slate-50 cursor-not-allowed":item?.status==="abono"?"bg-slate-300 border-slate-400":item?.rawBalance>=0?"bg-green-100 border-green-300 hover:scale-[1.02] hover:bg-green-200 active:scale-95 cursor-pointer":"bg-amber-100 border-amber-300 hover:scale-[1.02] hover:bg-amber-200 active:scale-95 cursor-pointer"}`}><div className="font-bold text-lg">{format(day,"d")}</div><div className="text-[11px] font-semibold uppercase">{format(day,"EEE",{locale:ptBR})}</div>{item?.status==="abono"?<div className="text-[11px] font-bold mt-1">Abonado</div>:item&&<div className="text-[11px] mt-2">{formatMinutesAbs(item.worked)} / {formatMinutesAbs(item.expected)}</div>}</button>})}</div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-500"><span>🟩 carga cumprida/excedida</span><span>🟨 carga abaixo do previsto</span><span>⬜ abonado</span><span>fim de semana não clicável</span></div>
      </>}

      {!loading && mode === "week" && <div className="space-y-4"><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><div className="rounded-xl bg-slate-100 p-4"><p className="text-xs text-slate-500">Fez</p><strong className="text-2xl">{formatMinutesAbs(data?.week?.workedMinutes??data?.days.reduce((n,d)=>n+d.worked,0)??0)}</strong></div><div className="rounded-xl bg-slate-100 p-4"><p className="text-xs text-slate-500">Saldo da semana</p><strong className={`text-2xl ${(data?.week?.balance??0)>=0?"text-green-600":"text-amber-600"}`}>{formatMinutes(data?.week?.balance??0)}</strong></div><div className="rounded-xl bg-slate-100 p-4"><p className="text-xs text-slate-500">Compensou</p><strong className="text-2xl">{formatMinutesAbs(data?.week?.compensatedMinutes??0)}</strong></div></div><div className="divide-y border rounded-xl">{(data?.days??[]).map(d=><button key={d.date} onClick={()=>{setSelectedDay(d.date);setMode("day")}} className="w-full px-4 py-3 flex justify-between text-left hover:bg-slate-50"><span><b>{format(parseISO(d.date),"EEEE, dd/MM",{locale:ptBR})}</b><span className="block text-xs text-slate-500">{formatMinutesAbs(d.worked)} trabalhadas · {formatMinutesAbs(d.expected)} previstas</span></span><span className="text-right">{d.compensatedMinutes>0&&<span className="block text-xs text-blue-600">-{formatMinutesAbs(d.compensatedMinutes)} compensadas</span>}<b className={d.balance>=0?"text-green-600":"text-amber-600"}>{formatMinutes(d.balance)}</b></span></button>)}</div></div>}

      {!loading && mode === "day" && current && <div className="space-y-4"><div className={`rounded-xl p-5 ${current.status==="abono"?"bg-slate-200":"bg-slate-100"}`}><p className="text-sm capitalize text-slate-500">{format(parseISO(current.date),"EEEE, dd 'de' MMMM 'de' yyyy",{locale:ptBR})}</p><div className="flex flex-wrap gap-6 mt-3"><div><span className="text-xs text-slate-500">Trabalhadas</span><p className="text-2xl font-bold">{formatMinutesAbs(current.worked)}</p></div><div><span className="text-xs text-slate-500">Previstas</span><p className="text-2xl font-bold">{formatMinutesAbs(current.expected)}</p></div><div><span className="text-xs text-slate-500">Saldo</span><p className={`text-2xl font-bold ${current.balance>=0?"text-green-600":"text-amber-600"}`}>{formatMinutes(current.balance)}</p></div></div>{current.status==="abono"&&<p className="mt-3 font-semibold">Dia abonado — {formatMinutesAbs(current.approvedAbonoMinutes)}.</p>}{current.compensatedMinutes>0&&<p className="mt-2 text-sm text-blue-700">{formatMinutesAbs(current.compensatedMinutes)} de saldo anterior foram usados para compensar este dia.</p>}</div><div className="flex items-center justify-between"><h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4"/> Requerimentos de abono</h3>{!canReview&&<button onClick={()=>setShowAbono(v=>!v)} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm">Solicitar abono</button>}</div>{showAbono&&!canReview&&<div className="rounded-xl border p-4 space-y-3"><label className="block text-sm">Horas abonadas (minutos)<input type="number" min="1" value={minutes} onChange={e=>setMinutes(e.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label><label className="block text-sm">Motivo<textarea value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 w-full border rounded-lg p-2" rows={3}/></label><button onClick={submitAbono} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Enviar requerimento</button></div>}{message&&<p className="text-sm text-slate-600">{message}</p>}<div className="space-y-2">{abonos.filter(a=>a.date===selectedDay).map(a=><div key={a.id} className="border rounded-xl p-3 flex flex-wrap justify-between gap-3"><div><b>{formatMinutesAbs(a.minutes)} abonadas</b><p className="text-sm text-slate-500">{a.reason}</p><p className="text-xs mt-1">Status: {a.status}</p></div>{canReview&&a.status==="pending"&&<div className="flex gap-2"><button onClick={()=>decideAbono(a.id,"approved")} className="p-2 rounded-lg bg-green-100 text-green-700" title="Aprovar"><Check className="w-4 h-4"/></button><button onClick={()=>decideAbono(a.id,"rejected")} className="p-2 rounded-lg bg-red-100 text-red-700" title="Rejeitar"><X className="w-4 h-4"/></button></div>}</div>)}</div></div>}
      {!loading && mode === "day" && !current && <div className="py-8 text-center text-slate-400">Selecione um dia de estágio válido.</div>}
    </div>
  </section>;
}
