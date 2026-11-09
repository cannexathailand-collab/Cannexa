export function hasManualStockReceipt(evidence:unknown){
 return Array.isArray(evidence)&&evidence.some(entry=>entry&&typeof entry==='object'&&entry.kind==='MANUAL_RECEIPT');
}
