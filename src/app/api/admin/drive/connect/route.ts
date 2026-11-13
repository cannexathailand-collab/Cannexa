import {driveOperators} from '@/lib/accounts';
import {admin,sameOrigin} from '@/lib/auth';
import {connectDrive} from '@/lib/drive-connection';
export async function POST(){try{await admin(driveOperators);await sameOrigin();}catch{return new Response('Forbidden',{status:403});}return connectDrive();}
