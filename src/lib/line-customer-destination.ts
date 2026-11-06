export function lineCustomerDestination(basicId:string,friendFlag:boolean|null){
 if(!/^@[\w.-]+$/.test(basicId))throw new Error('Invalid LINE account');
 return 'https://line.me/R/'+(friendFlag===true?'oaMessage/':'ti/p/')+encodeURIComponent(basicId);
}
