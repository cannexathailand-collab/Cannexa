import {db} from './db';
import {loadCustomerCrm} from './customer-crm';
import {assignCustomerTiers,defaultTierSettings} from './crm-tiers';
export async function crmTierReport(){
 const [customers,saved]=await Promise.all([db.customer.findMany({where:{OR:[{conversionId:null},{conversion:{source:'LINE'}}]},select:{code:true}}),db.crmTierSettings.findUnique({where:{id:'default'}})]);
 const summaries=await loadCustomerCrm(customers.map(c=>c.code)),settings=saved??defaultTierSettings;
 const tiers=assignCustomerTiers(customers.map(c=>({code:c.code,purchasedSatang:summaries.get(c.code)!.purchasedSatang})),settings);
 return {settings,tiers,summaries};
}
