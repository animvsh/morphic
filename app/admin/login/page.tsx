import { LoginForm } from '@/components/login-form'

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef0e9] p-6">
      <LoginForm
        admin
        redirectTo="/admin"
        message="Sign in with an account that has an active Brok admin membership."
      />
    </main>
  )
}
