export type StrainProfile={thc?:string|null;indicaPercent?:number|null;sativaPercent?:number|null;genetics?:string|null;aromaFlavor?:string|null;effects?:string|null};
export function formatStrainResearch(name:string,profile:StrainProfile,sources:string[]){
 const clean=(value:string|undefined|null,fallback='Not reported')=>value?.replace(/\s+/g,' ').trim()||fallback;
 const percent=(value:number|null|undefined)=>value==null?'not reported':value+'%';
 const parts=[clean(name),clean(profile.thc),clean(profile.genetics),clean(profile.aromaFlavor),clean(profile.effects,'Not established')];
 const source=sources[0]?'\nSource: '+sources[0]:'';
 const render=()=>`🔹 Strain Name: ${parts[0]}\n🔸 Type: Indica ${percent(profile.indicaPercent)} / Sativa ${percent(profile.sativaPercent)} | THC ${parts[1]}\n🌱 Genetics: ${parts[2]}\n🌈 Aroma and Flavor: ${parts[3]}\n💜 Benefits: ${parts[4]}${source}`;
 let text=render();
 // Keep the required headings, reported proportions and source URL intact.
 while(text.length>500){
  const index=parts.reduce((best,value,i)=>value.length>parts[best].length?i:best,0);
  if(parts[index].length<=16)break;
  parts[index]=parts[index].slice(0,Math.max(16,parts[index].length-(text.length-500)));
  text=render();
 }
 return text;
}
