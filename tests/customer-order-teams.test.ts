import assert from 'node:assert/strict';
import {test} from 'node:test';
import {customerOrderTeams} from '../src/lib/customer-order-teams';
test('customer teams use linked order groups and bot names, preserving multiple teams without repeated orders',()=>{
 assert.deepEqual(customerOrderTeams([{groupKey:'one'},{groupKey:'one'},{groupKey:'two'}],[{id:'one',botId:'hub',name:'Happy Farm'},{id:'two',botId:'house',name:'Sales'}],[{botId:'hub',name:'Green Hub'},{botId:'house',name:'Green House'}]),['Green Hub · Happy Farm','Green House · Sales']);
 assert.deepEqual(customerOrderTeams([],[],[]),[]);assert.deepEqual(customerOrderTeams([{groupKey:'missing'}],[],[]),['ไม่พบข้อมูลทีม']);
});
