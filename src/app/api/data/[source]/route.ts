import { NextRequest, NextResponse } from 'next/server';
import { readReport } from '@/lib/data';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;
  const date = request.nextUrl.searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'date parameter required' }, { status: 400 });
  }

  const validSources = ['periskope', 'slack', 'metabase'];
  if (!validSources.includes(source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }

  const data = await readReport(source, date);
  if (!data) {
    return NextResponse.json({ error: 'No data found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
