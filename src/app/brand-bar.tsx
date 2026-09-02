import { BrandLink } from "./brand-link";
import { MainNav } from "./main-nav";

export function BrandBar() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <BrandLink />
      <MainNav />
    </div>
  );
}
