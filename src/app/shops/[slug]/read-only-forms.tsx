'use client';
import {useEffect} from 'react';
export function ReadOnlyForms(){
 useEffect(()=>{
  const block=(event:Event)=>{const form=event.target;if(form instanceof HTMLFormElement&&form.method.toLowerCase()==='post'&&!form.hasAttribute('data-platform-exit'))event.preventDefault();};
  document.addEventListener('submit',block,true);
  const controls=Array.from(document.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement|HTMLTextAreaElement>('form[method="post"]:not([data-platform-exit]) input, form[method="post"]:not([data-platform-exit]) button, form[method="post"]:not([data-platform-exit]) select, form[method="post"]:not([data-platform-exit]) textarea'));
  const previous=controls.map(control=>control.disabled);
  controls.forEach(control=>{control.disabled=true});
  return ()=>{document.removeEventListener('submit',block,true);controls.forEach((control,index)=>{control.disabled=previous[index]});};
 });
 return null;
}
