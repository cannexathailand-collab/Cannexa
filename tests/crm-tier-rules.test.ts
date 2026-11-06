import assert from 'node:assert/strict';import {test} from 'node:test';
import {assignCustomerTiers,defaultTierSettings} from '../src/lib/crm-tiers';
import {defaultTierRules,tierRuleSchema} from '../src/lib/crm-tier-rules';
test('each tier supports multiple conditions, any/all matching, highest-tier priority and missing-data rejection',()=>{
 const rules=defaultTierRules(defaultTierSettings).map(r=>r.tier==='vip'?{...r,enabled:false}:r.tier==='gold'?{...r,conditions:[{metric:'spend' as const,operator:'gte' as const,value:1000},{metric:'frequency' as const,operator:'gte' as const,value:2}]}:r.tier==='silver'?{...r,conditions:[{metric:'spend' as const,operator:'gte' as const,value:500}]}:r);
 const customers=[{code:'a',purchasedSatang:200000,frequency:1},{code:'b',purchasedSatang:200000,frequency:3},{code:'c',purchasedSatang:10000},{code:'d',purchasedSatang:0}].map(c=>({...c,monthlySpendActual:c.purchasedSatang/100,monthlyPurchases:2,membershipDays:100,monthlyProfit:0}));
 let result=assignCustomerTiers(customers,{...defaultTierSettings,rules});assert.equal(result.get('a')!.name,'Silver');assert.equal(result.get('b')!.name,'Gold');assert.equal(result.get('c')!.name,'Bronze');assert.equal(result.get('d')!.name,'ลูกค้าใหม่');
 result=assignCustomerTiers(customers,{...defaultTierSettings,rules:rules.map(r=>r.tier==='gold'?{...r,match:'any'}:r)});assert.equal(result.get('a')!.name,'Gold');
 result=assignCustomerTiers(customers,{...defaultTierSettings,rules:rules.map(r=>r.tier==='gold'?{...r,conditions:[{metric:'profit',operator:'lte',value:1000}]}:r)});assert.equal(result.get('b')!.name,'Silver');
});
test('required monthly spend, age and purchase count cannot be bypassed by any-match extra criteria',()=>{
 const rules=defaultTierRules(defaultTierSettings).map(r=>({...r,required:{monthlySpend:1000,monthlyProfit:0,membershipDays:30,monthlyPurchases:2},conditions:[],match:'any' as const}));
 const base={code:'a',purchasedSatang:999999,monthlySpendActual:1000,monthlyPurchases:2,membershipDays:30,monthlyProfit:0};
 assert.equal(assignCustomerTiers([base],{...defaultTierSettings,rules}).get('a')!.name,'VIP Platinum');
 for(const change of [{monthlySpendActual:999},{monthlyPurchases:1},{membershipDays:29},{monthlyProfit:-1},{monthlyProfit:null}])assert.equal(assignCustomerTiers([{...base,...change}],{...defaultTierSettings,rules}).get('a')!.name,'ยังไม่เข้าเกณฑ์');
 const profitRules=rules.map(r=>({...r,conditions:[{metric:'monthlyProfit' as const,operator:'gte' as const,value:50}]}));
 assert.equal(assignCustomerTiers([{...base,profit:9999,monthlyProfit:null}],{...defaultTierSettings,rules:profitRules}).get('a')!.name,'ยังไม่เข้าเกณฑ์');
 assert.equal(assignCustomerTiers([{...base,monthlyProfit:50}],{...defaultTierSettings,rules:profitRules}).get('a')!.name,'VIP Platinum');
});
test('invalid criteria and missing required thresholds cannot be saved',()=>{
 const required={monthlySpend:1,monthlyProfit:0,membershipDays:0,monthlyPurchases:1};
 assert.equal(tierRuleSchema.safeParse({tier:'gold',enabled:true,match:'all',conditions:[]}).success,false);
 assert.equal(tierRuleSchema.safeParse({tier:'gold',enabled:true,required,match:'all',conditions:[{metric:'topPercent',operator:'lte',value:101}]}).success,false);
 assert.equal(tierRuleSchema.safeParse({tier:'gold',enabled:false,required,match:'all',conditions:[]}).success,true);
});
