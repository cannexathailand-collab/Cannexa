import type {Page} from 'playwright-core';
import {db} from './db';
import {type OaPayload,artifactFingerprint} from './line-oa-job';

type Product=OaPayload['sets'][number]['products'][number];
export function managerUrl(account:string,path=''){
 if(!/^@[a-zA-Z0-9._-]+$/.test(account))throw Error('OA_ACCOUNT_INVALID');
 return 'https://manager.line.biz/account/'+account+(path?'/'+path:'');
}
export async function verifyManager(page:Page,account:string){
 await page.goto(managerUrl(account),{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'ช่วยเหลือ',exact:true}).waitFor({timeout:20000}).catch(()=>{});
 if(!page.url().startsWith(managerUrl(account))||!await page.getByText(account,{exact:true}).count())throw Error('OA_LOGIN_REQUIRED');
}
async function openItem(page:Page,account:string,kind:'cardtypemessage'|'autoresponse',name:string,remoteId?:string){
 if(remoteId){
  if(!/^\d+$/.test(remoteId))throw Error('OA_ARTIFACT_INVALID');
  await page.goto(managerUrl(account,kind+'/edit/'+remoteId),{waitUntil:'domcontentloaded'});
  const title=page.getByPlaceholder(kind==='cardtypemessage'?'ใส่ชื่อไอเทม':'ใส่ชื่อ',{exact:true});await title.waitFor();
  if(await title.inputValue()!==name)throw Error('OA_ARTIFACT_CHANGED');return false;
 }
 await page.goto(managerUrl(account,kind),{waitUntil:'domcontentloaded'});
 const filter=page.getByPlaceholder(kind==='cardtypemessage'?'ใส่ชื่อไอเทม':'ใส่คีย์เวิร์ด',{exact:true});
 await filter.fill(name);await page.getByRole('button',{name:'',exact:true}).click();
 await page.waitForTimeout(1000);await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
 const items=page.locator('main table').getByRole('link',{name,exact:true});
 if(await items.count()>1)throw Error('OA_DUPLICATE_ITEM');
 if(await items.count()===1){await items.click();return false;}
 await page.getByRole(kind==='cardtypemessage'?'button':'link',{name:'สร้างใหม่',exact:true}).click();return true;
}
async function checkbox(page:Page,label:string,value:boolean){const control=page.getByRole('checkbox',{name:label,exact:true});await control.setChecked(value);}
async function savedId(page:Page,kind:string,name:string){
 await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{});
 if(new URL(page.url()).pathname.endsWith('/'+kind)){
  const filter=page.getByPlaceholder(kind==='cardtypemessage'?'ใส่ชื่อไอเทม':'ใส่คีย์เวิร์ด',{exact:true});
  await filter.fill(name);await page.getByRole('button',{name:'',exact:true}).click();
  await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{});
  const found=page.locator('main table').getByRole('link',{name,exact:true});
  if(await found.count()!==1)throw Error('OA_SAVE_UNCONFIRMED');await found.click();
 }
 await page.waitForURL(new RegExp('/'+kind+'/edit/\\d+'),{timeout:30000});
 const id=page.url().match(/\/edit\/(\d+)/)?.[1];if(!id)throw Error('OA_SAVE_UNCONFIRMED');return id;
}
export async function saveManagerReply(page:Page,account:string,product:Product){
 if(!product.research||product.research.needsReview)throw Error('OA_REVIEW_REQUIRED');
 const known=await db.lineOaArtifact.findUnique({where:{account_kind_key:{account,kind:'reply',key:product.code}}});
 const fresh=await openItem(page,account,'autoresponse',product.replyTitle,known?.remoteId);
 await page.getByPlaceholder('ใส่ชื่อ',{exact:true}).fill(product.replyTitle);
 await page.getByRole('radio',{name:'ตอบกลับตามคีย์เวิร์ด',exact:true}).check();
 const keywords=await page.locator('input[name="keyword[]"]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value));
 if(keywords.length&&JSON.stringify(keywords)!==JSON.stringify([product.code]))throw Error('OA_KEYWORD_CONFLICT');
 if(!keywords.length){await page.locator('input[name="keyword-suggestions"]').fill(product.code);await page.getByRole('button',{name:'เพิ่ม',exact:true}).click();}
 const editor=page.getByRole('textbox',{name:'ใส่ข้อความ',exact:true});
 if(await editor.count()!==1)throw Error('OA_TEXT_LAYOUT_CHANGED');
 await editor.click();await editor.press('ControlOrMeta+A');await editor.pressSequentially(product.research.text);
 const value=await editor.inputValue();if(value!==product.research.text)throw Error('OA_TEXT_NOT_ACCEPTED');
 await page.getByRole('button',{name:fresh?'บันทึก':'ใช้การเปลี่ยนแปลง',exact:true}).last().click();
 if(!fresh){
  await page.getByRole('heading',{name:'ต้องการใช้การเปลี่ยนแปลงหรือไม่',exact:true}).waitFor({state:'visible',timeout:10000});
  await page.getByRole('button',{name:'ใช้การเปลี่ยนแปลง',exact:true}).last().click();
 }
 const id=await savedId(page,'autoresponse',product.replyTitle);
 await page.reload({waitUntil:'domcontentloaded'});
 // OA loads the saved message after the initial document and form controls.
 // Wait for those values, rather than treating the first empty form as failure.
 const deadline=Date.now()+20000;let name='',savedText='';
 while(Date.now()<deadline){
  name=await page.getByPlaceholder('ใส่ชื่อ',{exact:true}).inputValue();
  savedText=await editor.inputValue();
  if(name===product.replyTitle&&savedText===product.research.text)break;
  await page.waitForTimeout(250);
 }
 if(name!==product.replyTitle)throw Error('OA_NAME_VERIFY_FAILED');
 if(savedText!==product.research.text)throw Error('OA_TEXT_VERIFY_FAILED');
 const start=page.getByRole('button',{name:'เริ่มใช้งาน',exact:true});if(await start.count())await start.click();
 await page.getByRole('button',{name:'หยุดใช้งาน',exact:true}).waitFor({timeout:20000});
 await db.lineOaArtifact.upsert({where:{account_kind_key:{account,kind:'reply',key:product.code}},create:{account,kind:'reply',key:product.code,remoteId:id,fingerprint:artifactFingerprint(product.research)},update:{remoteId:id,fingerprint:artifactFingerprint(product.research)}});
 return {kind:'reply',code:product.code,url:managerUrl(account,'autoresponse/edit/'+id)};
}
async function uploadCardImage(page:Page,product:Product,slot:number){
 const image=slot===1?await db.stockProductImage.findUnique({where:{code:product.code}}):await db.stockProductExtraImage.findUnique({where:{code_slot:{code:product.code,slot}}});
 if(!image)throw Error('OA_IMAGES_MISSING');
 if(!['image/jpeg','image/png'].includes(image.imageMime))throw Error('OA_IMAGE_FORMAT');
 const letter=['A','B','C'][slot-1],link=page.getByRole('link',{name:letter,exact:true});
 if(!await link.count())await page.getByRole('button',{name:'',exact:true}).nth(slot-1).click();
 await link.click();
 await page.getByRole('heading',{name:'อัปโหลดรูป',exact:true}).waitFor({state:'visible',timeout:15000}).catch(()=>{throw Error('OA_IMAGE_DIALOG_FAILED');});
 const [chooser]=await Promise.all([page.waitForEvent('filechooser',{timeout:15000}),page.getByText('เลือกไฟล์',{exact:true}).click()]).catch(()=>{throw Error('OA_IMAGE_PICKER_FAILED');});
 await chooser.setFiles({name:'product-'+slot+(image.imageMime==='image/png'?'.png':'.jpg'),mimeType:image.imageMime,buffer:Buffer.from(image.imageData)});
 await page.getByRole('heading',{name:'ครอบตัด',exact:true}).waitFor({state:'visible',timeout:30000}).catch(()=>{throw Error('OA_IMAGE_CROP_FAILED');});
 await page.getByRole('button',{name:'ใช้',exact:true}).click({timeout:30000});
 await page.getByRole('heading',{name:'ครอบตัด',exact:true}).waitFor({state:'hidden',timeout:30000}).catch(()=>{throw Error('OA_IMAGE_UPLOAD_FAILED');});
 await link.waitFor({state:'hidden',timeout:30000}).catch(()=>{throw Error('OA_IMAGE_READY_FAILED');});
}
export async function saveManagerCards(page:Page,account:string,set:OaPayload['sets'][number]){
 const known=await db.lineOaArtifact.findUnique({where:{account_kind_key:{account,kind:'cards',key:set.title}}});
 const fresh=await openItem(page,account,'cardtypemessage',set.title,known?.remoteId);
 await page.getByPlaceholder('ใส่ชื่อไอเทม',{exact:true}).fill(set.title);
 if(fresh){await page.getByRole('button',{name:'เลือก',exact:true}).click();await page.getByRole('radio',{name:'สินค้า',exact:true}).check();await page.getByRole('button',{name:'เลือก',exact:true}).last().click();}
 const tabs=page.locator('main a.nav-link');await tabs.first().waitFor();
 if(!fresh&&await tabs.count()!==set.products.length)throw Error('OA_CARD_COUNT_CONFLICT');
 while(await tabs.count()<set.products.length)await page.getByRole('button',{name:'เพิ่มการ์ด',exact:true}).click();
 for(let i=0;i<set.products.length;i++){
  const product=set.products[i];await tabs.nth(i).click();
  await checkbox(page,'แท็ก',true);await page.getByPlaceholder('ใส่ข้อความแท็ก',{exact:true}).fill(product.code);
  // The first A swatch is the gray tag in the Thai OA product-card editor.
  await page.locator('main button.badge').first().click();
  await page.locator('select[name="imageNumber"]').selectOption('3');
  for(const slot of [1,2,3])await uploadCardImage(page,product,slot);
  await page.getByPlaceholder('ใส่ชื่อการ์ด',{exact:true}).fill(Array.from(product.name).slice(0,20).join(''));
  await checkbox(page,'คำอธิบาย',true);await page.getByPlaceholder('ใส่คำอธิบาย',{exact:true}).fill('ดูรายละเอียดสินค้า');
  await checkbox(page,'ราคา',false);
  await checkbox(page,'แอ็กชัน 1',true);await checkbox(page,'แอ็กชัน 2',true);
  await page.getByPlaceholder('ใส่ข้อความสำหรับป้ายแอ็กชัน',{exact:true}).nth(0).fill('Show details');
  await page.getByPlaceholder('ใส่ข้อความสำหรับป้ายแอ็กชัน',{exact:true}).nth(1).fill('Order Now');
  await page.locator('select[name="typeId"]').nth(0).selectOption({label:'ข้อความ'});
  await page.locator('select[name="typeId"]').nth(1).selectOption({label:'ลิงก์'});
  await page.getByPlaceholder('ข้อความในช่องนี้จะถูกส่งไปทางแชท',{exact:true}).fill(product.code);
  // The current acceptance run uses neutral product information and mock links.
  await page.getByPlaceholder('ใส่ลิงก์',{exact:true}).fill('https://example.com/?test_product='+encodeURIComponent(product.code));
 }
 await page.getByRole('button',{name:'บันทึก',exact:true}).last().click();const id=await savedId(page,'cardtypemessage',set.title);
 await page.reload({waitUntil:'domcontentloaded'});await tabs.first().waitFor();
 const cardsDeadline=Date.now()+20000;
 while(await tabs.count()!==set.products.length&&Date.now()<cardsDeadline)await page.waitForTimeout(250);
 if(await tabs.count()!==set.products.length)throw Error('OA_VERIFY_FAILED');
 for(let i=0;i<set.products.length;i++){
  await tabs.nth(i).click();const code=set.products[i].code;
  const deadline=Date.now()+20000;let verified=false;
  while(Date.now()<deadline){
   verified=await page.getByPlaceholder('ใส่ข้อความแท็ก',{exact:true}).inputValue()===code&&await page.locator('select[name="imageNumber"]').inputValue()==='3'&&await page.getByPlaceholder('ข้อความในช่องนี้จะถูกส่งไปทางแชท',{exact:true}).inputValue()===code&&await page.getByRole('button',{name:'',exact:true}).count()===3;
   if(verified)break;await page.waitForTimeout(250);
  }
  if(!verified)throw Error('OA_VERIFY_FAILED');
 }
 await db.lineOaArtifact.upsert({where:{account_kind_key:{account,kind:'cards',key:set.title}},create:{account,kind:'cards',key:set.title,remoteId:id,fingerprint:artifactFingerprint(set)},update:{remoteId:id,fingerprint:artifactFingerprint(set)}});
 return {kind:'cards',title:set.title,url:managerUrl(account,'cardtypemessage/edit/'+id)};
}
