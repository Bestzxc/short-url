import UnlockForm from '@/components/UnlockForm';

export const metadata = { title: 'ลิงก์นี้มีรหัสผ่าน – ZipLink' };

// Visitors land here from the backend when a short link is protected by a password.
// Visitors arrive via a full redirect, never a client navigation, so a blocking render is fine.
export const instant = false;

export default async function UnlockPage({ params }) {
  const { code } = await params;
  return <UnlockForm code={code} />;
}
