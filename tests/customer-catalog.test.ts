import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {customerCatalogPrices,loadCustomerCatalog} from '../src/lib/customer-catalog';

test('catalog prices normalize units, preserve zero, and remove invalid or ambiguous packages',()=>{
 assert.deepEqual(customerCatalogPrices([
  {pack:' 1 kg ',priceSatang:50000},
  {pack:'1000G',priceSatang:60000},
  {pack:'10 กรัม',priceSatang:1000},
  {pack:'20G',priceSatang:0},
  {pack:'30G',priceSatang:-1},
  {pack:'40G',priceSatang:1.5},
  {pack:'50G',priceSatang:'500'},
  {pack:'invalid',priceSatang:500},
  {pack:'0.5G',priceSatang:50},
  {pack:'0G',priceSatang:500},
  null,
 ]),[{pack:'0.5G',grams:0.5,priceSatang:50},{pack:'10G',grams:10,priceSatang:1000},{pack:'20G',grams:20,priceSatang:0}]);
 assert.deepEqual(customerCatalogPrices({}),[]);
 assert.deepEqual(customerCatalogPrices([{pack:'10g',priceSatang:100},{pack:'10 G',priceSatang:-100}]),[]);
});

test('catalog DTO reads stored snapshot and image versions without leaking internal stock fields',async t=>{
 const originalSnapshot=db.employeeStockSnapshot.findUnique,originalImages=db.stockProductImage.findMany;
 const originalSettings=db.shopCatalogSettings.findUnique,originalSales=db.salesOrder.findMany;
 db.shopCatalogSettings.findUnique=(async()=>null) as typeof originalSettings;
 db.salesOrder.findMany=(async()=>[]) as typeof originalSales;
 t.after(()=>{db.employeeStockSnapshot.findUnique=originalSnapshot;db.stockProductImage.findMany=originalImages;db.shopCatalogSettings.findUnique=originalSettings;db.salesOrder.findMany=originalSales;});
 const fetchedAt=new Date('2026-11-07T01:00:00Z');
 (db.employeeStockSnapshot as any).findUnique=async()=>({fetchedAt,rows:[
  {code:'B2',name:'  Product B  ',available:12.5,remaining:999,costSatang:111,sourceRow:23,prices:[{pack:'1 KG',priceSatang:10000}],secret:'hidden'},
  {code:'A1',name:'Product A',available:-10,remaining:100,costSatang:222,prices:[{pack:'10g',priceSatang:0}]},
  {code:'C3',name:null,available:'50',prices:[]},
  {code:'D4',name:'Duplicate first',available:10,prices:[]},
  {code:'d4',name:'Duplicate second',available:20,prices:[]},
  {code:'bad/code',name:'Invalid code',available:50,prices:[]},
  null,
 ]});
 (db.stockProductImage as any).findMany=async({where,select}:any)=>{
  assert.deepEqual(where.code.in,['A1','B2','C3']);
  assert.deepEqual(select,{code:true,imageVersion:true});
  return [{code:'B2',imageVersion:'a'.repeat(64)}];
 };
 const result=await loadCustomerCatalog();
 assert.deepEqual(result,{readAt:fetchedAt.toISOString(),products:[
  {code:'A1',name:'Product A',available:0,prices:[{pack:'10G',grams:10,priceSatang:0}],imageVersion:null},
  {code:'B2',name:'Product B',available:12.5,prices:[{pack:'1000G',grams:1000,priceSatang:10000}],imageVersion:'a'.repeat(64)},
  {code:'C3',name:null,available:null,prices:[],imageVersion:null},
 ]});
 const json=JSON.stringify(result);
 for(const key of ['cost','remaining','sourceRow','secret','imageData'])assert.ok(!json.includes(key));
 (db.employeeStockSnapshot as any).findUnique=async()=>null;
 assert.deepEqual(await loadCustomerCatalog(),{products:[],readAt:null});
});
