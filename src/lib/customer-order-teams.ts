export function customerOrderTeams(orders:{groupKey:string}[],groups:{id:string;botId:string;name:string}[],bots:{botId:string;name:string}[]){
 const groupById=new Map(groups.map(g=>[g.id,g])),botById=new Map(bots.map(b=>[b.botId,b.name]));
 return [...new Set(orders.map(o=>o.groupKey))].map(key=>{
  const group=groupById.get(key);if(!group)return 'ไม่พบข้อมูลทีม';
  return [botById.get(group.botId)??'ร้านยังไม่ระบุชื่อ',group.name||'กลุ่มยังไม่ตั้งชื่อ'].join(' · ');
 });
}
