import {customerLanguage} from '@/lib/customer-language-server';
import Image from 'next/image';
import {pointTierKey,pointTierNames} from '@/lib/crm-tier-points';

export async function MemberCard({level,name,code}:{level:string;name:string;code:string}){
 const {t}=await customerLanguage();
 const tier=pointTierKey(level);
 const badgeTier=tier==='new'?'bronze':tier;
 return <section className="portal-member" aria-label={t("บัตร Member")}>
  <h2>Member</h2>
  <div className={'portal-member-card portal-member-'+badgeTier}>
   <Image src={'/member/'+badgeTier+'.png'} alt={'Member '+pointTierNames[badgeTier]} width={1600} height={1024} sizes="(max-width: 600px) 60vw, 540px" preload/>
   <h1 className="portal-member-name">{name}</h1>
   <p className="portal-member-code"><span>{t("รหัสลูกค้า")}</span> <strong>{code}</strong></p>
  </div>
 </section>;
}
