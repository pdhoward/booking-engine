# Booking Engine — Instructions

Welcome! This guide covers creating calendars, defining units (inventory), and testing reservations.

> Tip: This page is rendered from your GitHub repo. Update **Instructions.md** and refresh to see changes.

---

## 1) Create & Manage Calendars

Calendars define rules and pricing seasons used to validate bookings.

### Steps

1. **Open**: `/calendar`
2. **Meta** (Navbar → Meta):
   - Name, Category (Reservations/Appointments), Owner, Currency
   - Cancellation policy: hours & fee
3. **Lead Time**: min/max days in advance
4. **Blackouts**:
   - Click dates or drag on the grid in *Blackout* mode
5. **Holidays**:
   - Click or drag in *Holiday* mode and set minimum nights
6. **Min Stay by Weekday**:
   - Configure in the right rail (e.g., Fri: 2 nights)
7. **Seasons** (optional):
   - Add date ranges with a price (if used by your pricing logic)
8. **Save**:
   - The Save button glows when unsaved changes exist
   - Calendars are versioned; *(name, version)* is unique

---

## 2) Define Units (Inventory)

Units are bookable entities (rooms, villas, cabins, conference rooms).

### Steps

1. **Open**: `/inventory`
2. **Basics**:
   - Name, Unit #, Type, Description
3. **Pricing**:
   - Rate & Currency (captured at booking time)
4. **Configuration**:
   - Square feet, View, Beds, Amenities (Shower, Tub, Hot tub, Sauna, ADA)
5. **Link Calendars**:
   - Choose a calendar and set an **Effective Date**
   - You can link multiple calendars; the engine auto-selects the latest effective date **≤** check-in
6. **Save** the unit

> **Effective-date selection**
> When checking availability, the engine chooses the unit’s calendar link with the **latest** `effectiveDate` that is **≤** the requested start date.

---

## 3) Test Reservations

Use the test page to simulate and confirm bookings, which also drop a pill onto the calendar.

### Steps

1. **Open**: `/test`
2. **Select Unit**
3. **Pick Dates**
   - Reservations: check-in & check-out (end date is inclusive for display)
   - Appointments: just start date
4. **Check Availability**
   - Engine evaluates:
     - Lead time window
     - Blackouts & holidays (+ min nights)
     - Min stay by weekday
     - **Existing reservations overlap** (confirmed/hold)
   - If available, a quote is shown (`rate × nights`)
5. **Confirm**
   - Persists to MongoDB as a reservation (end date stored **exclusive**)
   - Shows a success card with details

---

## Data Model (abridged)

### Calendar
- `(name, version)` unique
- `blackouts: Date[]`
- `holidays: { date: Date; minNights: number }[]`
- `leadTime: { minDays, maxDays }`
- `minStayByWeekday: Record<string, number>`
- `seasons: { start: Date; end: Date; price: number }[]`
- `cancelHours, cancelFee`

### Unit
- `name, unitNumber, type, description, rate, currency`
- `config: { squareFeet, view, beds[], shower, bathtub, hotTub, sauna, ada }`
- `calendars: { calendarId, name, version, effectiveDate }[]`

### Reservation
- `unitId, unitName, unitNumber`
- `calendarId`
- `startDate (inclusive), endDate (exclusive)`
- `rate, currency`
- `cancelHours, cancelFee`
- `status: "hold" | "confirmed" | "cancelled"`

---

## Tips

- **Dirty states**: Unsaved changes show a subtle indicator; browser close is guarded.
- **Overlap**: Availability checks fetch existing reservations and block overlaps upfront.
- **Visual cues**: Confirmed reservations appear as pills on the calendar immediately.

Happy building!
