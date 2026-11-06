import {z} from 'zod';
export const pointTierNames={new:'ลูกค้าใหม่ / ยังไม่เข้าเกณฑ์',bronze:'Bronze',silver:'Silver',gold:'Gold',vip:'VIP Platinum'} as const;
export const pointTierKeys=['new','bronze','silver','gold','vip'] as const;
export const tierPointRatesSchema=z.object({new:z.number().int().min(0).max(1000000),bronze:z.number().int().min(0).max(1000000),silver:z.number().int().min(0).max(1000000),gold:z.number().int().min(0).max(1000000),vip:z.number().int().min(0).max(1000000)});
export type TierPointRates=z.infer<typeof tierPointRatesSchema>;
export function pointTierKey(name:string):keyof TierPointRates{return name==='VIP Platinum'?'vip':name==='Gold'?'gold':name==='Silver'?'silver':name==='Bronze'?'bronze':'new';}
export function pointsPerThousand(revenueSatang:number,rate:number){return Math.floor(Math.max(0,revenueSatang)*rate/100000);}
const snapshotSchema=z.object({version:z.literal(1),enabled:z.boolean(),tier:z.enum(pointTierKeys),pointsPerThousand:z.number().int().min(0).max(1000000),ruleId:z.string()});
export type TierPointSnapshot=z.infer<typeof snapshotSchema>;
export function snapshotPoints(snapshot:unknown,revenueSatang:number):number|null{
 if(snapshot===null||snapshot===undefined)return null;
 const parsed=snapshotSchema.safeParse(snapshot);if(!parsed.success)throw Error('INVALID_LOYALTY_SNAPSHOT');
 return parsed.data.enabled?pointsPerThousand(revenueSatang,parsed.data.pointsPerThousand):0;
}
