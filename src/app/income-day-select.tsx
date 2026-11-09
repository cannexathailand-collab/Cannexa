'use client';

import {useRouter} from 'next/navigation';
import {useTransition} from 'react';

type DayOption = {day: string; label: string; href: string};

export function IncomeDaySelect({days, selectedDay, allHref}: {
  days: DayOption[];
  selectedDay: string | null;
  allHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="income-day-picker" aria-busy={pending}>
    <label htmlFor="income-day-select">ดูรายรับรายวัน</label>
    <select id="income-day-select" value={selectedDay ?? ''} disabled={pending}
      onChange={event => {
        const href = days.find(day => day.day === event.target.value)?.href ?? allHref;
        startTransition(() => router.push(href));
      }}>
      <option value="">ทุกวันในช่วงที่เลือก</option>
      {days.map(day => <option key={day.day} value={day.day}>{day.label}</option>)}
    </select>
    <span role="status">{pending ? 'กำลังเปิดรายรับ…' : 'เลือกวันที่เพื่อดูยอดและรายการรับเงิน'}</span>
  </div>;
}
