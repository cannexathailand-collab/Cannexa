import {db,isSeparateShopDatabase} from './db';

export const documentOperators=['owner','admin','manager','employee','sales','store'] as const;
export const documentReaders=[...documentOperators,'viewer'] as const;
export type DocumentAccount={role:string;username:string};

export function canAccessOrderDocument(account:DocumentAccount,sellerUsername:string|null,tenant:boolean,write=false){
 if(!(write?documentOperators:documentReaders).some(role=>role===account.role))return false;
 return !tenant||!['employee','sales'].includes(account.role)||sellerUsername===account.username;
}

export async function requireOrderDocumentAccess(account:DocumentAccount,orderId:string,write=false){
 const order=await db.orderIntake.findUnique({where:{id:orderId},select:{sellerUsername:true}});
 if(!order||!canAccessOrderDocument(account,order.sellerUsername,isSeparateShopDatabase(),write))throw Error('DOCUMENT_FORBIDDEN');
}
