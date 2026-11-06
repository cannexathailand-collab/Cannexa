import assert from 'node:assert/strict';import {test} from 'node:test';
import {buildCrmDashboard,type CrmDashboardCustomer} from '../src/lib/crm-dashboard';
const entry=(id:string,date:string,recognized:boolean,returned=false,profitSatang:number|null=200)=>({order:{id,eventAt:new Date(date)},recognized,returned,shipped:true,amountSatang:1000,profitSatang}) as CrmDashboardCustomer['history'][number];
test('CRM dashboard fills missing months, counts distinct buyers and sums weighted refusal rates',()=>{
 const a={code:'A',name:'A',tier:'Gold',history:[entry('1','2026-11-01T00:00Z',true),entry('2','2026-11-02T00:00Z',false,true)]};
 const b={code:'B',name:'B',tier:'Silver',history:[entry('3','2026-10-01T00:00Z',true,false,null),entry('4','2026-11-03T00:00Z',true)]};
 const data=buildCrmDashboard([a,b,a],new Date('2026-11-07T00:00Z'));
 assert.equal(data.customers,2);assert.equal(data.monthly.length,12);assert.equal(data.monthly[0].month,'2025-12');assert.equal(data.monthly.at(-1)!.buyers,2);assert.equal(data.monthly[0].revenueSatang,0);
 assert.equal(data.revenueSatang,3000);assert.equal(data.profitSatang,400);assert.equal(data.missingCosts,1);assert.equal(data.returnPercent,25);
 assert.equal(data.groups.reduce((n,g)=>n+g.count,0),2);assert.equal(data.groups.reduce((n,g)=>n+g.percent,0),100);
});
test('empty CRM has no invented refusal percentage and retains continuous month labels',()=>{
 const data=buildCrmDashboard([],new Date('2026-01-10T00:00Z'));assert.equal(data.returnPercent,null);assert.equal(data.customers,0);assert.equal(data.groups.length,0);assert.equal(data.monthly.at(-1)!.month,'2026-01');
});
