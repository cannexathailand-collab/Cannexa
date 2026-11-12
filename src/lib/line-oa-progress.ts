import {AsyncLocalStorage} from 'node:async_hooks';
import {db} from './db';
export type OaProgressEvent={at:string;message:string};
const scope=new AsyncLocalStorage<{jobId:string;events:OaProgressEvent[]}>();
export const currentOaProgress=()=>scope.getStore()?.events.at(-1)?.message;
export function parseOaProgress(value:unknown):OaProgressEvent[]{
 if(!Array.isArray(value))return [];
 return value.filter((item):item is OaProgressEvent=>!!item&&typeof item==='object'&&typeof item.at==='string'&&typeof item.message==='string').slice(-60);
}
export function withOaProgress<T>(jobId:string,previous:unknown,work:()=>Promise<T>){
 return scope.run({jobId,events:parseOaProgress(previous)},work);
}
export async function reportOaProgress(message:string){
 const current=scope.getStore();if(!current)return;
 const now=new Date(),entry={at:now.toISOString(),message:message.slice(0,300)};
 current.events=[...current.events,entry].slice(-60);
 await db.lineOaJob.updateMany({where:{id:current.jobId,status:'RUNNING'},data:{progressMessage:entry.message,progressAt:now,progressLog:current.events}});
}
