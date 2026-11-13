export function oaFailureCategory(error:unknown){
 const message=error instanceof Error?error.message:'';
 if(/^(?:OA_|DRIVE_|OPENAI_)[A-Z_]{1,80}$/.test(message))return message;
 if(/strict mode violation/i.test(message))return 'LOCATOR_AMBIGUOUS';
 if(/timeout|timed out/i.test(message))return 'CONTROL_TIMEOUT';
 if(/not attached|detached/i.test(message))return 'CONTROL_DETACHED';
 if(/closed|crashed/i.test(message))return 'BROWSER_CLOSED';
 return 'AUTOMATION_FAILED';
}
export function safeOaResponse(url:string,status:number,method:string){
 if(status<400&&method==='GET')return null;
 try{const parsed=new URL(url);if(!/(^|\.)line\.biz$/.test(parsed.hostname))return null;
 return {status,method:method.slice(0,8),path:parsed.pathname.replace(/[A-Za-z0-9_-]{24,}/g,':id').slice(0,160)};
 }catch{return null;}
}
