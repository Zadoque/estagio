"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Monitor, User, Shield } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur rounded-2xl mb-4">
            <Clock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Controle de Ponto</h1>
          <p className="text-blue-200 mt-2">Sistema de Registro de Presença</p>
        </div>

        {/* Navigation Cards */}
        <div className="space-y-4">
          <button
            onClick={() => router.push('/kiosk')}
            className="w-full bg-white/10 backdrop-blur hover:bg-white/20 border border-white/20 rounded-2xl p-6 text-left transition-all duration-200 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-400/20 rounded-xl flex items-center justify-center group-hover:bg-green-400/30 transition-colors">
                <Monitor className="w-6 h-6 text-green-300" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Kiosk — Bater Ponto</h2>
                <p className="text-blue-200 text-sm">Registre entrada/saída com QR Code ou PIN</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/login?role=estagiario')}
            className="w-full bg-white/10 backdrop-blur hover:bg-white/20 border border-white/20 rounded-2xl p-6 text-left transition-all duration-200 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-400/20 rounded-xl flex items-center justify-center group-hover:bg-blue-400/30 transition-colors">
                <User className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Estagiário</h2>
                <p className="text-blue-200 text-sm">Veja seus registros e banco de horas</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/login?role=supervisor')}
            className="w-full bg-white/10 backdrop-blur hover:bg-white/20 border border-white/20 rounded-2xl p-6 text-left transition-all duration-200 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-400/20 rounded-xl flex items-center justify-center group-hover:bg-purple-400/30 transition-colors">
                <Shield className="w-6 h-6 text-purple-300" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Supervisora</h2>
                <p className="text-blue-200 text-sm">Painel gerencial e relatórios</p>
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-blue-300/50 text-xs mt-8">Sistema de Estágio © 2026</p>
      </div>
    </main>
  );
}
