import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

async function performReset() {
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

    return {
      success: true,
      message: 'Database reset successful: All assets, uploaded photos, events, history, reminders, notes, and maintenance records have been wiped. Serial IDs are reset to 1 for fresh real data.',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function POST(request: Request) {
  const result = await performReset();
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export async function GET(request: Request) {
  const result = await performReset();
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
