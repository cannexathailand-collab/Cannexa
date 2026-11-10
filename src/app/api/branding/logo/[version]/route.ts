import {documentLogoResponse} from '@/lib/document-branding';
export async function GET(_request:Request,{params}:{params:Promise<{version:string}>}){return documentLogoResponse((await params).version);}
