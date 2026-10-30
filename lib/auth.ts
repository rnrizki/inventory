import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = 'sky_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'skyconnection-inventory-secret-key-2026-auth';

// The 5 privileged users explicitly defined by the user
export const PRIVILEGED_EMAILS = [
  'trihantoro@skyconnection.id',
  'inventory@skyconnection.id',
  'hrd@skyconnection.id',
  'itsupport@skyconnection.id',
  'silvarina@skyconnection.id',
];

export interface SessionUser {
  email: string;
  name: string;
  role: 'privileged' | 'viewer';
  canEdit: boolean;
  iat: number;
  exp: number;
}

export function isPrivilegedUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  return PRIVILEGED_EMAILS.includes(cleanEmail);
}

// Sign session token into a base64url HMAC token
export function signSession(user: { email: string; name: string }): string {
  const cleanEmail = user.email.toLowerCase().trim();
  const privileged = isPrivilegedUser(cleanEmail);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24 * 7; // 7 days

  const payload: SessionUser = {
    email: cleanEmail,
    name: user.name || cleanEmail.split('@')[0],
    role: privileged ? 'privileged' : 'viewer',
    canEdit: privileged,
    iat: now,
    exp,
  };

  const jsonStr = JSON.stringify(payload);
  const data = Buffer.from(jsonStr).toString('base64url');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${hmac}`;
}

// Verify and decode session token
export function verifySession(token: string | null | undefined): SessionUser | null {
  if (!token || !token.includes('.')) return null;

  try {
    const [data, signature] = token.split('.');
    const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    if (signature !== expectedHmac) {
      return null;
    }

    const jsonStr = Buffer.from(data, 'base64url').toString('utf8');
    const session: SessionUser = JSON.parse(jsonStr);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (session.exp && session.exp < now) {
      return null;
    }

    // Recompute canEdit and role in case privileged list changed
    const privileged = isPrivilegedUser(session.email);
    session.role = privileged ? 'privileged' : 'viewer';
    session.canEdit = privileged;

    return session;
  } catch (err) {
    return null;
  }
}

// Retrieve current session from Next.js server components or route handlers
export function getSession(): SessionUser | null {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return verifySession(token);
  } catch {
    return null;
  }
}

// Enforce privileged user in API route handlers
export function requirePrivilegedUser(): NextResponse | null {
  const session = getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Please log in' },
      { status: 401 }
    );
  }
  if (!session.canEdit) {
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: You have view-only access. Only privileged users can add, edit, or delete.',
      },
      { status: 403 }
    );
  }
  return null;
}

// Verify credentials directly against Stalwart Mail Server
export async function verifyStalwartCredentials(
  email: string,
  password: string
): Promise<{ success: boolean; name?: string; error?: string }> {
  const cleanEmail = email.toLowerCase().trim();

  // Validate email format
  if (!cleanEmail.includes('@') || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  try {
    const authPayload = {
      type: 'authCode',
      accountName: cleanEmail,
      accountSecret: password,
      clientId: 'admin',
      redirectUri: 'https://mailserver.skyconnection.id/admin/oauth/callback',
    };

    const res = await fetch('https://mailserver.skyconnection.id/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(authPayload),
      cache: 'no-store',
    });

    if (res.status === 200) {
      const data = await res.json();
      if (data.type === 'authenticated' && data.client_code) {
        return {
          success: true,
          name: cleanEmail.split('@')[0],
        };
      }
    }

    return { success: false, error: 'Invalid email or password' };
  } catch (err: any) {
    console.error('[StalwartAuth] Error verifying credentials:', err);
    return { success: false, error: 'Authentication service temporarily unavailable' };
  }
}

