import type {DocumentBrandingSnapshot} from '@/lib/document-branding';
export function DocumentBrandHeader({brand}:{brand?:DocumentBrandingSnapshot}){
 if(!brand||!brand.name&&!brand.logoPath)return null;
 return <div className="document-brand-header" style={{borderBottom:'1px solid '+brand.color,paddingBottom:12,marginBottom:20,display:'flex',alignItems:'center',gap:16}}>{brand.logoPath&&<img src={brand.logoPath} alt={brand.name||'โลโก้ร้าน'}/>}<strong style={{color:brand.color}}>{brand.name}</strong></div>;
}
