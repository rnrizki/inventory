import { NextResponse } from 'next/server';
import { verifyStalwartCredentials, signSession, SESSION_COOKIE_NAME, isPrivilegedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!email.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address (e.g. user@skyconnection.id)' },
        { status: 400 }
      );
    }

    const authResult = await verifyStalwartCredentials(email, password);

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Invalid email or password' },
        { status: 401 }
      );
    }

    const token = signSession({
      email,
      name: authResult.name || email.split('@')[0],
    });

    const isPrivileged = isPrivilegedUser(email);

    const response = NextResponse.json({
      success: true,
      user: {
        email,
        name: authResult.name || email.split('@')[0],
        role: isPrivileged ? 'privileged' : 'viewer',
        canEdit: isPrivileged,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred during login' },
      { status: 500 }
    );
  }
}
