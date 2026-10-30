import { NextResponse } from 'next/server';
import { syncStalwartToKeycloak } from '@/lib/sync';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const result = await syncStalwartToKeycloak();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const result = await syncStalwartToKeycloak();
  return NextResponse.json(result);
}


