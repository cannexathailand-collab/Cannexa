import {customerLanguage} from '@/lib/customer-language-server';
import {db} from '@/lib/db';
import {CustomerRewardTable} from './reward-table';

export async function CustomerGreenCoin({customerCode,balance,readOnly=false}:{customerCode:string;balance:number;readOnly?:boolean}){
 const {t,locale,date:customerDate}=await customerLanguage();
 const [customer,rewards,redemptions]=await Promise.all([
  db.customer.findUniqueOrThrow({where:{code:customerCode},select:{title:true,name:true,phone:true,address:true}}),
  db.crmReward.findMany({where:{enabled:true,OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]},orderBy:[{points:'asc'},{name:'asc'}],select:{id:true,name:true,description:true,points:true,availableUnits:true,imageVersion:true,expiresAt:true}}),
  db.crmRewardRedemption.findMany({where:{customerCode},orderBy:{createdAt:'desc'},take:50,select:{id:true,rewardName:true,points:true,status:true,createdAt:true}}),
 ]);
 const statuses:Record<string,string>={PENDING:'รอส่งมอบ',FULFILLED:'ส่งมอบแล้ว',REJECTED:'ยกเลิกและคืนเหรียญแล้ว'};
 return <section className="portal-section">
  <h2>Green Coin</h2>
  <div className="portal-coin-summary"><span>{t("ยอดคงเหลือที่ใช้แลกได้")}</span><strong>{balance.toLocaleString(locale)}</strong><span>Green Coin</span></div>
  <h3 className="portal-coin-history-title">{t("ใช้ Green Coin แลกของรางวัล")}</h3>
  <CustomerRewardTable readOnly={readOnly} rewards={rewards.map(({expiresAt,...reward})=>({...reward,expiryLabel:expiresAt?'แลกได้ถึง '+customerDate(new Date(+expiresAt-1)):'ไม่กำหนดวันสิ้นสุด'}))} balance={balance} delivery={{recipient:[customer.title,customer.name].filter(Boolean).join(' '),phone:customer.phone??'',address:customer.address??''}}/>
  <h3 className="portal-coin-history-title">{t("ประวัติการแลก")}</h3>
  {redemptions.length?<div className="portal-coin-history">{redemptions.map(row=><article key={row.id}>
   <div><strong>{row.rewardName}</strong><small>{customerDate(row.createdAt)} · {t(statuses[row.status]??row.status)}</small></div>
   <b>{row.points.toLocaleString(locale)} Green Coin</b>
  </article>)}</div>:<p className="portal-muted">{t("ยังไม่มีรายการแลกของรางวัล")}</p>}
 </section>;
}
