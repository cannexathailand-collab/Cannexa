const delays=[10000,30000,90000];
export function oaRetryDelay(error:unknown,retryCount:number):number|null{
 if(!Number.isInteger(retryCount)||retryCount<0||retryCount>=delays.length)return null;
 const code=error instanceof Error?error.message:'';
 const transient=!/^[A-Z_]+$/.test(code)||/^(AUTOMATION_FAILED|OPENAI_RATE_LIMIT|OPENAI_REQUEST_FAILED|RESEARCH_INVALID|RESEARCH_UNVERIFIED|DRIVE_SEARCH_FAILED|DRIVE_DOWNLOAD_FAILED|OA_ACCOUNT_VERIFY_FAILED|OA_SAVE_UNCONFIRMED|OA_NAME_VERIFY_FAILED|OA_TEXT_VERIFY_FAILED|OA_TEXT_NOT_ACCEPTED|OA_REPLY_ACTIVATION_VERIFY_FAILED|OA_VERIFY_FAILED|OA_VIDEO_.+_FAILED|OA_IMAGE_.+_FAILED)$/.test(code);
 return transient?delays[retryCount]:null;
}
