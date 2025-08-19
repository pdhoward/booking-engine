// dashboard/calendars/page.tsx
import dbConnect from '@/lib/db';
import Calendar from '@/models/Calendar';
import CreateCalendarModal from '@/modals/CreateCalendarModal'; 
import Link from 'next/link';

export default async function CalendarsPage() {
  await dbConnect();
  const calendars = await Calendar.find({});

  return (
    <div className="p-8">
      <h2 className="text-2xl mb-4">Calendars</h2>
      <ul>
        {calendars.map((cal: any) => (
          <li key={cal._id}>
            <Link href={`/dashboard/calendars/${cal._id}`}>{cal.name}</Link>
          </li>
        ))}
      </ul>
      <CreateCalendarModal />
    </div>
  );
}