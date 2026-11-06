import assert from 'node:assert/strict';import {test} from 'node:test';
import {filterAndSortCustomers} from '../src/lib/crm-customer-filters';
const rows=[{code:'a',spend:9000,profit:500,points:10,monthly:900,frequency:1,gap:30},{code:'b',spend:5000,profit:900,points:30,monthly:500,frequency:3,gap:10},{code:'c',spend:0,profit:0,points:0,monthly:0,frequency:0,gap:null}];
test('CRM defaults to monthly purchase frequency rather than lifetime order value',()=>{assert.deepEqual(filterAndSortCustomers(rows,{}).map(c=>c.code),['b','a','c']);assert.deepEqual(rows.map(c=>c.code),['a','b','c']);});
test('CRM combines numeric filters before sorting and puts unknown gaps last',()=>{
 assert.deepEqual(filterAndSortCustomers(rows,{spendMin:'1000',profitMin:'600',pointsMax:'40',frequencyMin:'2',gapMax:'15'}).map(c=>c.code),['b']);
 assert.deepEqual(filterAndSortCustomers(rows,{sort:'spendDesc'}).map(c=>c.code),['a','b','c']);
 assert.deepEqual(filterAndSortCustomers(rows,{sort:'gapAsc'}).map(c=>c.code),['b','a','c']);
 assert.equal(filterAndSortCustomers(rows,{gapMax:'20'}).length,1);
 assert.throws(()=>filterAndSortCustomers(rows,{spendMin:'x'}));
 assert.equal(filterAndSortCustomers([{...rows[0],profit:null}],{profitMin:'0'}).length,0);
});
