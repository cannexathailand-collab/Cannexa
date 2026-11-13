import {documentBrandingSnapshot} from '@/lib/document-branding';
import {customerLanguage} from '@/lib/customer-language-server';
import {PublicLanguageSwitch} from '@/app/public-language-switch';
import {LoginContent} from './login-content';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string;changed?:string}>}){
 const {error,changed}=await searchParams,brand=await documentBrandingSnapshot().catch(()=>null),{language}=await customerLanguage();
 return <main className="center-page" lang={language}><div className="customer"><PublicLanguageSwitch language={language}/><LoginContent language={language} brand={brand} error={error} changed={changed}/></div></main>;
}
