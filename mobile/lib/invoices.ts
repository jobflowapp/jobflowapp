// mobile/lib/invoices.ts
// Optional helper-only file. Keep NO JSX in here.
export function formatMoney(n: number) {
  return `$${(n ?? 0).toFixed(2)}`;
}

