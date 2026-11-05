"use client";
import {useEffect,useRef,useTransition} from "react";
import {usePathname,useRouter} from "next/navigation";
import {installLiveRefresh,isLivePage} from "@/lib/live-refresh";
export function LiveUpdates(){
 const pathname=usePathname(),router=useRouter();const [pending,startTransition]=useTransition();const pendingRef=useRef(pending);pendingRef.current=pending;
 useEffect(()=>{
  if(!isLivePage(pathname))return;
  return installLiveRefresh({doc:document,win:window,pending:()=>pendingRef.current,refresh:()=>startTransition(()=>router.refresh())});
 },[pathname,router]);
 return null;
}
