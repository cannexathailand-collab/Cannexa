const formatter = new Intl.DateTimeFormat("sv-SE", {
 year: "numeric", month: "2-digit", timeZone: "Asia/Bangkok",
});

export function commissionMonth(date: Date) {
 return formatter.format(date);
}

export function commissionPeriod<T extends {conversion: {verifiedAt: Date | null; createdAt: Date}}>(rows: T[], requested?: string) {
 const current = commissionMonth(new Date());
 const monthOf = (row: T) => commissionMonth(row.conversion.verifiedAt ?? row.conversion.createdAt);
 const months = [...new Set([current, ...rows.map(monthOf)])].sort().reverse();
 const month = requested && months.includes(requested) ? requested : current;
 return {month, months, entries: rows.filter(row => monthOf(row) === month)};
}
