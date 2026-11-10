import test from 'node:test';
import assert from 'node:assert/strict';
import {executiveTrendRange} from '../src/lib/executive-trend';

test('a selected round defaults the trend to its entire calendar month',()=>{
 assert.deepEqual(executiveTrendRange('2026-11-10','2026-11-10'),{from:'2026-11-01',to:'2026-11-30',days:30});
 assert.deepEqual(executiveTrendRange('2026-12-31','2026-12-31'),{from:'2026-12-01',to:'2026-12-31',days:31});
 assert.deepEqual(executiveTrendRange('2026-02-10','2026-02-10'),{from:'2026-02-01',to:'2026-02-28',days:28});
 assert.deepEqual(executiveTrendRange('2028-02-10','2028-02-10'),{from:'2028-02-01',to:'2028-02-29',days:29});
});

test('an explicit multi-round filter keeps its selected trend range',()=>{
 assert.deepEqual(executiveTrendRange('2026-10-29','2026-11-02'),{from:'2026-10-29',to:'2026-11-02',days:5});
});
