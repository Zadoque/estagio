"use client";

import {useEffect, useState} from "react";
import QRCode from "qrcode";
import {ArrowLeft, Download} from "lucide-react";
import {useRouter} from "next/navigation";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/lib/firebase";

type Intern = {id: string; name: string; qrCode: string};
const listInterns = httpsCallable<void, Intern[]>(functions, "listInterns");

export default function QrCodesPage() {
  const router = useRouter();
  const [users, setUsers] = useState<Intern[]>([]);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});

  useEffect(() => {
    const generate = async () => {
      try {
        const result = await listInterns();
        setUsers(result.data);
        const images: Record<string, string> = {};
        for (const user of result.data) images[user.id] = await QRCode.toDataURL(user.qrCode, {width: 300, margin: 2, color: {dark: "#1B365D", light: "#FFFFFF"}});
        setQrImages(images);
      } catch {
        router.push("/login?role=supervisor");
      }
    };
    void generate();
  }, [router]);

  return (
    <main className="min-h-screen bg-[#1B365D] p-6">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.push("/supervisor")} className="flex items-center gap-2 text-white/60 hover:text-white mb-6"><ArrowLeft className="w-4 h-4" /> Voltar</button>
        <h1 className="text-2xl font-bold text-white mb-2">QR Codes dos estagiários</h1>
        <p className="text-white/60 mb-8">Imprima os cartões para uso no registro de ponto.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {users.map((user) => <div key={user.id} className="bg-white rounded-2xl p-6 shadow-md text-center"><div className="w-12 h-12 bg-[#2A2A86] rounded-xl flex items-center justify-center font-bold text-[#F2A900] text-xl mx-auto mb-3">{user.name[0]}</div><h2 className="font-bold text-[#1B365D] text-lg mb-4">{user.name}</h2>{qrImages[user.id] && <img src={qrImages[user.id]} alt={`QR Code de ${user.name}`} className="mx-auto rounded-xl" />}<p className="text-gray-400 text-xs mt-3 font-mono break-all">{user.qrCode}</p>{qrImages[user.id] && <a href={qrImages[user.id]} download={`qr-${user.id}.png`} className="mt-4 inline-flex items-center gap-2 text-[#2A2A86] hover:text-[#F2A900] text-sm"><Download className="w-4 h-4" /> Baixar PNG</a>}</div>)}
        </div>
      </div>
    </main>
  );
}
