'use client';
import {useEffect,useId,useState,type ReactNode} from 'react';

type MotionPreference='auto'|'on'|'off';
const storageKey='cannexa:platinum-border-motion';

export function PlatinumCardFrame({children}:{children:ReactNode}){
 const sparkleId=useId();
 const [preference,setPreference]=useState<MotionPreference>('auto');
 const [reducedMotion,setReducedMotion]=useState(true);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>setReducedMotion(media.matches);
  update();media.addEventListener('change',update);
  try{const saved=localStorage.getItem(storageKey);if(saved==='on'||saved==='off')setPreference(saved);}catch{}
  return()=>media.removeEventListener('change',update);
 },[]);
 const moving=preference==='on'||preference==='auto'&&!reducedMotion;
 return <div className="platinum-card-wrap">
  <div className="portal-member-card portal-member-vip" data-motion={moving?'on':'off'} onPointerMove={event=>{
   if(!moving||event.pointerType==='touch')return;
   const bounds=event.currentTarget.getBoundingClientRect();
   const position=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
   event.currentTarget.style.setProperty('--platinum-letter-x',Math.round(position*2300)+'px');
  }}>
   {children}
   <svg className="platinum-letter-effect" viewBox="0 0 1526 822" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
     <filter id={sparkleId+'-letter-alpha'} colorInterpolationFilters="sRGB">
      <feColorMatrix type="luminanceToAlpha"/>
      <feComponentTransfer><feFuncA type="linear" slope="4" intercept="-2"/></feComponentTransfer>
     </filter>
     <clipPath id={sparkleId+'-letter-area'}><rect x="85" y="330" width="1395" height="175"/></clipPath>
     <mask id={sparkleId+'-letter-mask'} maskUnits="userSpaceOnUse" x="0" y="0" width="1526" height="822" style={{maskType:'alpha'}}>
      <image href="/member/vip.png" x="-29" y="-70" width="1586" height="992" filter={'url(#'+sparkleId+'-letter-alpha)'} clipPath={'url(#'+sparkleId+'-letter-area)'}/>
     </mask>
     <linearGradient id={sparkleId+'-letter-foil'} x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stopColor="#d1e8ff"/><stop offset=".3" stopColor="#e9d3f5"/><stop offset=".6" stopColor="#fff0be"/><stop offset="1" stopColor="#b9f0e5"/>
     </linearGradient>
     <linearGradient id={sparkleId+'-letter-highlight'} gradientTransform="rotate(12 .5 .5)">
      <stop offset="0" stopColor="#b9e3ff" stopOpacity="0"/><stop offset=".2" stopColor="#18394d" stopOpacity=".65"/><stop offset=".35" stopColor="#d6edff" stopOpacity=".75"/><stop offset=".5" stopColor="#fffdf0"/><stop offset=".65" stopColor="#f9d8e8" stopOpacity=".75"/><stop offset=".8" stopColor="#294a59" stopOpacity=".5"/><stop offset="1" stopColor="#fff2c5" stopOpacity="0"/>
     </linearGradient>
    </defs>
    <g mask={'url(#'+sparkleId+'-letter-mask)'}>
     <rect x="85" y="330" width="1395" height="175" fill={'url(#'+sparkleId+'-letter-foil)'} opacity=".42"/>
     <rect className="platinum-letter-shine" x="-700" y="330" width="540" height="175" fill={'url(#'+sparkleId+'-letter-highlight)'} opacity=".9"/>
    </g>
   </svg>
   <svg className="platinum-border" aria-hidden="true" focusable="false">
    <defs>
     <linearGradient id={sparkleId+'-border-metal'} x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0" stopColor="#ad7019"/><stop offset=".2" stopColor="#ffe39b"/><stop offset=".35" stopColor="#fffde7"/><stop offset=".5" stopColor="#d99828"/><stop offset=".65" stopColor="#fffbdc"/><stop offset=".8" stopColor="#ffdb78"/><stop offset="1" stopColor="#b77b21"/>
     </linearGradient>
    </defs>
    <rect className="platinum-border-glow" x="2" y="2" rx="18" pathLength="100"/>
    <rect className="platinum-border-light" x="2" y="2" rx="18" pathLength="100" style={{stroke:'url(#'+sparkleId+'-border-metal)'}}/>
    <rect className="platinum-border-specular" x="2" y="2" rx="18" pathLength="100"/>
   </svg>
  </div>
 </div>;
}
