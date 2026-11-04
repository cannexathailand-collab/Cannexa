const thaiDay = new Intl.DateTimeFormat("th-TH", {
 day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok",
});

export function FriendTrend({days}: {days: string[]}) {
 const counts = new Map<string, number>();
 for (const day of days) counts.set(day, (counts.get(day) ?? 0) + 1);
 const dates = [...counts.keys()].sort().reverse();
 const max = Math.max(1, ...counts.values());

 return <section className="card review">
  <h2>เพื่อนใหม่รายวัน</h2>
  <p className="muted small">นับเฉพาะเพื่อนใหม่ที่ระบบยืนยัน จัดตามวันที่ลงทะเบียนผ่านลิงก์ Affiliate ตามเวลาไทย</p>
  {dates.length ? <div className="table-wrap"><table>
   <thead><tr><th scope="col">วันที่</th><th scope="col">กราฟ</th><th scope="col">เพื่อนใหม่</th></tr></thead>
   <tbody>{dates.map(day => {
    const count = counts.get(day)!;
    return <tr key={day}>
     <th scope="row">{thaiDay.format(new Date(day + "T00:00:00Z"))}</th>
     <td style={{width:"65%"}}><div className="track" aria-hidden="true"><div className="bar" style={{width: (count / max * 100) + "%"}}/></div></td>
     <td>{count} คน</td>
    </tr>;
   })}</tbody>
  </table></div> : <p>ยังไม่มีเพื่อนใหม่ในช่วงที่เลือก</p>}
 </section>;
}
