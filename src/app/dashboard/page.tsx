import Link from 'next/link';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gold-100 to-gold-300 p-8"> {/* Luxury theme */}
      <h1 className="text-4xl font-bold text-gold-800 mb-8">Cypress Resorts Booking Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <Link href="/dashboard/calendars" className="p-4 bg-white rounded shadow hover:bg-gold-50">
          Manage Calendars & Rules
        </Link>
        <Link href="/dashboard/demo-booking" className="p-4 bg-white rounded shadow hover:bg-gold-50">
          Demo Reservation
        </Link>
      </div>
    </div>
  );
}