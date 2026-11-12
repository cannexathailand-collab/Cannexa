import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifiedResearchUrls} from '../src/lib/product-research';
test('a completed direct page open verifies the selected reference without a search',()=>{
 const url='https://example.com/selected-reference';
 assert.equal(verifiedResearchUrls([{type:'web_search_call',status:'completed',action:{type:'open_page',url}}]).has(url),true);
 assert.equal(verifiedResearchUrls([{type:'web_search_call',status:'failed',action:{type:'open_page',url}}]).has(url),false);
 assert.equal(verifiedResearchUrls([{type:'message',content:[{type:'output_text',text:url}]}]).has(url),false);
});
