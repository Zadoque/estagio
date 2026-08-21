"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {auth, db, googleProvider} from "@/lib/firebase";
import {signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail} from "firebase/auth";
import {doc, getDoc} from "firebase/firestore";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleUserRedirect = async (uid: string) => {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (!userDoc.exists()) throw new Error("Usuário não encontrado.");
    router.push(userDoc.data().role === "supervisora" ? "/supervisor" : `/dashboard/${uid}`);
  };

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    try { const result = await signInWithEmailAndPassword(auth, email, password); await handleUserRedirect(result.user.uid); }
    catch { setError("Erro ao fazer login. Verifique e-mail e senha."); }
  };

  const handleGoogleLogin = async () => {
    setError(""); setMessage("");
    try { const result = await signInWithPopup(auth, googleProvider); await handleUserRedirect(result.user.uid); }
    catch { setError("Não foi possível autenticar com o Google."); }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError("Informe seu e-mail para receber o link de criação ou redefinição da senha."); return; }
    try { await sendPasswordResetEmail(auth, email); setMessage("Enviamos um e-mail com o link para criar ou redefinir sua senha."); setError(""); }
    catch { setError("Não foi possível enviar o e-mail. Confira o endereço informado."); }
  };

  return (
    <main className="min-h-screen bg-[#1B365D] flex items-center justify-center p-4">
      <form onSubmit={handleEmailLogin} className="w-full max-w-sm p-8 bg-white rounded-3xl shadow-2xl border-t-8 border-[#F2A900] space-y-4">
        <div className="text-center mb-5"><div className="inline-flex items-center justify-center w-14 h-14 bg-[#2A2A86] rounded-2xl mb-3"><span className="text-[#F2A900] font-black text-xl" style={{fontFamily: '"Times New Roman", Times, serif'}}>UENF</span></div><h1 className="text-2xl font-bold text-[#1B365D]">Controle de Ponto</h1><p className="text-[#1B365D]/60 text-sm mt-1">Acesso ao sistema de estágio</p></div>
        {error && <p className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</p>}
        {message && <p className="bg-green-50 text-green-700 p-3 rounded-xl text-sm">{message}</p>}
        <label className="block text-sm font-medium text-[#1B365D]">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-[#F2A900] outline-none" required /></label>
        <label className="block text-sm font-medium text-[#1B365D]">Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-[#F2A900] outline-none" /></label>
        <button type="submit" className="w-full bg-[#2A2A86] text-white font-semibold py-3 rounded-xl hover:bg-[#1B365D] transition">Entrar</button>
        <button type="button" onClick={handleForgotPassword} className="w-full text-sm text-[#2A2A86] hover:text-[#F2A900] font-medium">Esqueci minha senha / criar senha</button>
        <div className="flex items-center"><div className="flex-1 border-t border-gray-200" /><span className="px-3 text-gray-400 text-xs">OU</span><div className="flex-1 border-t border-gray-200" /></div>
        <button type="button" onClick={handleGoogleLogin} className="w-full bg-white border border-gray-200 text-[#1B365D] font-semibold py-3 rounded-xl hover:bg-gray-50 transition">Continuar com Google</button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-full mt-2 text-sm text-[#1B365D] hover:text-[#F2A900] font-medium"
        >
          Voltar ao menu
        </button>
      </form>
    </main>
  );
}
