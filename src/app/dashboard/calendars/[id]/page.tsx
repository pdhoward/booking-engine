// app/dashboard/calendars/[id]/page.tsx
import { CalendarManager } from "@/components/CalendarManager";

async function getCalendar(id: string) {
  const res = await fetch(`/api/calendars/${id}`);
  if (!res.ok) {
    throw new Error('Failed to fetch calendar');
  }
  return res.json();
}

export default async function CalendarPage({ params }: { params: { id: string } }) {
  const calendar = await getCalendar(params.id);

  return (
    <div className="p-8">
      <h2 className="text-2xl mb-4">Edit Calendar: {calendar.name}</h2>
      <CalendarManager 
        initialBlackouts={calendar.blackouts} // Assume blackouts are strings like 'yyyy-MM-dd'; adjust if needed
        calendarId={params.id} // Pass ID for client-side saves
      />
    </div>
  );
}