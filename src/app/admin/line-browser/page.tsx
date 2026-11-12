import {requireAdminPage} from '@/lib/auth';
import {OaLoginPanel} from '@/app/oa-login-panel';
export default async function Page(){await requireAdminPage();return <><h1>เชื่อม LINE OA บนเซิร์ฟเวอร์</h1><p>ล็อกอิน LINE OA ของร้านผ่านหน้าจอนี้ เพื่อให้ตัวทำงานบนเซิร์ฟเวอร์สร้างการ์ดและข้อความตอบกลับได้จากทุกเครื่อง</p><OaLoginPanel/></>;}
