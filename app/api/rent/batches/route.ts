import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePrivilegedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);

    const batches = await db.query(
      `SELECT * FROM asset_rent_batches ORDER BY id DESC LIMIT ?`,
      [limit]
    );

    return NextResponse.json({ success: true, data: batches });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
