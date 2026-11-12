import {z} from 'zod';
import {readToken,signToken} from './crypto';

export const friendRetryCookie='customer_friend_retry';
export const friendRetryDuration=600;
const retrySchema=z.object({purpose:z.literal('CUSTOMER_FRIEND_RETRY'),intent:z.enum(['CUSTOMER','CUSTOMER_REGISTER','CUSTOMER_PASSWORD_RESET','CUSTOMER_MARKETING','CUSTOMER_MARKETING_RECHECK','AFFILIATE']),key:z.string().regex(/^[a-f0-9]{64}$/),clickId:z.string().max(100).nullable(),linkHash:z.string().regex(/^[a-f0-9]{64}$/).nullable(),stateHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),exp:z.number()});
export type FriendRetry=z.infer<typeof retrySchema>;
export function friendRetryToken(input:Omit<FriendRetry,'purpose'|'exp'>){return signToken({...input,purpose:'CUSTOMER_FRIEND_RETRY',exp:Date.now()+friendRetryDuration*1000});}
export function readFriendRetry(value:string){const parsed=retrySchema.safeParse(readToken(value));return parsed.success&&parsed.data.exp>Date.now()?parsed.data:null;}
