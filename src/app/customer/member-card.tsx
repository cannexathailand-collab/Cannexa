import {customerLanguage} from '@/lib/customer-language-server';
import Image from 'next/image';
import {pointTierKey,pointTierNames} from '@/lib/crm-tier-points';

export async function MemberCard({level,name,code}:{level:string;name:string;code:string}){
 const {t}=await customerLanguage();
 const tier=pointTierKey(level);
 const badgeTier=tier==='new'?'bronze':tier;
 if(tier==='vip')return <section className="portal-member platinum-member" aria-label={t('บัตร Member')}>
  <header className="platinum-member-heading"><h2>{t('สมาชิกระดับพิเศษ')}</h2><span>VIP PLATINUM</span></header>
  <div className="portal-member-card portal-member-vip">
   <div className="platinum-card-face">
    <div className="platinum-card-top"><span>CANNEXA</span><span className="platinum-card-seal" aria-hidden="true">C</span></div>
    <div className="platinum-card-tier"><span>VIP MEMBERSHIP</span><strong>Platinum</strong></div>
    <footer className="platinum-card-footer">
     <div className="platinum-card-holder"><span>{t('ชื่อสมาชิก')}</span><h1 className="portal-member-name" title={name}>{name}</h1></div>
     <p className="portal-member-code"><span>{t('รหัสลูกค้า')}</span><strong>{code}</strong></p>
    </footer>
   </div>
  </div>
 </section>;
 return <section className="portal-member" aria-label={t("บัตร Member")}>
  <h2>Member</h2>
  <div className={'portal-member-card portal-member-'+badgeTier}>
   <Image src={'/member/'+badgeTier+'.png'} alt={'Member '+pointTierNames[badgeTier]} width={1600} height={1024} sizes="(max-width: 600px) 60vw, 540px" preload/>
   <h1 className="portal-member-name">{name}</h1>
   <p className="portal-member-code"><span>{t("รหัสลูกค้า")}</span> <strong>{code}</strong></p>
  </div>
 </section>;
}
