// app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Building2, TestTube2, BookOpenCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background to-muted">
      {/* hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-12">
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <div>
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
              Strategic Machines Booking Engine
            </h1>
            <p className="mt-4 text-muted-foreground text-base md:text-lg">
              Design calendars, define inventory, and test reservations with effective-date logic—
              all in one elegant workflow.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard"><Calendar className="mr-2 h-5 w-5" /> Calendars</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/inventory"><Building2 className="mr-2 h-5 w-5" /> Units</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/test"><TestTube2 className="mr-2 h-5 w-5" /> Test Reservations</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/docs"><BookOpenCheck className="mr-2 h-5 w-5" /> Docs</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-background shadow-sm p-6">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="font-medium">Effective-Date Calendars</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Attach multiple calendars to a unit and automatically pick the one in effect at check-in.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="font-medium">Inventory Modeling</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Rich unit configs (beds, baths, ADA, amenities) with rate & currency snapshots at booking.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="font-medium">Policy-Aware Tests</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Lead time, blackout & holiday rules, min stay by weekday, and overlap detection.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="font-medium">Real-Time Visuals</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Confirmations drop pills directly onto the calendar for instant feedback.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* quick links */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/dashboard">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <div className="font-medium">Calendars</div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Create and version rules, blackouts, and holiday policies.
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/inventory">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  <div className="font-medium">Units</div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Define rooms, villas, configurations, and link calendars.
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/test">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TestTube2 className="h-5 w-5" />
                  <div className="font-medium">Test Reservations</div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Check availability and confirm reservations safely.
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/docs">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <BookOpenCheck className="h-5 w-5" />
                  <div className="font-medium">Docs</div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Read the project instructions sourced from GitHub.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>
    </main>
  );
}
