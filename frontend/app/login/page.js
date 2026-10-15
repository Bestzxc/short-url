import AuthForm from '@/components/AuthForm';

export const metadata = { title: 'เข้าสู่ระบบ – Short URL' };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
