import { BrandBar } from "./brand-bar";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="border-b border-slate-200 pb-5">
          <BrandBar />
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Home</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Keep your local coding projects ready for an agent session.
          </p>
        </header>
      </div>
    </main>
  );
}
