export function profitColors(value:number){
 return value>0?{backgroundColor:'#e3f4e9',color:'#246544'}:value<0?{backgroundColor:'#fce8e8',color:'#9c3434'}:{backgroundColor:'#f0f3f2',color:'#52645b'};
}
