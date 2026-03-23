import { NextRequest, NextResponse } from 'next/server';
import { writeReport } from '@/lib/data';

export async function POST(request: NextRequest) {
  // Auth check — read at runtime, not build time
  const token = process.env.DASHBOARD_UPLOAD_TOKEN;
  const authHeader = request.headers.get('authorization');
  if (!token || authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { source, date, data } = body;

    if (!source || !date || !data) {
      return NextResponse.json({ error: 'source, date, and data are required' }, { status: 400 });
    }

    const validSources = ['periskope', 'slack', 'metabase'];
    if (!validSources.includes(source)) {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
    }

    await writeReport(source, date, data);
    return NextResponse.json({ ok: true, source, date });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
