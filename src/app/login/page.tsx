// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db, googleProvider } from "@/lib/firebase";
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleUserRedirect = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === "supervisora") {
          router.push("/supervisor");
        } else {
          router.push(`/dashboard/${uid}`);
        }
      } else {
        setError("Usuário não encontrado na coleção 'users' do Firestore.");
      }
    } catch (err) {
      setError("Erro ao buscar dados do usuário.");
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await handleUserRedirect(userCredential.user.uid);
    } catch (err) {
      setError("Erro ao fazer login. Verifique e-mail e senha.");
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await handleUserRedirect(result.user.uid);
    } catch (err) {
      setError("Erro ao autenticar com o Google.");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Preencha o campo de e-mail para recuperar a senha.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("E-mail de redefinição de senha enviado com sucesso!");
      setError("");
    } catch (err) {
      setError("Erro ao enviar o e-mail de redefinição.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <form onSubmit={handleEmailLogin} className="flex flex-col gap-4 w-full max-w-sm p-8 bg-white shadow-lg rounded-lg border">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">Login do Sistema</h1>
        
        {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
        {message && <p className="text-green-600 text-sm font-medium">{message}</p>}
        
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <button type="submit" className="bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 transition">
          Entrar
        </button>

        <button type="button" onClick={handleForgotPassword} className="text-sm text-blue-500 hover:underline text-right mt-1">
          Esqueci minha senha
        </button>

        <div className="flex items-center my-2">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="px-3 text-gray-400 text-sm">OU</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="bg-white border border-gray-300 text-gray-700 font-semibold py-2 rounded hover:bg-gray-50 transition flex justify-center items-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Logar com Google
        </button>
      </form>
    </div>
  );
}