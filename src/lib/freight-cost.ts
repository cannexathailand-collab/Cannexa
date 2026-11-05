import type {Prisma} from '@prisma/client';
export async function saveFreightCost(tx:Prisma.TransactionClient,row:{tracking:string;freightSatang?:number;totalChargeSatang?:number},importId:string,reportAt:Date){
 if(row.freightSatang===undefined&&row.totalChargeSatang===undefined)return false;
 const existing=await tx.shipment.findUniqueOrThrow({where:{tracking:row.tracking}});
 if(row.freightSatang!==undefined&&existing.freightSatang!==null&&existing.freightSatang!==row.freightSatang||row.totalChargeSatang!==undefined&&existing.totalChargeSatang!==null&&existing.totalChargeSatang!==row.totalChargeSatang)throw Error('FREIGHT_COST_CONFLICT');
 if(!(row.freightSatang!==undefined&&existing.freightSatang===null||row.totalChargeSatang!==undefined&&existing.totalChargeSatang===null))return false;
 await tx.shipment.update({where:{tracking:row.tracking},data:{freightSatang:row.freightSatang,totalChargeSatang:row.totalChargeSatang,freightImportId:existing.freightImportId??importId,freightReportAt:existing.freightReportAt??reportAt}});return true;
}
