import { NextRequest, NextResponse } from 'next/server';
import { readMappings, writeMappings } from '@/lib/data';

export async function GET() {
  const mappings = await readMappings();
  return NextResponse.json(mappings);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, mapping } = body;

    if (!client_id || !mapping) {
      return NextResponse.json({ error: 'client_id and mapping are required' }, { status: 400 });
    }

    const mappings = await readMappings();
    mappings[client_id] = mapping;
    await writeMappings(mappings);

    return NextResponse.json({ ok: true, client_id });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
