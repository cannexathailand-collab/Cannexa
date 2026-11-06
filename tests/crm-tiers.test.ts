import assert from 'node:assert/strict';import {test} from 'node:test';
import {assignCustomerTiers,validTierSettings} from '../src/lib/crm-tiers';
const active=(rows:{code:string;purchasedSatang:number}[])=>rows.map(c=>({...c,monthlySpendActual:c.purchasedSatang/100,monthlyPurchases:c.purchasedSatang>0?1:0,membershipDays:365,monthlyProfit:0}));
test('tiers use lifetime purchase rank with top 20 percent VIP and zero-purchase new customers',()=>{
 const customers=Array.from({length:100},(_,i)=>({code:String(i),purchasedSatang:100-i}));customers.push({code:'new',purchasedSatang:0});
 const result=assignCustomerTiers(active(customers)),counts=new Map<string,number>();for(const row of result.values())counts.set(row.name,(counts.get(row.name)??0)+1);
 assert.deepEqual(Object.fromEntries(counts),{'VIP Platinum':20,Gold:20,Silver:30,Bronze:30,'ลูกค้าใหม่':1});
});
test('ties keep the same tier, and rank changes when spending changes',()=>{
 const input=[{code:'a',purchasedSatang:100},{code:'b',purchasedSatang:100},{code:'c',purchasedSatang:50}];
 const tiers=assignCustomerTiers(active(input));assert.equal(tiers.get('a')!.name,tiers.get('b')!.name);assert.equal(tiers.get('c')!.name,'Silver');
 assert.equal(assignCustomerTiers(active([...input,{code:'c',purchasedSatang:200}])).get('c')!.name,'VIP Platinum');
 assert.equal(validTierSettings({vipTopPercent:50,goldTopPercent:20,silverTopPercent:70}),false);
});
