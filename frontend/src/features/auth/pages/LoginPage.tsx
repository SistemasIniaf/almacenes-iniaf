import { LoginForm } from "../components/LoginForm"

export const LoginPage = () => {
  return (
    // Fondo verde azulado (2026-11-18): el «cian profundo» de azules2.html,
    // oscurecido y llevado hacia el verde del tema, con el degradado marcado.
    <div className="flex min-h-svh flex-col items-center justify-center bg-[linear-gradient(160deg,#011c19_0%,#00564d_50%,#00957f_100%)] p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm />
      </div>
    </div>
  )
}
