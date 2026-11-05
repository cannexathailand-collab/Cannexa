import ExcelJS from "exceljs";
import {moneySatang} from "./shipment-matching";
type ReportRow={tracking:string;recipient:string;phone:string;address:string;amountSatang:number;freightSatang?:number;totalChargeSatang?:number};
export async function parseMyOrderXlsx(bytes:Buffer,kind:"SHIPMENT"|"COD"){
 if(bytes.length>5*1024*1024)throw new Error("FILE_TOO_LARGE");
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
 const rows:ReportRow[]=[];let recognized=false;
 for(const sheet of wb.worksheets){
  if(sheet.rowCount>20000)throw new Error("TOO_MANY_ROWS");
  let columns:Map<string,number>|null=null;
  for(let n=1;n<=Math.min(sheet.rowCount,20);n++){const row=sheet.getRow(n),map=new Map<string,number>();row.eachCell((c,i)=>map.set(c.text.trim().toLowerCase(),i));if(map.has("tracking no.")&&map.has(kind==="SHIPMENT"?"consignee":"recipientname")){columns=map;recognized=true;break;}}
  if(!columns)continue;
  const required=kind==="SHIPMENT"?["phone number","address","cod amount"]:["total amount"];if(required.some(x=>!columns!.has(x)))throw new Error("UNSUPPORTED_COLUMNS");
  // Only literal values and cached formula results are read; formulas are never executed.
  sheet.eachRow((row,index)=>{if(index===1)return;const get=(key:string)=>columns!.has(key)?row.getCell(columns!.get(key)!).text.trim():"";const tracking=get("tracking no.").toUpperCase().replace(/\s/g,"");if(!/^[A-Z0-9-]{8,50}$/.test(tracking))return;const amount=moneySatang(get(kind==="SHIPMENT"?"cod amount":"total amount"));if(amount===null)throw new Error("INVALID_AMOUNT");const cost=(name:string)=>{if(kind!=="SHIPMENT"||!columns!.has(name))return undefined;const value=moneySatang(get(name));if(value===null)throw Error("INVALID_FREIGHT_AMOUNT");return value;};rows.push({freightSatang:cost("freight"),totalChargeSatang:cost("total charge"),tracking,recipient:get(kind==="SHIPMENT"?"consignee":"recipientname"),phone:kind==="SHIPMENT"?get("phone number"):"",address:kind==="SHIPMENT"?["address","moo","sub-district","district","province","zip code"].map(get).filter(Boolean).join(" "):"",amountSatang:amount});});
 }
 if(!recognized)throw new Error("UNSUPPORTED_REPORT");return rows;
}
