"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';import {installAutoFilters} from '@/lib/auto-filters';
export function AutoFilterForm({action,children}:{action:string;children:ReactNode}){
 const ref=useRef<HTMLFormElement>(null),[error,setError]=useState('');
 useEffect(()=>{if(ref.current)return installAutoFilters({form:ref.current,win:window,onError:setError});},[action]);
 return <form ref={ref} action={action} method="get" className="filters" data-auto-filters="true">{children}{error&&<p className="notice" role="status">{error}</p>}<noscript><button>แสดงผล</button></noscript></form>;
}
