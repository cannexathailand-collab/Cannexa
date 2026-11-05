export type ExpenseLine={description:string;amountSatang:number};
export function expenseItems(expense:{items?:unknown;description:string|null;amountSatang:number|null}):ExpenseLine[]{
 if(Array.isArray(expense.items)&&expense.items.length){const valid=expense.items.every(item=>item&&typeof item==='object'&&typeof item.description==='string'&&Number.isSafeInteger(item.amountSatang)&&item.amountSatang>0);if(valid){const items=expense.items as ExpenseLine[];if(items.reduce((n,item)=>n+item.amountSatang,0)===expense.amountSatang)return items;}}
 return expense.amountSatang!==null&&expense.amountSatang>0?[{description:expense.description??'รายจ่าย',amountSatang:expense.amountSatang}]:[];
}
