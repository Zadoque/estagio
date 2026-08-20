"use client";

import {useRouter} from "next/navigation";
import {Clock, Monitor, User, Shield} from "lucide-react";

export default function Home() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-[#1B365D] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#2A2A86] rounded-2xl mb-4 border border-white/10"><span className="text-[#F2A900] font-black text-2xl" style={{fontFamily: '"Times New Roman", Times, serif'}}>UENF</span></div>
          <h1 className="text-3xl font-bold text-white">Controle de Ponto</h1>
          <p className="text-white/60 mt-2">Sistema de Registro de Presença</p>
        </div>
        <div className="space-y-4">
          <button onClick={() => router.push("/bater-ponto")} className="w-full bg-[#2A2A86] hover:bg-[#F2A900] hover:text-[#1B365D] border border-white/10 rounded-2xl p-6 text-left transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#F2A900] text-[#1B365D] rounded-xl flex items-center justify-center">
                <Monitor className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-semibold text-lg text-white group-hover:text-[#1B365D]">Bater ponto</h2><p className="text-white/60 group-hover:text-[#1B365D]/70 text-sm">Registre entrada ou saída usando seu PIN</p>
                </div></div>
          </button>
          <button onClick={() => router.push("/login?role=estagiario")} className="w-full bg-[#2A2A86] hover:bg-[#F2A900] hover:text-[#1B365D] border border-white/10 rounded-2xl p-6 text-left transition-all group">
            <div className="flex items-center gap-4"><div className="w-12 h-12 bg-[#1B365D] rounded-xl flex items-center justify-center"><User className="w-6 h-6 text-white" /></div><div><h2 className="font-semibold text-lg text-white group-hover:text-[#1B365D]">Estagiário</h2><p className="text-white/60 group-hover:text-[#1B365D]/70 text-sm">Veja seus registros e banco de horas</p></div></div>
          </button>
          <button onClick={() => router.push("/login?role=supervisor")} className="w-full bg-[#2A2A86] hover:bg-[#F2A900] hover:text-[#1B365D] border border-white/10 rounded-2xl p-6 text-left transition-all group">
            <div className="flex items-center gap-4"><div className="w-12 h-12 bg-[#1B365D] rounded-xl flex items-center justify-center"><Shield className="w-6 h-6 text-white" /></div><div><h2 className="font-semibold text-lg text-white group-hover:text-[#1B365D]">Supervisora</h2><p className="text-white/60 group-hover:text-[#1B365D]/70 text-sm">Painel gerencial e gestão de estagiários</p></div></div>
          </button>
        </div>
      </div>
    </main>
  );
}
