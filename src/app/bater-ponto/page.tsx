"use client";

import {useEffect, useRef, useState} from "react";
import {format} from "date-fns";
import {ptBR} from "date-fns/locale";
import {ArrowLeft, CheckCircle, Hash, XCircle} from "lucide-react";
import {httpsCallable, HttpsCallableResult} from "firebase/functions";
import {functions} from "@/lib/firebase";
import {useRouter} from "next/navigation";

type PunchResult = {userId: string; userName: string; type: "entry" | "exit"; timestamp: string};
type Mode = "pin" | "success" | "error";

const registerPunch = httpsCallable<{pin: string}, PunchResult>(functions, "registerPunch");

export default function BaterPontoPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("pin");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode, loading]);

  const reset = (delay = 2500) => {
    window.setTimeout(() => {
      setMode("pin");
      setPin("");
      setMessage("");
      setUserName("");
    }, delay);
  };

  const submitPin = async (value: string) => {
    if (loading || value.length !== 4) return;
    setLoading(true);
    try {
      const result: HttpsCallableResult<PunchResult> = await registerPunch({pin: value});
      setUserName(result.data.userName);
      setMessage(result.data.type === "entry" ? "Entrada registrada com sucesso!" : "Saída registrada com sucesso!");
      setMode("success");
      reset(3000);
    } catch (error: any) {
      const retryAfter = error?.details?.retryAfterSeconds;
      setMessage(retryAfter ? `${error.message} (${Math.ceil(retryAfter / 60)} min)` : (error?.message || "Não foi possível registrar o ponto."));
      setMode("error");
      reset(3000);
    } finally {
      setLoading(false);
    }
  };

  const addDigit = (digit: string) => {
    if (loading || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) void submitPin(next);
  };

  const handleKeyboard = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (/^\d$/.test(event.key)) addDigit(event.key);
    if (event.key === "Backspace") setPin((value) => value.slice(0, -1));
    if (event.key === "Enter") void submitPin(pin);
  };

  return (
    <main className="min-h-screen bg-[#1B365D] flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <div className="text-6xl font-mono font-bold text-white tracking-widest">{format(currentTime, "HH:mm:ss")}</div>
        <div className="text-white/70 mt-2 text-lg capitalize">{format(currentTime, "EEEE, dd 'de' MMMM 'de' yyyy", {locale: ptBR})}</div>
      </div>

      <section className="w-full max-w-sm bg-[#2A2A86] rounded-3xl p-8 shadow-2xl border border-white/10">
        {mode === "pin" && (
          <div>
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-[#F2A900] flex items-center justify-center"><Hash className="w-6 h-6 text-[#1B365D]" /></div>
            </div>
            <h1 className="text-white text-center text-2xl font-bold">Bater ponto</h1>
            <p className="text-white/70 text-center text-sm mt-2">Digite seu PIN de 4 dígitos</p>

            <input
              ref={inputRef}
              value={pin}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                setPin(digits);
                if (digits.length === 4) void submitPin(digits);
              }}
              onKeyDown={handleKeyboard}
              inputMode="numeric"
              autoComplete="off"
              aria-label="PIN"
              className="absolute opacity-0 pointer-events-none"
            />

            <div className="flex justify-center gap-3 my-7" aria-label={`${pin.length} de 4 dígitos preenchidos`}>
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className={`w-4 h-4 rounded-full ${index < pin.length ? "bg-[#F2A900]" : "bg-white/25"}`} />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((digit, index) => (
                <button
                  key={index}
                  type="button"
                  disabled={!digit || loading}
                  onClick={() => digit === "⌫" ? setPin((value) => value.slice(0, -1)) : digit && addDigit(digit)}
                  className={`h-14 rounded-2xl text-xl font-semibold transition-colors ${
                    !digit ? "opacity-0" : digit === "⌫" ? "bg-[#1B365D] text-white/80 hover:bg-[#142946]" : "bg-white/10 text-white hover:bg-[#F2A900] hover:text-[#1B365D]"
                  }`}
                >{digit}</button>
              ))}
            </div>

            <p className="text-center text-white/50 text-xs mt-5">Você também pode usar o teclado do computador.</p>
          </div>
        )}

        {mode === "success" && (
          <div className="text-center py-5">
            <CheckCircle className="w-16 h-16 text-[#F2A900] mx-auto mb-4" />
            <h2 className="text-white text-2xl font-bold">{userName}</h2>
            <p className="text-white mt-2">{message}</p>
            <p className="text-white/60 text-sm mt-4">{format(currentTime, "HH:mm:ss")}</p>
          </div>
        )}

        {mode === "error" && (
          <div className="text-center py-5">
            <XCircle className="w-16 h-16 text-[#F2A900] mx-auto mb-4" />
            <p className="text-white text-lg">{message}</p>
          </div>
        )}
      </section>

      <button onClick={() => router.push("/")} className="mt-6 flex items-center gap-2 text-white/60 hover:text-white text-sm">
        <ArrowLeft className="w-4 h-4" /> Voltar ao menu
      </button>
    </main>
  );
}
