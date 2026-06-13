export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="font-headline text-5xl font-black text-primary">
        Andiamo
      </h1>
      <p className="max-w-md text-center text-on-surface-variant">
        An AI travel companion for long trips — plan it, live it, adapt it.
      </p>
      <div className="flex items-center gap-3">
        <a
          href="/trips/new"
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white transition-transform hover:opacity-90 active:scale-95"
        >
          Plan a new trip
        </a>
        <a
          href="/trips"
          className="rounded-full border border-surface-variant px-6 py-2.5 text-sm font-bold text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary"
        >
          Your trips
        </a>
      </div>
    </main>
  );
}
