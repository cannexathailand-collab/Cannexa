import type {SaleRow} from './sales-report';
import {bangkokDay,shiftDay,shiftMonth} from './sales-dates';
export function demoSalesRows(now=new Date()):SaleRow[]{
 const today=bangkokDay(now);const rows:SaleRow[]=[];
 for(const [period,day,factor] of [['today',today,1],['week',shiftDay(today,-7),0.5],['month',shiftMonth(today,-1),2]] as const){
  for(const [seller,payment,amount] of [['ตัวอย่าง A','TRANSFER',100000],['ตัวอย่าง B','COD',50000]] as const){
   const id='DEMO-'+period+'-'+payment,date=new Date(day+'T12:00:00+07:00'),revenue=Math.round(amount*factor),tracking='DEMO-TRACK-'+id;
   rows.push({id,orderId:id,affiliateId:'DEMO-'+seller,tracking,paymentMethod:payment,paymentEvidence:payment==='COD'?'COD_RECEIPT':'DECLARED_TRANSFER',status:'PENDING',revenueSatang:revenue,commissionBasis:'REVENUE',commissionBps:200,commissionSatang:Math.round(revenue*0.02),paidAmountSatang:null,paidAt:null,recognizedAt:date,createdAt:date,order:{id,orderNumber:id,sellerUsername:seller,sellerCode:'DEMO',payment:payment==='COD'?'COD':'โอน',status:'MATCHED_SHIPMENT'},affiliate:{id:'DEMO-'+seller,name:seller,code:'DEMO'},shipment:{tracking,orderId:id,fulfillmentStatus:'DISPATCHED',dispatchedAt:date,status:'MATCHED',dispatchEvidence:'ข้อมูลจำลอง',codSatang:payment==='COD'?revenue:0},receipt:payment==='COD'?{tracking,amountSatang:revenue,reportAt:date}:null} as SaleRow);
  }
 }
 return rows;
}
