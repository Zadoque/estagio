"use client";

import {use, useEffect} from "react";
import {useRouter} from "next/navigation";
import {onAuthStateChanged} from "firebase/auth";
import {auth} from "@/lib/firebase";
import InternshipHistory from "@/components/InternshipHistory";

export default function SupervisorHistoryPage({params}:{params:Promise<{userId:string}>}) {
  const {userId}=use(params); const router=useRouter();
  useEffect(()=>onAuthStateChanged(auth,user=>{if(!user) router.push("/login?role=supervisor");}),[router]);
  return <main className="min-h-screen bg-slate-100 p-4"><div className="max-w-5xl mx-auto py-4"><InternshipHistory userId={userId} canReview/></div></main>;
}
