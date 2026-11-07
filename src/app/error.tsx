'use client';
export default function PageError({retry}:{error:unknown;retry:()=>void}){
 return <main className="center-page"><section className="customer"><h1>โหลดข้อมูลไม่สำเร็จ</h1><p>อาจเกิดจากการเชื่อมต่อชั่วคราว กรุณาลองโหลดอีกครั้ง</p><button onClick={()=>retry()}>ลองอีกครั้ง</button><button className="secondary" onClick={()=>window.location.reload()}>โหลดหน้าใหม่</button></section></main>;
}
