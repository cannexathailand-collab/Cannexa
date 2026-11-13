import type {Page} from 'playwright-core';
import {db} from './db';
import {type OaPayload,artifactFingerprint} from './line-oa-job';
import {syncReplyVideo,verifyReplyVideo,recordReplyVideo} from './line-oa-video';
import {reportOaProgress} from './line-oa-progress';
import {customerAccountLabel,customerAccountUrl} from './line-oa-links';

type Product=OaPayload['sets'][number]['products'][number];
export function oaCardDescription(product:Pick<Product,'priceSatang'|'description'>){
 return product.description?.trim()|| (product.priceSatang===undefined?'ดูรายละเอียดสินค้า':'ราคา '+new Intl.NumberFormat('th-TH',{minimumFractionDigits:product.priceSatang%100?2:0,maximumFractionDigits:2}).format(product.priceSatang/100)+' บาท');
}
export function managerUrl(account:string,path=''){
 if(!/^@[a-zA-Z0-9._-]+$/.test(account))throw Error('OA_ACCOUNT_INVALID');
 return 'https://manager.line.biz/account/'+account+(path?'/'+path:'');
}
export async function verifyManager(page:Page,account:string){
 await page.goto(managerUrl(account),{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'ช่วยเหลือ',exact:true}).waitFor({timeout:20000}).catch(()=>{});
 if(!page.url().startsWith(managerUrl(account))||!await page.getByText(account,{exact:true}).count())throw Error('OA_LOGIN_REQUIRED');
}
async function dismissManagerGuide(page:Page){
 const finish=page.getByText('จบการแนะนำ',{exact:true});
 if(await finish.waitFor({state:'visible',timeout:2500}).then(()=>true,()=>false))await finish.click();
}
export async function openManagerItem(page:Page,account:string,kind:'cardtypemessage'|'autoresponse',name:string,remoteId?:string){
 if(remoteId){
  if(!/^\d+$/.test(remoteId))throw Error('OA_ARTIFACT_INVALID');
  await page.goto(managerUrl(account,kind+'/edit/'+remoteId),{waitUntil:'domcontentloaded'});
  const title=page.getByPlaceholder(kind==='cardtypemessage'?'ใส่ชื่อไอเทม':'ใส่ชื่อ',{exact:true});
  const loaded=await title.waitFor({state:'visible',timeout:5000}).then(()=>true,()=>false);
  if(loaded){
  // The control can exist before OA hydrates the saved item.
  const deadline=Date.now()+20000;
  while(await title.inputValue()!==name&&Date.now()<deadline)await page.waitForTimeout(250);
  const savedTitle=await title.inputValue();
  if(savedTitle===name)return false;
  // Deleted cards can still render an empty edit form at their old URL.
  // A real, differently named item must remain protected from overwrite.
  if(savedTitle.trim())throw Error('OA_ARTIFACT_CHANGED');
  }
  // A user may delete the item in OA. Reconcile by exact title in the list
  // before creating anything, rather than trusting the old remote identifier.
 }
 await page.goto(managerUrl(account,kind),{waitUntil:'domcontentloaded'});
 if(kind==='cardtypemessage')await dismissManagerGuide(page);
 const filter=page.getByPlaceholder(kind==='cardtypemessage'?'ใส่ชื่อไอเทม':'ใส่คีย์เวิร์ด',{exact:true});
 await filter.fill(name);await page.getByRole('button',{name:'',exact:true}).click();
 await page.waitForTimeout(1000);await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
 const items=page.locator('main table').getByRole('link',{name,exact:true});
 if(await items.count()>1)throw Error('OA_DUPLICATE_ITEM');
 if(await items.count()===1){await items.click();return false;}
 await page.getByRole(kind==='cardtypemessage'?'button':'link',{name:'สร้างใหม่',exact:true}).click();
 await page.waitForURL(new RegExp('/'+kind+'/create(?:[?#]|$)'),{timeout:20000});
 return true;
}
export function matchesReplyCode(keywords:string[],code:string){return keywords.length===1&&keywords[0]===code;}
export async function openReplyByCode(page:Page,account:string,code:string,remoteId?:string){
 const readKeywords=async()=>{
  const input=page.locator('input[name="keyword[]"]');
  if(!await input.first().waitFor({state:'attached',timeout:5000}).then(()=>true,()=>false))return [];
  const deadline=Date.now()+10000;let values:string[]=[];
  do{values=await input.evaluateAll(nodes=>nodes.map(node=>(node as HTMLInputElement).value));if(values.some(value=>value.length))return values;await page.waitForTimeout(100);}while(Date.now()<deadline);
  return values;
 };
 if(remoteId){
  if(!/^\d+$/.test(remoteId))throw Error('OA_ARTIFACT_INVALID');
  await page.goto(managerUrl(account,'autoresponse/edit/'+remoteId),{waitUntil:'domcontentloaded'});
  const keywords=await readKeywords();
  if(matchesReplyCode(keywords,code))return false;
  if(keywords.includes(code))throw Error('OA_KEYWORD_CONFLICT');
 }
 await reportOaProgress('กำลังค้นข้อความตอบกลับด้วยรหัสสินค้า '+code);
 await page.goto(managerUrl(account,'autoresponse'),{waitUntil:'domcontentloaded'});
 await page.getByPlaceholder('ใส่คีย์เวิร์ด',{exact:true}).fill(code);
 await page.getByRole('button',{name:'',exact:true}).click();
 await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});await page.waitForTimeout(500);
 const hrefs=await page.locator('main table a[href*="/autoresponse/edit/"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')??''));
 const ids=[...new Set(hrefs.map(href=>{const url=new URL(href,'https://manager.line.biz');const id=url.pathname.split('/').at(-1);return id&&/^\d+$/.test(id)&&url.href===managerUrl(account,'autoresponse/edit/'+id)?id:null;}).filter((id):id is string=>id!==null))];
 if(ids.length>50)throw Error('OA_TOO_MANY_MATCHES');
 const matches:string[]=[];
 for(const id of ids){
  await page.goto(managerUrl(account,'autoresponse/edit/'+id),{waitUntil:'domcontentloaded'});
  const keywords=await readKeywords();
  if(keywords.includes(code)&&!matchesReplyCode(keywords,code))throw Error('OA_KEYWORD_CONFLICT');
  if(matchesReplyCode(keywords,code))matches.push(id);
 }
 if(matches.length>1)throw Error('OA_DUPLICATE_ITEM');
 if(matches.length){await page.goto(managerUrl(account,'autoresponse/edit/'+matches[0]),{waitUntil:'domcontentloaded'});if(!matchesReplyCode(await readKeywords(),code))throw Error('OA_KEYWORD_CONFLICT');return false;}
 await page.goto(managerUrl(account,'autoresponse'),{waitUntil:'domcontentloaded'});
 await page.getByRole('link',{name:'สร้างใหม่',exact:true}).click();
 await page.waitForURL(new RegExp('/autoresponse/create(?:[?#]|$)'),{timeout:20000});return true;
}
async function checkbox(page:Page,label:string,value:boolean){
 const control=page.getByRole('checkbox',{name:label,exact:true});
 if(await control.isChecked()!==value){
  await page.locator('label.custom-control-label').filter({hasText:new RegExp('^'+label+'$')}).click();
  if(await control.isChecked()!==value)throw Error('OA_OPTION_NOT_ACCEPTED');
 }
}
export async function savedId(page:Page,kind:string,name:string){
 // Saving a new item navigates asynchronously to the list. Do not inspect
 // the old /create URL and then wait for an edit URL that cannot arrive.
 await page.waitForURL(new RegExp('/'+kind+'(?:/edit/\\d+)?(?:[?#]|$)'),{timeout:30000,waitUntil:'domcontentloaded'}).catch(()=>{throw Error('OA_SAVE_UNCONFIRMED');});
 await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{});
 if(new URL(page.url()).pathname.endsWith('/'+kind)){
  const filter=page.getByPlaceholder(kind==='cardtypemessage'?'ใส่ชื่อไอเทม':'ใส่คีย์เวิร์ด',{exact:true});
  await filter.fill(name);await page.getByRole('button',{name:'',exact:true}).click();
  await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{});
  const found=page.locator('main table').getByRole('link',{name,exact:true});
  await found.first().waitFor({state:'visible',timeout:15000}).catch(()=>{throw Error('OA_SAVE_UNCONFIRMED');});
  if(await found.count()!==1)throw Error('OA_SAVE_UNCONFIRMED');await found.click();
 }
 await page.waitForURL(new RegExp('/'+kind+'/edit/\\d+'),{timeout:30000});
 const id=page.url().match(/\/edit\/(\d+)/)?.[1];if(!id)throw Error('OA_SAVE_UNCONFIRMED');return id;
}
export async function saveReplyEditor(page:Page){
 const apply=page.getByRole('button',{name:'ใช้การเปลี่ยนแปลง',exact:true}).last();
 const requiresConfirmation=await apply.isVisible();
 if(requiresConfirmation){
  await apply.click();
  await page.getByRole('heading',{name:'ต้องการใช้การเปลี่ยนแปลงหรือไม่',exact:true}).waitFor({state:'visible',timeout:10000});
  await page.getByRole('button',{name:'ใช้การเปลี่ยนแปลง',exact:true}).last().click();
 }else await page.getByRole('button',{name:'บันทึก',exact:true}).last().click();
}
export async function activateReply(page:Page){
 const start=page.getByRole('button',{name:'เริ่มใช้งาน',exact:true});
 if(await start.count()){
  await start.last().click();
  await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{});
  // Read the persisted state after activation instead of relying on a stale
  // in-page button that can stay visible after the server accepted it.
  await page.reload({waitUntil:'domcontentloaded'});
 }
 await page.getByRole('button',{name:'หยุดใช้งาน',exact:true}).last().waitFor({state:'visible',timeout:20000}).catch(()=>{throw Error('OA_REPLY_ACTIVATION_VERIFY_FAILED');});
}
export async function saveManagerReply(page:Page,account:string,product:Product){
 await reportOaProgress('กำลังเปิดข้อความ '+product.code);
 console.info('OA reply stage: FIND');
 if(!product.research||product.research.needsReview)throw Error('OA_REVIEW_REQUIRED');
 const known=await db.lineOaArtifact.findUnique({where:{account_kind_key:{account,kind:'reply',key:product.code}}});
 await openReplyByCode(page,account,product.code,known?.remoteId);
 console.info('OA reply stage: EDIT');
 await page.getByPlaceholder('ใส่ชื่อ',{exact:true}).fill(product.replyTitle);
 const keywordMode=page.getByRole('radio',{name:'ตอบกลับตามคีย์เวิร์ด',exact:true});
 if(!await keywordMode.isChecked())await page.locator('label.custom-control-label').filter({hasText:/^ตอบกลับตามคีย์เวิร์ด$/}).click();
 const keywords=await page.locator('input[name="keyword[]"]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value));
 if(keywords.length&&JSON.stringify(keywords)!==JSON.stringify([product.code]))throw Error('OA_KEYWORD_CONFLICT');
 if(!keywords.length){await page.locator('input[name="keyword-suggestions"]').fill(product.code);await page.getByRole('button',{name:'เพิ่ม',exact:true}).click();}
 const editor=page.getByRole('textbox',{name:'ใส่ข้อความ',exact:true});
 if(await editor.count()!==1)throw Error('OA_TEXT_LAYOUT_CHANGED');
 const existingText=await editor.inputValue();
 const video=await syncReplyVideo(page,account,product.code);
 // Video refreshes may preserve this item's existing text, as requested.
 const textToSave=video&&existingText.trim()?existingText:product.research.text;
 // Adding or reordering a message remounts OA's text editor. Enter the text
 // after that operation so the saved editor model cannot revert to old text.
 await editor.click();await editor.press('ControlOrMeta+A');await editor.pressSequentially(textToSave);
 const value=await editor.inputValue();if(value!==textToSave)throw Error('OA_TEXT_NOT_ACCEPTED');
 console.info('OA reply stage: SAVE');
 await reportOaProgress('กำลังบันทึกข้อความ '+product.code);
 await saveReplyEditor(page);
 const id=await savedId(page,'autoresponse',product.replyTitle);
 await reportOaProgress('กำลังเปิดตรวจข้อความที่บันทึก '+product.code);
 await page.reload({waitUntil:'domcontentloaded'});
 // OA loads the saved message after the initial document and form controls.
 // Wait for those values, rather than treating the first empty form as failure.
 const deadline=Date.now()+20000;let name='',savedText='';
 while(Date.now()<deadline){
  name=await page.getByPlaceholder('ใส่ชื่อ',{exact:true}).inputValue();
  savedText=await editor.inputValue();
  if(name===product.replyTitle&&savedText===textToSave)break;
  await page.waitForTimeout(250);
 }
 if(name!==product.replyTitle)throw Error('OA_NAME_VERIFY_FAILED');
 if(savedText!==textToSave)throw Error('OA_TEXT_VERIFY_FAILED');
 if(video)await verifyReplyVideo(page);
 await reportOaProgress('กำลังยืนยันการเปิดใช้งานข้อความ '+product.code);
 await activateReply(page);
 const fingerprint=artifactFingerprint({text:savedText});
 await db.lineOaArtifact.upsert({where:{account_kind_key:{account,kind:'reply',key:product.code}},create:{account,kind:'reply',key:product.code,remoteId:id,fingerprint},update:{remoteId:id,fingerprint}});
 if(video){await recordReplyVideo(account,product.code,video);await reportOaProgress('วิดีโอ '+product.code+' สำเร็จแล้ว');}
 return {kind:'reply',code:product.code,url:managerUrl(account,'autoresponse/edit/'+id),video:video?'synced':'not-found'};
}
async function uploadCardImage(page:Page,product:Product,slot:number){
 await reportOaProgress('กำลังอัปโหลดรูป '+slot+'/3 ของการ์ด '+product.code);
 console.info('OA card image stage: LOAD',slot);
 const image=slot===1?await db.stockProductImage.findUnique({where:{code:product.code}}):await db.stockProductExtraImage.findUnique({where:{code_slot:{code:product.code,slot}}});
 if(!image)throw Error('OA_IMAGES_MISSING');
 if(!['image/jpeg','image/png'].includes(image.imageMime))throw Error('OA_IMAGE_FORMAT');
 const letter=['A','B','C'][slot-1],link=page.getByRole('link',{name:letter,exact:true});
 if(!await link.count())await page.getByRole('button',{name:'',exact:true}).nth(slot-1).click();
 await link.click();console.info('OA card image stage: DIALOG',slot);
 await page.getByRole('heading',{name:'อัปโหลดรูป',exact:true}).waitFor({state:'visible',timeout:15000}).catch(()=>{throw Error('OA_IMAGE_DIALOG_FAILED');});
 const [chooser]=await Promise.all([page.waitForEvent('filechooser',{timeout:15000}),page.getByText('เลือกไฟล์',{exact:true}).click()]).catch(()=>{throw Error('OA_IMAGE_PICKER_FAILED');});
 await chooser.setFiles({name:'product-'+slot+(image.imageMime==='image/png'?'.png':'.jpg'),mimeType:image.imageMime,buffer:Buffer.from(image.imageData)}).catch(()=>{throw Error('OA_IMAGE_FILE_FAILED');});
 await page.getByRole('heading',{name:'ครอบตัด',exact:true}).waitFor({state:'visible',timeout:30000}).catch(()=>{throw Error('OA_IMAGE_CROP_FAILED');});
 console.info('OA card image stage: CROP',slot);
 await page.getByRole('button',{name:'ใช้',exact:true}).click({timeout:30000}).catch(()=>{throw Error('OA_IMAGE_APPLY_FAILED');});
 await page.getByRole('heading',{name:'ครอบตัด',exact:true}).waitFor({state:'hidden',timeout:30000}).catch(()=>{throw Error('OA_IMAGE_UPLOAD_FAILED');});
 await link.waitFor({state:'hidden',timeout:30000}).catch(()=>{throw Error('OA_IMAGE_READY_FAILED');});
}
export async function saveManagerCards(page:Page,account:string,set:OaPayload['sets'][number]){
 await reportOaProgress('กำลังเปิดชุดการ์ด '+set.title);
 console.info('OA card stage: FIND');
 const known=await db.lineOaArtifact.findUnique({where:{account_kind_key:{account,kind:'cards',key:set.title}}});
 const fresh=await openManagerItem(page,account,'cardtypemessage',set.title,known?.remoteId);
 console.info('OA card stage: EDIT');
 await dismissManagerGuide(page);
 await page.getByPlaceholder('ใส่ชื่อไอเทม',{exact:true}).fill(set.title);
 if(fresh){
  console.info('OA card stage: TEMPLATE_DIALOG');
  await page.getByRole('button',{name:'เลือก',exact:true}).click();
  await page.getByRole('heading',{name:'เลือกประเภทการ์ด',exact:true}).waitFor({state:'visible',timeout:15000});
  console.info('OA card stage: TEMPLATE_PRODUCT');
  await page.locator('label.custom-control-label').filter({hasText:/^สินค้า$/}).click();
  console.info('OA card stage: TEMPLATE_APPLY');
  await page.getByRole('button',{name:'เลือก',exact:true}).last().click();
 }
 const tabs=page.locator('main a.nav-link');await tabs.first().waitFor();
 console.info('OA card stage: TABS');
 if(!fresh&&await tabs.count()!==set.products.length)throw Error('OA_CARD_COUNT_CONFLICT');
 while(await tabs.count()<set.products.length)await page.getByRole('button',{name:'เพิ่มการ์ด',exact:true}).click();
 for(let i=0;i<set.products.length;i++){
  await reportOaProgress('กำลังจัดการ์ด '+set.products[i].code+' ('+(i+1)+'/'+set.products.length+')');
  console.info('OA card stage: PRODUCT',i+1);
  const product=set.products[i];await tabs.nth(i).click();
  await checkbox(page,'แท็ก',true);await page.getByPlaceholder('ใส่ข้อความแท็ก',{exact:true}).fill(product.code);
  // The first A swatch is the gray tag in the Thai OA product-card editor.
  await page.locator('main button.badge').first().click();
  await page.locator('select[name="imageNumber"]').selectOption('3');
  for(const slot of [1,2,3])await uploadCardImage(page,product,slot);
  console.info('OA card stage: FIELDS',i+1);
  await page.getByPlaceholder('ใส่ชื่อการ์ด',{exact:true}).fill(Array.from(product.name).slice(0,20).join(''));
  await checkbox(page,'คำอธิบาย',true);await page.getByPlaceholder('ใส่คำอธิบาย',{exact:true}).fill(oaCardDescription(product));
  await checkbox(page,'ราคา',false);
  await checkbox(page,'แอ็กชัน 1',true);await checkbox(page,'แอ็กชัน 2',true);
  await page.getByPlaceholder('ใส่ข้อความสำหรับป้ายแอ็กชัน',{exact:true}).nth(0).fill('Show details');
  await page.getByPlaceholder('ใส่ข้อความสำหรับป้ายแอ็กชัน',{exact:true}).nth(1).fill(customerAccountLabel);
  await page.locator('select[name="typeId"]').nth(0).selectOption({label:'ข้อความ'});
  await page.locator('select[name="typeId"]').nth(1).selectOption({label:'ลิงก์'});
  await page.getByPlaceholder('ข้อความในช่องนี้จะถูกส่งไปทางแชท',{exact:true}).fill(product.code);
  await page.getByPlaceholder('ใส่ลิงก์',{exact:true}).fill(customerAccountUrl());
 }
 console.info('OA card stage: SAVE');
 await reportOaProgress('กำลังบันทึกชุดการ์ด '+set.title);
 await page.getByRole('button',{name:'บันทึก',exact:true}).last().click();
 if(!fresh){
  await page.getByRole('heading',{name:'บันทึกการ์ดเมสเสจ',exact:true}).waitFor({state:'visible',timeout:10000});
  await page.getByRole('button',{name:'บันทึก',exact:true}).last().click();
 }
 const id=await savedId(page,'cardtypemessage',set.title);
 await reportOaProgress('กำลังเปิดตรวจชุดการ์ดที่บันทึก');
 await page.reload({waitUntil:'domcontentloaded'});await tabs.first().waitFor();
 const cardsDeadline=Date.now()+20000;
 while(await tabs.count()!==set.products.length&&Date.now()<cardsDeadline)await page.waitForTimeout(250);
 if(await tabs.count()!==set.products.length)throw Error('OA_VERIFY_FAILED');
 for(let i=0;i<set.products.length;i++){
  await tabs.nth(i).click();const code=set.products[i].code;
  const deadline=Date.now()+20000;let verified=false;
  while(Date.now()<deadline){
   verified=await page.getByPlaceholder('ใส่ข้อความแท็ก',{exact:true}).inputValue()===code&&await page.locator('select[name="imageNumber"]').inputValue()==='3'&&await page.getByPlaceholder('ข้อความในช่องนี้จะถูกส่งไปทางแชท',{exact:true}).inputValue()===code&&await page.getByRole('button',{name:'',exact:true}).count()===3&&await page.getByPlaceholder('ใส่ชื่อการ์ด',{exact:true}).inputValue()===Array.from(set.products[i].name).slice(0,20).join('')&&await page.getByPlaceholder('ใส่คำอธิบาย',{exact:true}).inputValue()===oaCardDescription(set.products[i])&&await page.getByPlaceholder('ใส่ข้อความสำหรับป้ายแอ็กชัน',{exact:true}).nth(0).inputValue()==='Show details'&&await page.getByPlaceholder('ใส่ข้อความสำหรับป้ายแอ็กชัน',{exact:true}).nth(1).inputValue()===customerAccountLabel&&await page.getByPlaceholder('ใส่ลิงก์',{exact:true}).inputValue()===customerAccountUrl();
   if(verified)break;await page.waitForTimeout(250);
  }
  if(!verified)throw Error('OA_VERIFY_FAILED');
  await reportOaProgress('การ์ด '+code+' สำเร็จแล้ว');
 }
 await db.lineOaArtifact.upsert({where:{account_kind_key:{account,kind:'cards',key:set.title}},create:{account,kind:'cards',key:set.title,remoteId:id,fingerprint:artifactFingerprint(set)},update:{remoteId:id,fingerprint:artifactFingerprint(set)}});
 return {kind:'cards',title:set.title,codes:set.products.map(product=>product.code),url:managerUrl(account,'cardtypemessage/edit/'+id)};
}
