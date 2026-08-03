"use client";
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { USERS } from '@/lib/users';
import { ArrowLeft, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function QrCodesPage() {
  const router = useRouter();
  const [qrImages, setQrImages] = useState<Record<string, string>>({});

  useEffect(() => {
    const generate = async () => {
      const imgs: Record<string, string> = {};
      for (const user of USERS) {
        imgs[user.id] = await QRCode.toDataURL(user.qrCode, {
          width: 300,
          margin: 2,
          color: { dark: '#1e293b', light: '#f8fafc' },
        });
      }
      setQrImages(imgs);
    };
    generate();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">QR Codes para Impressão</h1>
        <p className="text-slate-500 mb-8">Imprima e cole os cartões abaixo no seu crachá.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {USERS.map(user => (
            <div key={user.id} className="bg-white rounded-2xl p-6 shadow-md text-center border border-slate-200">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white text-xl mx-auto mb-3">
                {user.name[0]}
              </div>
              <h2 className="font-bold text-slate-800 text-lg mb-4">{user.name}</h2>
              {qrImages[user.id] && (
                <img src={qrImages[user.id]} alt={`QR Code de ${user.name}`} className="mx-auto rounded-xl" />
              )}
              <p className="text-slate-400 text-xs mt-3 font-mono">{user.qrCode}</p>
              {qrImages[user.id] && (
                <a
                  href={qrImages[user.id]}
                  download={`qr-${user.id}.png`}
                  className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                >
                  <Download className="w-4 h-4" /> Baixar PNG
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
