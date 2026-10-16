/**
 * Public surface of the auth layer. Import from `@/lib/auth`.
 *
 * `getAuthService()` is the single place that chooses who answers — the backend or the
 * in-browser sandbox — from `AUTH_SOURCE` (`lib/config.ts`).
 */

import { AUTH_SOURCE } from "@/lib/config";

import { HttpAuthService } from "./http";
import { SandboxAuthService } from "./sandbox";
import type { AuthService } from "./service";

let instance: AuthService | null = null;

export function getAuthService(): AuthService {
  instance ??= AUTH_SOURCE === "sandbox" ? new SandboxAuthService() : new HttpAuthService();
  return instance;
}

export { AuthError, isAuthError, type AuthErrorCode } from "./errors";
export { isIndianMobile } from "./mobile";
export type { AuthService } from "./service";
export type {
  AccountState,
  BackendRole,
  Credentials,
  OtpPurpose,
  RegistrationDetails,
  RegistrationRole,
  RegistrationStatus,
} from "./types";
