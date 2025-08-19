// src/actions/createCalendar.ts
'use server';

import dbConnect from '@/lib/db';
import CalendarModel from '@/models/Calendar';
import { validateCalendarIntegrity } from '@/lib/utils';
import { revalidatePath } from 'next/cache';

// Align types with your client form. If your client sends ISO dates (recommended),
// keep these as (string | Date) and normalize below.
type CalendarType = 'hotel' | 'appointment';
type VersionMode = 'version' | 'overwrite' | 'cancel';

interface HolidayRuleInput {
  date: string | Date;
  minNights: number;
}

interface CalendarFormData {
  name: string;
  owner: string;
  type: CalendarType;
  blackouts: (string | Date)[];
  recurringBlackouts: string; // RRULE string
  holidays: HolidayRuleInput[];
  rules: { conditions: any; event: any }[];
  currency: string;
  cancellationPolicy: { hours: number; fee: number };
  versionMode?: VersionMode; // optional for backward-compat; default to 'version'
}

/* -------------------- helpers -------------------- */

function toDate(d: string | Date): Date {
  const out = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(out.getTime())) {
    throw new Error(`Invalid date: ${String(d)}`);
  }
  // normalize to local midnight for day-based rules (optional):
  out.setHours(0, 0, 0, 0);
  return out;
}

function normalizeInput(formData: CalendarFormData) {
  return {
    ...formData,
    versionMode: formData.versionMode ?? 'version',
    blackouts: (formData.blackouts ?? []).map(toDate),
    holidays: (formData.holidays ?? []).map(h => ({
      date: toDate(h.date),
      minNights: Number(h.minNights ?? 1),
    })),
  };
}

/**
 * Given a base name, returns the next available "vN" version (e.g., "Base v2", "Base v3", ...)
 * without mutating the provided base.
 */
async function nextVersionName(baseName: string): Promise<string> {
  let version = 2;
  // try "Base v2", "Base v3", ...
  let candidate = `${baseName} v${version}`;
  // eslint-disable-next-line no-await-in-loop
  while (await CalendarModel.findOne({ name: candidate }).lean().exec()) {
    version += 1;
    candidate = `${baseName} v${version}`;
  }
  return candidate;
}

/* -------------------- action -------------------- */

export async function createCalendarAction(rawFormData: CalendarFormData) {
  await dbConnect();

  // Normalize incoming payload
  const formData = normalizeInput(rawFormData);
  const { versionMode } = formData;

  // We’ll use this name for lookup; may change for versioning
  const baseName = formData.name.trim();
  if (!baseName) throw new Error('Name is required.');

  const existing = await CalendarModel.findOne({ name: baseName }).exec();

  let finalName = baseName;

  if (existing) {
    if (versionMode === 'cancel') {
      throw new Error(`A calendar named "${baseName}" already exists (versionMode=cancel).`);
    }

    if (versionMode === 'overwrite') {
      // replace existing document (preserve the exact name)
      const dataToWrite = {
        ...formData,
        name: baseName,
      };

      try {
        validateCalendarIntegrity(dataToWrite);
        // Replace the whole document fields except _id. Using findOneAndUpdate to preserve _id.
        await CalendarModel.findOneAndUpdate(
          { name: baseName },
          dataToWrite,
          { new: true, runValidators: true }
        ).exec();

        revalidatePath('/dashboard/calendars');
        return { ok: true, name: baseName, mode: 'overwrite' as const };
      } catch (error) {
        console.error(error);
        revalidatePath('/dashboard/calendars');
        throw error;
      }
    }

    // versionMode === 'version' (default)
    finalName = await nextVersionName(baseName);
  }

  // Create a new calendar (either no conflict, or versioned name)
  const dataToCreate = {
    ...formData,
    name: finalName,
    rules: formData.rules, // already normalized externally
  };

  try {
    validateCalendarIntegrity(dataToCreate);
    await CalendarModel.create(dataToCreate);
    revalidatePath('/dashboard/calendars');
    return { ok: true, name: finalName, mode: existing ? ('version' as const) : ('create' as const) };
  } catch (error) {
    console.error(error);
    revalidatePath('/dashboard/calendars');
    throw error;
  }
}
