import AuthForm from '@/components/AuthForm';

export const metadata = { title: 'สมัครสมาชิก – Short URL' };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
