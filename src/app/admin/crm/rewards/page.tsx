import {randomUUID} from 'node:crypto';
import {requireAdminPage} from '@/lib/auth';
import {managers,approvers} from '@/lib/accounts';
import {db} from '@/lib/db';
import {displayCustomerCode} from '@/lib/customer-code';
import {crmDate} from '@/lib/customer-crm';
import {RewardEditor,RedemptionActions} from './reward-editor';
import './rewards.css';

export default async function RewardsPage(){
 const actor=await requireAdminPage(managers);
 const editable=approvers.includes(actor.role as typeof approvers[number]);
 const [rewards,redemptions]=await Promise.all([
  db.crmReward.findMany({orderBy:{createdAt:'desc'}}),
  db.crmRewardRedemption.findMany({orderBy:{createdAt:'desc'},take:100}),
 ]);
 const statuses:Record<string,string>={PENDING:'รอส่งมอบ',FULFILLED:'ส่งมอบแล้ว',REJECTED:'ยกเลิกและคืนเหรียญแล้ว'};
 return <>
  <h1>ของรางวัล Green Coin</h1>
  <p>ตั้งค่ารายการที่แสดงในหน้า Customer และจัดการรายการแลก</p>
  <details className="card"><summary>เพิ่มของรางวัล</summary><RewardEditor requestKey={randomUUID()} editable={editable}/></details>
  <section className="card"><h2>รายการของรางวัล</h2>{!rewards.length&&<p>ยังไม่มีของรางวัล</p>}<div className="reward-admin-list">{rewards.map(reward=><details key={reward.id}><summary><strong>{reward.name}</strong><span>{reward.points.toLocaleString('th-TH')} Green Coin · พร้อมแลก {reward.availableUnits} ชิ้น · {reward.enabled?'เปิดอยู่':'ปิดอยู่'}</span></summary><RewardEditor reward={{...reward,updatedAt:reward.updatedAt.toISOString()}} requestKey={reward.requestKey} editable={editable}/></details>)}</div></section>
  <section className="card"><h2>รายการแลกล่าสุด</h2>{!redemptions.length&&<p>ยังไม่มีรายการแลก</p>}<div className="reward-admin-list">{redemptions.map(row=><article key={row.id}><header><strong>{row.rewardName}</strong><span className="pill">{statuses[row.status]??row.status}</span></header><p>{row.points.toLocaleString('th-TH')} Green Coin · {crmDate(row.createdAt)}</p><p>{row.recipient} · {displayCustomerCode(row.customerCode)} · {row.phone}</p><p>{row.address}</p>{editable&&row.status==='PENDING'&&<RedemptionActions id={row.id}/>}</article>)}</div></section>
 </>;
}
