import {test} from 'node:test';import assert from 'node:assert/strict';
import {cardSets,cardSetTitle,lineCardSelection,prepareLineCardDraft} from '../src/lib/line-card-draft';
import {db} from '../src/lib/db';
test('card sets contain each selected item once, at most five and no padding',()=>{
 for(const length of [0,1,2,3,5,7,13,50]){const items=Array.from({length},(_,i)=>i);const sets=cardSets(items);assert.deepEqual(sets.flat(),items);assert.ok(sets.every(s=>s.length>0&&s.length<=5));}
});
test('draft connects the selected SKU to its three images without leaking other images or claiming delivery',async t=>{
 const before={snapshot:db.employeeStockSnapshot.findUnique,images:db.stockProductImage.findMany,extras:db.stockProductExtraImage.findMany,line:db.lineConnection.findUnique,ai:db.openAiConnection.findUnique};
 t.after(()=>{db.employeeStockSnapshot.findUnique=before.snapshot;db.stockProductImage.findMany=before.images;db.stockProductExtraImage.findMany=before.extras;db.lineConnection.findUnique=before.line;db.openAiConnection.findUnique=before.ai;});
 (db.openAiConnection as any).findUnique=async()=>null;
 (db.employeeStockSnapshot as any).findUnique=async()=>({rows:[{code:'A1',name:'Test product',available:10,prices:[{pack:'10G',priceSatang:30000}]}],fetchedAt:new Date()});
 (db.stockProductImage as any).findMany=async()=>[{code:'A1',imageVersion:'a'.repeat(64)}];
 (db.stockProductExtraImage as any).findMany=async({where}:any)=>{assert.equal(where.code.in.length,1);return where.code.in.includes('A1')?[{code:'A1',slot:2,imageVersion:'b'.repeat(64)}]:[];};
 (db.lineConnection as any).findUnique=async()=>({encrypted:''});
 const draft=await prepareLineCardDraft({codes:['A1']});
 assert.equal(draft.sets.length,1);const p=draft.sets[0].products[0];
 assert.equal(p.keyword,'A1');assert.deepEqual(p.missingImageSlots,[3]);assert.equal(p.images[2].url,null);
 assert.match(p.images[0].url!,/slot=1/);assert.match(p.images[1].url!,/slot=2/);
 assert.equal(p.prices[0].priceSatang,30000);assert.equal(draft.delivery.savedToLineOA,false);
 await assert.rejects(prepareLineCardDraft({codes:['NOPE']}),/PRODUCT_NOT_FOUND/);
});
test('selection rejects duplicate normalized codes and titles use Bangkok date',()=>{
 assert.equal(lineCardSelection.safeParse({codes:['a1',' A1 ']}).success,false);
 assert.equal(lineCardSelection.safeParse({codes:[]}).success,false);
 assert.equal(cardSetTitle(['AE01','AE05'],new Date('2026-11-12T18:00:00Z')),'New Arrivals 13/11/2026 | AE01–AE05');
 assert.ok(cardSetTitle(['A'.repeat(50),'B'.repeat(50)]).length<=100);
});
