export function env(key:string){const v=process.env[key];if(!v)throw new Error("Missing environment: "+key);return v;}
export function mockMode(){const on=process.env.MOCK_MODE==="true";if(on&&process.env.NODE_ENV==="production")throw new Error("MOCK_MODE disabled in production");return on;}
export function baseUrl(){const u=new URL(env("APP_URL"));if(process.env.NODE_ENV==="production"&&u.protocol!=="https:")throw new Error("HTTPS required");return u.origin;}

export function lineConfigured(){return ["LINE_LOGIN_CHANNEL_ID","LINE_LOGIN_CHANNEL_SECRET","LINE_MESSAGING_CHANNEL_SECRET","LINE_BOT_USER_ID","LINE_OA_BASIC_ID"].every(key=>Boolean(process.env[key]?.trim()));}
