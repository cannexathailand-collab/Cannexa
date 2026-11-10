'use client';
import {createContext,useContext,type CSSProperties} from 'react';
import type {DocumentBrandingSnapshot} from '@/lib/document-branding';
const BrandingContext=createContext<DocumentBrandingSnapshot|null>(null);
export function StoreBrandProvider({brand,children}:{brand:DocumentBrandingSnapshot|null;children:React.ReactNode}){
 const style=brand?{'--store-color':brand.color} as CSSProperties:undefined;
 return <BrandingContext.Provider value={brand}><div className={brand?'store-branded':undefined} style={style}>{children}</div></BrandingContext.Provider>;
}
export function StoreBrand({fallback='Affiliate OS'}:{fallback?:string}){
 const brand=useContext(BrandingContext);
 return <span className="store-brand">{brand?.logoPath&&<img src={brand.logoPath} alt=""/>}<span>{brand?.name||fallback}</span></span>;
}
