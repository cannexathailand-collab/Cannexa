'use client';

import {useRouter} from 'next/navigation';
import {useId, useTransition} from 'react';

type DayOption = {day: string; label: string; href: string};

export function IncomeDaySelect({days, selectedDay, allHref, label="ดูรายรับรายวัน", description="เลือกวันที่เพื่อดูยอดและรายการรับเงิน", allLabel="ทุกวันในช่วงที่เลือก"}: {
  days: DayOption[];
  selectedDay: string | null;
  allHref: string;
  label?: string;
  description?: string;
  allLabel?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  return <div className="income-day-picker" aria-busy={pending}>
    <label htmlFor={id}>{label}</label>
    <select id={id} value={selectedDay ?? ''} disabled={pending}
      onChange={event => {
        const href = days.find(day => day.day === event.target.value)?.href ?? allHref;
        startTransition(() => router.push(href));
      }}>
      <option value="">{allLabel}</option>
      {days.map(day => <option key={day.day} value={day.day}>{day.label}</option>)}
    </select>
    <span role="status">{pending ? 'กำลังเปิดรายการ…' : description}</span>
  </div>;
}
