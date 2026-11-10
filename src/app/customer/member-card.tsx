import {PlatinumCardFrame} from './platinum-card-frame';
import {customerLanguage} from '@/lib/customer-language-server';
import Image from 'next/image';
import {pointTierKey,pointTierNames} from '@/lib/crm-tier-points';

export async function MemberCard({level,name,code}:{level:string;name:string;code:string}){
 const {t}=await customerLanguage();
 const tier=pointTierKey(level);
 const badgeTier=tier==='new'?'bronze':tier;
 if(tier==='vip')return <section className="portal-member platinum-member" aria-label={t('บัตร Member')}>
  <h2>Member</h2>
  <PlatinumCardFrame>
   <Image src="/member/vip.png" alt="Member VIP Platinum" width={1586} height={992} sizes="(max-width: 600px) 90vw, 550px" preload/>
   <h1 className="portal-member-name" title={name}>{name}</h1>
   <p className="portal-member-code"><span>{t('รหัสลูกค้า')}</span><strong>{code}</strong></p>
  </PlatinumCardFrame>
 </section>;
 return <section className="portal-member" aria-label={t("บัตร Member")}>
  <h2>Member</h2>
  <div className={'portal-member-card portal-member-'+badgeTier}>
   <Image src={'/member/'+badgeTier+'.png'} alt={'Member '+pointTierNames[badgeTier]} width={1600} height={1024} sizes="(max-width: 700px) 90vw, 550px" preload/>
   <h1 className="portal-member-name">{name}</h1>
   <p className="portal-member-code"><span>{t("รหัสลูกค้า")}</span> <strong>{code}</strong></p>
  </div>
 </section>;
}
