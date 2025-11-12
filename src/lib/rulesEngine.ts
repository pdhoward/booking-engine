import { Engine } from 'json-rules-engine';
import { parseISO, differenceInDays, format } from 'date-fns';

export async function evaluateBooking(
  bookingData: { start: string; end: string },
  calendar: {
    rules: any[];
    holidays: { date: string | Date }[];
  }
): Promise<void> {
  const engine = new Engine(calendar.rules);

  // Fact: check if start date is a holiday
  engine.addFact('isHoliday', async (_params: Record<string, any>, _almanac) => {
    const startDate = parseISO(bookingData.start);
    return calendar.holidays.some(
      (h) => format(startDate, 'yyyy-MM-dd') === format(new Date(h.date), 'yyyy-MM-dd')
    );
  });

  // Fact: number of nights in the stay
  engine.addFact('nights', async () =>
    differenceInDays(parseISO(bookingData.end), parseISO(bookingData.start))
  );

  // Run engine with booking data as input
  const { events } = await engine.run(bookingData);

  if (events.length > 0) {
    const messages = events
      .map((e) => e.params?.message)
      .filter(Boolean)
      .join('; ');
    throw new Error(messages || 'Booking violates one or more rules.');
  }
}
