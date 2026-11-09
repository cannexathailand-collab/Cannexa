'use client';

import type {ReactNode} from 'react';
import {useRouter} from 'next/navigation';

export function IncomeRow({href,children}:{href?:string;children:ReactNode}){
 const router=useRouter();
 return <tr className={href?'income-linked-row':undefined} data-href={href} onClick={event=>{
  if(!href||event.defaultPrevented||event.button!==0)return;
  if(event.target instanceof Element&&event.target.closest('a,button,input,select,textarea'))return;
  if(window.getSelection()?.toString())return;
  if(event.ctrlKey||event.metaKey||event.shiftKey){window.open(href,'_blank','noopener,noreferrer');return;}
  router.push(href);
 }}>{children}</tr>;
}
