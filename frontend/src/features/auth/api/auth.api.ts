import { api } from "@/lib/api"

import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
} from "@/features/auth/lib/auth.types"

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", payload)
  return data
}

/** Perfil del usuario del access token. Sirve para rehidratar la sesion al recargar. */
export async function me(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>("/auth/me")
  return data
}
