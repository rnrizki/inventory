import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePrivilegedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function performReset() {
  const authError = requirePrivilegedUser();
  if (authError) return authError;

  try {
    await db.withTransaction(async (client) => {
      // Truncate all asset-related data and restart IDs at 1
      await client.query(`
        TRUNCATE TABLE
          asset_history,
          asset_events,
          asset_files,
          asset_reminders,
          asset_notes,
          asset_maintenance,
          assets
        RESTART IDENTITY CASCADE;
      `);
    });

    return NextResponse.json({
      success: true,
      message: 'Database reset successful: All assets, uploaded photos, events, history, reminders, notes, and maintenance records have been wiped. Serial IDs are reset to 1 for fresh real data.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return await performReset();
}

export async function GET(request: Request) {
  return await performReset();
}
