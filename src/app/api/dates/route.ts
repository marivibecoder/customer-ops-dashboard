import { NextResponse } from 'next/server';
import { listAllDates } from '@/lib/data';

export async function GET() {
  const dates = await listAllDates();
  return NextResponse.json(dates);
}
