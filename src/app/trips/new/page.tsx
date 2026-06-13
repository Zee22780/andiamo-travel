import { IntakeChat } from "@/components/intake/intake-chat";

export const metadata = { title: "New trip — Waypoint" };

export default function NewTripPage() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-surface-variant bg-surface-warm px-6 py-4">
        <span className="font-headline text-2xl font-black text-primary">
          Waypoint
        </span>
        <span className="text-sm font-medium text-on-surface-variant">
          Tell us about your trip
        </span>
      </header>
      <IntakeChat />
    </div>
  );
}
