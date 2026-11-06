'use client';
import {useState} from 'react';
import type {TierSettings} from '@/lib/crm-tiers';
import {resolveTierRules,tierKeys,tierNames,tierMetrics,type TierRule} from '@/lib/crm-tier-rules';

function TierEditor({initial,editable,active}:{initial:TierRule;editable:boolean;active:boolean}){
 const [rule,setRule]=useState(initial),[values,setValues]=useState(initial.conditions.map(c=>String(c.value)));
 const [required,setRequired]=useState({monthlySpend:String(initial.required.monthlySpend),monthlyProfit:String(initial.required.monthlyProfit),membershipDays:String(initial.required.membershipDays),monthlyPurchases:String(initial.required.monthlyPurchases)});
 const update=(index:number,patch:Partial<TierRule['conditions'][number]>)=>setRule({...rule,conditions:rule.conditions.map((c,i)=>i===index?{...c,...patch}:c)});
 return <details className="card" open={active||undefined}>
  <summary><strong>{tierNames[rule.tier]}</strong> · {rule.enabled?'เกณฑ์บังคับ 4 ข้อ · เกณฑ์เสริม '+rule.conditions.length+' ข้อ':'ปิดระดับนี้'}</summary>
  <form action="/api/admin/crm/tiers" method="post">
   <input type="hidden" name="rule" value={JSON.stringify({...rule,required:{monthlySpend:Number(required.monthlySpend),monthlyProfit:Number(required.monthlyProfit),membershipDays:Number(required.membershipDays),monthlyPurchases:Number(required.monthlyPurchases)},conditions:rule.conditions.map((c,i)=>({...c,value:Number(values[i])}))})}/>
   <fieldset disabled={!editable} style={{border:0,padding:0,margin:0}}>
    <label><input type="checkbox" checked={rule.enabled} onChange={e=>setRule({...rule,enabled:e.target.checked})}/> เปิดใช้ระดับ {tierNames[rule.tier]}</label>
    <h2>เกณฑ์บังคับ ต้องผ่านครบทั้งสี่ข้อ</h2><div className="stats">
     <label>ยอดซื้อขั้นต่ำต่อเดือน (บาท)<input aria-label={tierNames[rule.tier]+' ยอดซื้อขั้นต่ำต่อเดือน'} type="number" min="0.01" step="0.01" required value={required.monthlySpend} onChange={e=>setRequired({...required,monthlySpend:e.target.value})}/></label>
     <label>กำไรขั้นต่ำต่อเดือน (บาท)<input aria-label={tierNames[rule.tier]+' กำไรขั้นต่ำต่อเดือน'} type="number" step="0.01" required value={required.monthlyProfit} onChange={e=>setRequired({...required,monthlyProfit:e.target.value})}/></label>
     <label>อายุสมาชิกขั้นต่ำ (วัน)<input aria-label={tierNames[rule.tier]+' อายุสมาชิกขั้นต่ำ'} type="number" min="0" step="1" required value={required.membershipDays} onChange={e=>setRequired({...required,membershipDays:e.target.value})}/></label>
     <label>จำนวนครั้งซื้อขั้นต่ำต่อเดือน<input aria-label={tierNames[rule.tier]+' จำนวนครั้งซื้อขั้นต่ำต่อเดือน'} type="number" min="1" step="1" required value={required.monthlyPurchases} onChange={e=>setRequired({...required,monthlyPurchases:e.target.value})}/></label>
    </div>
    <h2>เกณฑ์เพิ่มเติม</h2><p>ต้องผ่านทุกเกณฑ์ที่ตั้งไว้ รวมทั้งสี่เกณฑ์บังคับ หากขาดข้อใดข้อหนึ่งถือว่าไม่ผ่านรอบเดือนนั้น</p>
    {rule.conditions.map((c,index)=><div className="tier-condition-row" key={index}>
     <label>เกณฑ์<select aria-label={'เกณฑ์ '+tierNames[rule.tier]+' '+(index+1)} value={c.metric} onChange={e=>update(index,{metric:e.target.value as typeof c.metric})}>{tierMetrics.map(([key,label,unit])=><option key={key} value={key}>{label} ({unit})</option>)}</select></label>
     <label>เงื่อนไข<select aria-label={'เงื่อนไข '+tierNames[rule.tier]+' '+(index+1)} value={c.metric==='topPercent'?'lte':c.operator} disabled={c.metric==='topPercent'} onChange={e=>update(index,{operator:e.target.value as 'gte'|'lte'})}>{c.metric==='topPercent'?<option value="lte">อยู่ในกลุ่มบน</option>:<><option value="gte">อย่างน้อย</option><option value="lte">ไม่เกิน</option></>}</select></label>
     <label>ค่า ({tierMetrics.find(([key])=>key===c.metric)?.[2]})<input aria-label={'ค่า '+tierNames[rule.tier]+' '+(index+1)} type="number" min={c.metric==='topPercent'?'0.01':'0'} max={c.metric==='topPercent'?'100':'1000000000000'} step="any" required value={values[index]??''} onChange={e=>setValues(values.map((v,i)=>i===index?e.target.value:v))}/></label>
     <button type="button" className="secondary" aria-label={'ลบเกณฑ์ '+tierNames[rule.tier]+' '+(index+1)} onClick={()=>{setRule({...rule,conditions:rule.conditions.filter((_,i)=>i!==index)});setValues(values.filter((_,i)=>i!==index));}}>ลบ</button>
    </div>)}
    {!rule.conditions.length&&<p className="muted">ใช้เฉพาะเกณฑ์บังคับทั้งสี่ข้อ ไม่มีเกณฑ์เสริม</p>}
    <div className="actions"><button type="button" className="secondary" disabled={rule.conditions.length>=10} onClick={()=>{setRule({...rule,conditions:[...rule.conditions,{metric:'spend',operator:'gte',value:0}]});setValues([...values,'']);}}>เพิ่มเกณฑ์เสริม</button><button type="submit">บันทึก {tierNames[rule.tier]}</button></div>
   </fieldset>
  </form>
 </details>;
}
export function CrmTierSettings({settings,editable,activeTier}:{settings:TierSettings;editable:boolean;expanded?:boolean;activeTier?:string}){
 const rules=resolveTierRules(settings);
 return <><p>ตั้งค่าเกณฑ์บังคับและเกณฑ์เสริมของแต่ละระดับแยกกัน</p><p className="muted">ประเมินวันที่ 1 จากยอดซื้อสำเร็จของเดือนก่อนตามเวลาไทย แล้วคงระดับตลอดเดือน อายุสมาชิกนับจากข้อมูลแรกที่มี หากไม่ผ่านเกณฑ์บังคับข้อใดข้อหนึ่ง 2 เดือนติดกัน จะลดครั้งละ 1 ระดับ เมื่อผ่านหลายระดับจะได้ระดับสูงสุด: VIP Platinum → Gold → Silver → Bronze</p>{tierKeys.map(tier=><TierEditor key={tier} initial={rules.find(r=>r.tier===tier)!} editable={editable} active={activeTier===tier}/>)}<p className="muted">ลูกค้าที่ยังไม่มียอดซื้อสำเร็จอยู่ระดับลูกค้าใหม่ ผู้ที่ยังไม่ผ่านระดับใดจะแสดงว่ายังไม่เข้าเกณฑ์ เกณฑ์อันดับกลุ่มบนใช้ยอดซื้อสำเร็จสะสมของลูกค้าทั้งหมด ยอดเท่ากันใช้อันดับเดียวกัน ระดับประเมินเป็นรายเดือนและไม่เปลี่ยนกลางเดือน หากข้อมูลต้นทุนยังไม่ครบจะคงระดับเดิมไว้ก่อน</p></>;
}
