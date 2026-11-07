import {customerAgeChallenge} from '@/lib/customer-age';
import {sha} from '@/lib/crypto';
import '../portal.css';

export const dynamic = 'force-dynamic';

export default async function CustomerAgePage({searchParams}: {
  searchParams: Promise<{denied?: string; error?: string}>;
}) {
  const [params, challenge] = await Promise.all([searchParams, customerAgeChallenge()]);

  if (params.denied === '1') {
    return <main className="customer-portal"><section className="portal-welcome">
      <h1>ไม่สามารถเข้าใช้งานได้</h1>
      <p>สำหรับผู้ที่มีอายุครบ 20 ปีแล้วเท่านั้น</p>
    </section></main>;
  }

  if (!challenge) {
    return <main className="customer-portal"><section className="portal-welcome">
      <h1>กรุณาเข้าสู่ระบบอีกครั้ง</h1>
      <p>คำยืนยันหมดอายุหรือไม่ถูกต้อง</p>
      <a className="button portal-line" href="/marketing?fresh=1">เข้าสู่ระบบด้วย LINE</a>
    </section></main>;
  }

  return <main className="customer-portal"><section className="portal-welcome">
    <h1>คุณอายุ 20 ปีแล้วใช่ไหม</h1>
    {params.error === 'changed' && <p className="portal-alert" role="alert">
      ขั้นตอนเข้าสู่ระบบเปลี่ยนแล้ว กรุณายืนยันอีกครั้ง
    </p>}
    <form action="/api/customer/age" method="post" className="portal-profile">
      <input type="hidden" name="challenge" value={sha(challenge.value)}/>
      <div className="portal-profile-actions">
        <button type="submit" name="answer" value="yes">Yes</button>
        <button type="submit" name="answer" value="no" className="secondary">No</button>
      </div>
    </form>
  </section></main>;
}
