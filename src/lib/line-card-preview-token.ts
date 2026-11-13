import {z} from 'zod';
import {signToken,readToken} from './crypto';
import {researchResult} from './product-research';
const snapshot=z.object({purpose:z.literal('oa-preview-v1'),actor:z.string(),schema:z.string(),expires:z.number().int(),code:z.string(),name:z.string(),context:z.string(),images:z.array(z.object({slot:z.number(),url:z.string().nullable()})),research:researchResult});
type Identity={actor:string;schema:string;code:string;name:string;context:string;images:{slot:number;url:string|null}[]};
export function signOaPreview(value:Identity&{research:z.infer<typeof researchResult>},now=Date.now()){
 return signToken(snapshot.parse({...value,purpose:'oa-preview-v1',expires:now+30*60*1000}));
}
export function readOaPreview(token:string,expected:Identity,now=Date.now()){
 const parsed=snapshot.safeParse(readToken(token));
 if(!parsed.success||parsed.data.expires<=now)throw Error('OA_PREVIEW_EXPIRED');
 const value=parsed.data;
 if(value.actor!==expected.actor||value.schema!==expected.schema||value.code!==expected.code||value.name!==expected.name||value.context!==expected.context||JSON.stringify(value.images)!==JSON.stringify(expected.images))throw Error('OA_PREVIEW_CHANGED');
 if(!value.research.sources.length)throw Error('OA_PREVIEW_UNVERIFIED');
 return {...value.research,needsReview:false};
}
