// app/dashboard/calendars/[id]/page.tsx
import * as React from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CalendarManager } from "@/components/CalendarManager";

export const dynamic = "force-dynamic"; // optional: avoid caching while editing

async function getBaseUrl() {
  const h = await headers(); // headers() is async in latest Next
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host");
  if (!host) throw new Error("Missing host header");
  return `${proto}://${host}`;
}

async function getCalendar(baseUrl: string, id: string) {
  const res = await fetch(`${baseUrl}/api/calendars/${id}`, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch calendar ${id}`);
  }
  return res.json();
}

export default async function CalendarPage({params}: {params: Promise<{ id: string }>}) {
  const { id } = await params; // ✅ await params
  const baseUrl = await getBaseUrl();
  const calendar = await getCalendar(baseUrl, id);
  if (!calendar) notFound();

  return (
    <div className="p-8">
      <h2 className="text-2xl mb-4">Edit Calendar: {calendar.name}</h2>
      <CalendarManager
        calendarId={id}
        initialBlackouts={calendar.blackouts /* or map to ISO if needed */}
      />
    </div>
  );
}
