import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Calendar from '@/models/Calendar';
import { validateCalendarIntegrity } from '@/lib/utils';

export async function POST(req: NextRequest) {
  await dbConnect();
  const data = await req.json();
  try {
    validateCalendarIntegrity(data);
    const calendar = await Calendar.create(data);
    return NextResponse.json(calendar, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function GET() {
  await dbConnect();
  const calendars = await Calendar.find({});
  return NextResponse.json(calendars);
}