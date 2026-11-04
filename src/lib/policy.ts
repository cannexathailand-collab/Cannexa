export type Evidence={friendFlag:boolean|null;changed:boolean|null;priorFriend:boolean;unblocked:boolean;follow:boolean};
export function classify(e:Evidence):{status:"NOT_FRIEND"|"UNBLOCKED"|"EXISTING_FRIEND"|"PENDING_REVIEW";reason:string}{
 if(e.unblocked)return {status:"UNBLOCKED",reason:"มีประวัติบล็อก/ปลดบล็อก ไม่คิดค่าคอม"};
 if(e.priorFriend)return {status:"EXISTING_FRIEND",reason:"พบประวัติเป็นเพื่อนก่อนการคลิก"};
 if(e.friendFlag===false)return {status:"NOT_FRIEND",reason:"LINE ยืนยันว่าปัจจุบันไม่ได้เป็นเพื่อน"};
 return {status:"PENDING_REVIEW",reason:e.friendFlag===null?"LINE API ไม่ตอบสนอง ต้องตรวจสอบใหม่":"เป็นเพื่อนปัจจุบัน แต่ยังยืนยันการเพิ่มเพื่อนครั้งแรกไม่ได้"};
}
export function mayApprove(status:string,friendFlag:boolean|null,evidence:string){return status==="PENDING_REVIEW"&&friendFlag===true&&evidence.trim().length>=20;}
export function commissionTotal(rows:{status:string;amountSatang:number}[]){return rows.filter(r=>["Approved","Paid"].includes(r.status)).reduce((n,r)=>n+r.amountSatang,0);}
export function csvCell(v:unknown){let s=String(v??"");if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
