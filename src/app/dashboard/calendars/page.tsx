import { Button } from '@/components/ui/button';
import Link from 'next/link'; 

async function getCalendars() {
  const res = await fetch('http://localhost:3000/api/calendars'); // In prod, use relative /api
  return res.json();
}

export default async function CalendarsPage() {
  const calendars = await getCalendars();

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
      <Button onClick={async () => {
        await fetch('/api/calendars', { method: 'POST', body: JSON.stringify({ name: 'New Calendar' }) });
        // Refresh
      }}>Create New</Button>
    </div>
  );
}