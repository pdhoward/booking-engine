// src/actions/createCalendar.ts
'use server';

import dbConnect from '@/lib/db';
import CalendarModel from '@/models/Calendar';
import { validateCalendarIntegrity } from '@/lib/utils';
import { revalidatePath } from 'next/cache';

// Type for form data based on schema (move this here or to a shared types file if needed)
interface CalendarFormData {
  name: string;
  owner: string;
  type: 'hotel' | 'appointment';
  blackouts: Date[];
  recurringBlackouts: string;
  holidays: { date: Date; minNights: number }[];
  rules: { conditions: any; event: any }[]; // Parsed from JSON
  currency: string;
  cancellationPolicy: { hours: number; fee: number };
}

export async function createCalendarAction(formData: CalendarFormData) {
  await dbConnect();

  // Check for duplicate name and handle versioning
  let finalName = formData.name;
  const existing = await CalendarModel.findOne({ name: finalName });
  if (existing) {
    // Simple versioning: Append ' v2', ' v3', etc.
    let version = 2;
    while (await CalendarModel.findOne({ name: `${finalName} v${version}` })) {
      version++;
    }
    finalName = `${finalName} v${version}`;
  }

  const data = {
    ...formData,
    name: finalName,
    // Parse rules if needed (assuming user inputs valid JSON string)
    rules: formData.rules,
  };

  try {
    validateCalendarIntegrity(data);
    await CalendarModel.create(data);
    revalidatePath('/dashboard/calendars');
  } catch (error) {
    // For now, log and revalidate; in production, return error to client
    console.error(error);
    revalidatePath('/dashboard/calendars');
    throw error; // Can catch in client for toast/error display
  }
}