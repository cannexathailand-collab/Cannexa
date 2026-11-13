import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canConfirmPreview,confirmPreview,editCardDetails,replacePreviewResearch,previewSummary,type CardPreviewProduct} from '../src/lib/line-card-preview-state';

const product:CardPreviewProduct={code:'TEST01',name:'Test cup',images:[],keyword:'TEST01',missingImageSlots:[],previewToken:'signed-preview',research:{text:'Example',sources:['https://example.com'],needsReview:true}};
test('preview confirmation requires a usable result and is cleared by a new search',()=>{
 assert.equal(canConfirmPreview({...product,research:undefined}),false);
 assert.equal(canConfirmPreview({...product,research:{...product.research!,sources:[]}}),false);
 assert.equal(canConfirmPreview({...product,researchError:'Search failed'}),false);
 const confirmed=confirmPreview(product);
 assert.equal(confirmed.confirmed,true);
 assert.equal(product.confirmed,undefined);
 assert.equal(previewSummary([confirmed]),'ยืนยันข้อมูลตัวอย่างแล้ว · 1 รายการ');
 const replacement=replacePreviewResearch(confirmed,{text:'New example',sources:['https://example.com/new'],needsReview:false});
 assert.equal(replacement.confirmed,false);
 assert.equal(replacement.research?.text,'New example');
 assert.equal(previewSummary([replacement]),'เตรียมตัวอย่างแล้ว · ยืนยันข้อมูล 0/1 รายการ');
});

test('editing one card keeps its own fields and requires confirmation again',()=>{
 const old=confirmPreview({...product,description:'Old description',linkUrl:'https://example.com/old'});
 const edited=editCardDetails(old,{description:'New description',linkUrl:'https://example.com/new'});
 assert.equal(edited.confirmed,false);assert.equal(edited.description,'New description');
 assert.equal(edited.research,old.research);assert.equal(old.description,'Old description');
 assert.equal(edited.code,old.code);
});
