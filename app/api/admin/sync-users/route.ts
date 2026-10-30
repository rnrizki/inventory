import { NextResponse } from 'next/server';
import { syncStalwartToKeycloak } from '@/lib/sync';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const diag: any = {};
  const targets = [
    'http://mail-stalwart-mmfbt9-stalwart-mail-1:8080/api/discover/admin%40skyconnection.id',
    'https://mailserver.skyconnection.id/api/discover/admin%40skyconnection.id',
    'https://38.45.66.155/api/discover/admin%40skyconnection.id',
  ];

  for (const url of targets) {
    try {
      const r = await fetch(url, { headers: { Host: 'mailserver.skyconnection.id' } });
      diag[url] = { status: r.status };
    } catch (e: any) {
      diag[url] = { error: e.message, cause: e.cause?.message || String(e.cause) };
    }
  }

  const result = await syncStalwartToKeycloak();
  return NextResponse.json({ diag, result });
}

export async function POST(request: Request) {
  const result = await syncStalwartToKeycloak();
  return NextResponse.json(result);
}

