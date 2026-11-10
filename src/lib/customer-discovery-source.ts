export const customerDiscoverySources={LINE:'LINE',FACEBOOK:'Facebook',INSTAGRAM:'IG',WEBSITE:'เว็บไซต์',OTHER:'อื่น ๆ'};
export function customerDiscoverySource(value:unknown){
 if(value===undefined)return undefined;
 if(value==='')return null;
 if(typeof value!=='string'||!Object.hasOwn(customerDiscoverySources,value))throw Error('กรุณาเลือกช่องทางที่รู้จักเรา');
 return value;
}
