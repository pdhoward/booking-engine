import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Calendar from '@/models/Calendar';
import { validateCalendarIntegrity } from '@/lib/utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await dbConnect();
  const calendar = await Calendar.findById(params.id);
  if (!calendar) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(calendar);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await dbConnect();
  const data = await req.json();
  try {
    validateCalendarIntegrity(data);
    const calendar = await Calendar.findByIdAndUpdate(params.id, data, { new: true });
    return NextResponse.json(calendar);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}