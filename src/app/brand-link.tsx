import Link from "next/link";

export function BrandLink() {
  return (
    <Link
      href="/"
      className="inline-flex rounded text-sm font-semibold text-slate-900 transition hover:text-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-100"
    >
      AgentHub
    </Link>
  );
}
