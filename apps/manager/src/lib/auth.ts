import { timingSafeEqual } from "node:crypto"
import { SignJWT, jwtVerify } from "jose"
import { authenticator } from "@otplib/preset-default"
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server"
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server"
import {
  getCredentials,
  saveCredential,
  updateCounter,
  challengeStore,
} from "@/lib/passkey-store"

const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET || "default-secret-change-in-production-min-32-chars"
)

const USER = {
  id: "1",
  username: process.env.AUTH_USERNAME || "jerome",
  password: process.env.AUTH_PASSWORD || "cvmanager",
  totpSecret: process.env.AUTH_TOTP_SECRET || "",
}

const RP_ID = process.env.AUTH_DOMAIN || "localhost"
const RP_NAME = "CV Manager"
const ORIGIN = process.env.AUTH_ORIGIN || `http://${RP_ID}:3000`
const EXPECTED_ORIGINS = Array.from(new Set([ORIGIN, "http://localhost:3000"]))

export function getUsername(): string {
  return USER.username
}

export interface SessionPayload {
  userId: string
  username: string
  exp: number
}

export async function createSession(username: string): Promise<string> {
  const token = await new SignJWT({ userId: USER.id, username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY)

  return token
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export function verifyPassword(password: string): boolean {
  const a = Buffer.from(password)
  const b = Buffer.from(USER.password)
  if (a.length !== b.length) {
    timingSafeEqual(Buffer.alloc(b.length), b)
    return false
  }
  return timingSafeEqual(a, b)
}

export function generateTOTPUri(secret: string, username: string): string {
  return authenticator.keyuri(username, "CV Manager", secret)
}

export function verifyTOTP(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret })
}

export function generateTOTPSecret(): string {
  return authenticator.generateSecret()
}

// Passkey: Registration

export async function getPasskeyRegistrationOptions(username: string) {
  const existingCredentials = getCredentials()

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: username,
    userDisplayName: username,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.id,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  })

  challengeStore.setChallenge("registration", options.challenge)
  return options
}

export async function verifyPasskeyRegistration(
  response: RegistrationResponseJSON,
  deviceName: string
): Promise<{ verified: boolean; credentialId?: string }> {
  const expectedChallenge = challengeStore.consumeChallenge("registration")
  if (!expectedChallenge) {
    return { verified: false }
  }

  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: EXPECTED_ORIGINS,
    expectedRPID: RP_ID,
  })

  if (!result.verified || !result.registrationInfo) {
    return { verified: false }
  }

  const { credential } = result.registrationInfo

  saveCredential({
    id: credential.id,
    publicKey: Array.from(credential.publicKey),
    counter: credential.counter,
    transports: response.response.transports ?? [],
    deviceName,
    createdAt: new Date().toISOString(),
  })

  return { verified: true, credentialId: credential.id }
}

// Passkey: Authentication

export async function getPasskeyAuthenticationOptions() {
  const existingCredentials = getCredentials()

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "preferred",
    allowCredentials: existingCredentials.map((c) => ({
      id: c.id,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    })),
  })

  challengeStore.setChallenge("authentication", options.challenge)
  return options
}

export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON
): Promise<{ verified: boolean }> {
  const expectedChallenge = challengeStore.consumeChallenge("authentication")
  if (!expectedChallenge) {
    return { verified: false }
  }

  const credentials = getCredentials()
  const storedCred = credentials.find((c) => c.id === response.id)
  if (!storedCred) {
    return { verified: false }
  }

  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: EXPECTED_ORIGINS,
    expectedRPID: RP_ID,
    credential: {
      id: storedCred.id,
      publicKey: new Uint8Array(storedCred.publicKey),
      counter: storedCred.counter,
      transports: (storedCred.transports ?? []) as AuthenticatorTransport[],
    },
  })

  if (!result.verified) {
    return { verified: false }
  }

  updateCounter(storedCred.id, result.authenticationInfo.newCounter)
  return { verified: true }
}
