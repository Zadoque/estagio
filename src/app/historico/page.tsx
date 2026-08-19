"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {onAuthStateChanged} from "firebase/auth";
import {auth} from "@/lib/firebase";
import InternshipHistory from "@/components/InternshipHistory";

export default function MyHistoryPage(){
  const router=useRouter(); const [uid,setUid]=useState<string|null>(null);
  useEffect(()=>onAuthStateChanged(auth,user=>{if(!user) router.push("/login"); else setUid(user.uid);}),[router]);
  if(!uid) return <main className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">Carregando...</main>;
  return <main className="min-h-screen bg-slate-100 p-4"><div className="max-w-5xl mx-auto py-4"><InternshipHistory userId={uid}/></div></main>;
}
