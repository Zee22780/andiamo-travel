import { IntakeChat } from "@/components/intake/intake-chat";

export const metadata = { title: "New trip — Andiamo" };

export default function NewTripPage() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-surface-variant bg-surface-warm px-6 py-4">
        <a href="/" className="font-headline text-2xl font-black text-primary">
          Andiamo
        </a>
        <span className="text-sm font-medium text-on-surface-variant">
          Tell us about your trip
        </span>
      </header>
      <IntakeChat />
    </div>
  );
}
