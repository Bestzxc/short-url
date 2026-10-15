import Link from 'next/link';
import { notFound } from 'next/navigation';
import Logo from '@/components/Logo';
import Decor from '@/components/Decor';

// Pages the backend redirects visitors to when a short URL can't be opened
const STATUSES = {
  'not-found': { code: '404', title: 'ไม่พบลิงก์', message: 'ลิงก์นี้ไม่มีอยู่ในระบบ หรืออาจถูกลบไปแล้ว' },
  inactive: { code: 'OFF', title: 'ลิงก์ถูกปิด', message: 'เจ้าของลิงก์ปิดการใช้งานลิงก์นี้ชั่วคราว' },
  expired: { code: 'EXP', title: 'ลิงก์หมดอายุ', message: 'ลิงก์นี้หมดอายุแล้ว ไม่สามารถเปิดได้' },
  'limit-reached': { code: 'MAX', title: 'คลิกครบจำนวนแล้ว', message: 'ลิงก์นี้ถูกเปิดครบตามจำนวนที่เจ้าของกำหนดแล้ว' },
};

// Visitors arrive via a full redirect from the backend, never a client navigation,
// so a blocking render is fine; all four pages are prerendered by generateStaticParams anyway
export const instant = false;

export function generateStaticParams() {
  return Object.keys(STATUSES).map((type) => ({ type }));
}

export async function generateMetadata({ params }) {
  const { type } = await params;
  return { title: `${STATUSES[type]?.title ?? 'ไม่พบหน้า'} – ZipLink` };
}

export default async function StatusPage({ params }) {
  const { type } = await params;
  const status = STATUSES[type];
  if (!status) notFound();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <Decor />
      <Logo />
      <p className="mt-12 text-8xl font-extrabold leading-none tracking-tight text-brand sm:text-9xl">{status.code}</p>
      <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">{status.title}</h1>
      <p className="mt-3 max-w-md text-lg text-neutral-600">{status.message}</p>
      <Link href="/" className="btn btn-primary mt-8 px-10 py-3 text-lg">ไปหน้าแรก</Link>
    </main>
  );
}
