'use client';
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
type MobileLink={href:string;label:string;icon:string};
const iconPaths:Record<string,string>={home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',orders:'M6 3h12v18H6ZM9 8h6M9 12h6M9 16h4',customers:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-4',stock:'m3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 4 9-4M12 11v10',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',chart:'M4 20V10m8 10V4m8 16v-7',menu:'M4 6h16M4 12h16M4 18h16'};
function MobileIcon({name}:{name:string}){return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name]??iconPaths.menu}/></svg>;}
export function SidebarNavigation({children,mobileLinks=[]}:{children:ReactNode;mobileLinks?:MobileLink[]}){
 const nav=useRef<HTMLElement>(null),content=useRef<HTMLDivElement>(null),menuButton=useRef<HTMLButtonElement>(null),frame=useRef<number|null>(null),pathname=usePathname();
 const [mobileOpen,setMobileOpen]=useState(false);
 const [position,setPosition]=useState({above:false,below:false});
 const update=useCallback(()=>{if(frame.current!==null)return;frame.current=requestAnimationFrame(()=>{frame.current=null;const n=nav.current;if(!n)return;const above=n.scrollTop>2,below=n.scrollTop+n.clientHeight<n.scrollHeight-2;setPosition(previous=>previous.above===above&&previous.below===below?previous:{above,below});});},[]);
 useEffect(()=>{const n=nav.current,c=content.current;if(!n||!c)return;const observer=new ResizeObserver(update);observer.observe(n);observer.observe(c);n.addEventListener('scroll',update,{passive:true});update();return()=>{observer.disconnect();n.removeEventListener('scroll',update);if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;};},[update]);
 useEffect(()=>{setMobileOpen(false);},[pathname]);
 useEffect(()=>{
  if(!mobileOpen)return;
  const main=document.querySelector('main'),previousOverflow=document.body.style.overflow,previousInert=main?.inert;
  document.body.style.overflow='hidden';if(main)main.inert=true;
  const closeOnDesktop=(event:MediaQueryListEvent)=>{if(event.matches)setMobileOpen(false);};
  const desktop=window.matchMedia('(min-width:701px)');desktop.addEventListener('change',closeOnDesktop);
  return()=>{document.body.style.overflow=previousOverflow;if(main)main.inert=previousInert??false;desktop.removeEventListener('change',closeOnDesktop);};
 },[mobileOpen]);
 useEffect(()=>{if(!mobileOpen)return;const n=nav.current,active=n?.querySelector<HTMLAnchorElement>('a[aria-current=page]');if(n&&!active)n.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});if(n&&active){active.focus({preventScroll:true});const scroller=window.matchMedia('(max-width:700px)').matches?content.current:n;if(scroller){const a=active.getBoundingClientRect(),box=scroller.getBoundingClientRect();if(a.top<box.top)scroller.scrollTop-=box.top-a.top+8;else if(a.bottom>box.bottom)scroller.scrollTop+=a.bottom-box.bottom+8;}}update();},[mobileOpen,update]);
 useEffect(()=>{const n=nav.current;if(!n)return;const links=n.querySelectorAll<HTMLAnchorElement>('a[href]');let active:HTMLAnchorElement|undefined;links.forEach(link=>{if(link.getAttribute('href')===pathname){active=link;link.setAttribute('aria-current','page');}else link.removeAttribute('aria-current');});if(active){let parent=active.parentElement;while(parent&&parent!==n){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement;}const a=active.getBoundingClientRect(),box=n.getBoundingClientRect();if(window.matchMedia('(min-width:701px)').matches){if(a.top<box.top)n.scrollTop-=box.top-a.top+8;else if(a.bottom>box.bottom)n.scrollTop+=a.bottom-box.bottom+8;}else{if(a.left<box.left)n.scrollLeft-=box.left-a.left;else if(a.right>box.right)n.scrollLeft+=a.right-box.right;}}update();},[pathname,update]);
 const scroll=(direction:number)=>nav.current?.scrollBy({top:direction*Math.max(150,nav.current.clientHeight*.65),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 function closeMenu(){setMobileOpen(false);menuButton.current?.focus();}
 return <div className={'sidebar-navigation'+(mobileOpen?' mobile-open':'')}>
  {mobileOpen&&<div className="mobile-menu-backdrop" onClick={closeMenu} aria-hidden="true"/>}
  <nav id="main-sidebar-menu" ref={nav} tabIndex={0} role={mobileOpen?'dialog':undefined} aria-modal={mobileOpen?true:undefined} aria-label="เมนูหลัก" onKeyDown={e=>{
   if(e.key==='Escape'&&mobileOpen){e.preventDefault();closeMenu();}
   if(e.key==='Tab'&&mobileOpen){const elements=nav.current?.querySelectorAll<HTMLElement>('a[href],button,summary,[tabindex="0"]');const visible=[...(elements??[])].filter(element=>element.getClientRects().length);const first=visible[0],last=visible.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  }}><div className="mobile-menu-heading"><strong>เมนูทั้งหมด</strong></div><div ref={content} className="sidebar-nav-links">{children}</div><div className="mobile-menu-footer"><button type="button" className="secondary" onClick={closeMenu}>ปิดเมนู</button></div></nav>
  <div className="sidebar-scroll-controls" aria-label="เลื่อนเมนู"><button type="button" aria-label="เลื่อนเมนูขึ้น" disabled={!position.above} onClick={()=>scroll(-1)}>↑</button><span>เลื่อนดูเมนู</span><button type="button" aria-label="เลื่อนเมนูลง" disabled={!position.below} onClick={()=>scroll(1)}>↓</button></div>
  <div className="mobile-app-tabs" role="navigation" aria-label="ทางลัดบนมือถือ">{mobileLinks.map(link=><Link key={link.href} href={link.href} aria-current={pathname===link.href||(link.href!=='/admin'&&pathname.startsWith(link.href+'/'))?'page':undefined}><MobileIcon name={link.icon}/><span>{link.label}</span></Link>)}<button ref={menuButton} type="button" aria-expanded={mobileOpen} aria-controls="main-sidebar-menu" onClick={()=>setMobileOpen(!mobileOpen)}><MobileIcon name="menu"/><span>เมนู</span></button></div>
 </div>;
}
