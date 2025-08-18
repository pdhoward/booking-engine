import { Engine } from 'json-rules-engine';
import { parseISO, differenceInDays, format } from 'date-fns';

export async function evaluateBooking(bookingData: any, calendar: any) {
  const engine = new Engine(calendar.rules);

  engine.addFact('isHoliday', (params, almanac) => {
    const startDate = parseISO(bookingData.start);
    return calendar.holidays.some((h: any) => format(startDate, 'yyyy-MM-dd') === format(h.date, 'yyyy-MM-dd'));
  });

  engine.addFact('nights', differenceInDays(parseISO(bookingData.end), parseISO(bookingData.start)));

  const { events } = await engine.run(bookingData);

  if (events.length > 0) {
    throw new Error(events.map(e => e.params?.message).join('; '));
  }
}