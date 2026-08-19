"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {onAuthStateChanged} from "firebase/auth";
import {httpsCallable} from "firebase/functions";
import {auth, functions} from "@/lib/firebase";
import InternshipHistory from "@/components/InternshipHistory";

type Intern={id:string;name:string};
const listInterns=httpsCallable<null,Intern[]>(functions,"listInterns");

export default function SupervisorHistory(){
  const router=useRouter(); const [interns,setInterns]=useState<Intern[]>([]); const [selected,setSelected]=useState("");
  useEffect(()=>onAuthStateChanged(auth,async user=>{if(!user){router.push("/login?role=supervisor");return;} try{const result=await listInterns(null);setInterns(result.data);if(result.data[0])setSelected(result.data[0].id);}catch(e){console.error(e);}}),[router]);
  return <main className="min-h-screen bg-slate-100 p-4"><div className="max-w-5xl mx-auto py-4 space-y-4"><div className="bg-white rounded-2xl p-4 border"><h1 className="font-bold text-xl">Histórico dos estagiários</h1><label className="block mt-3 text-sm font-medium">Estagiário<select value={selected} onChange={e=>setSelected(e.target.value)} className="mt-1 w-full border rounded-lg p-2">{interns.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label></div>{selected&&<InternshipHistory userId={selected} canReview/>}</div></main>;
}
