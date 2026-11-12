import { getShop } from "@/lib/db";
import { Shell } from "../shell";
import { Flash } from "../nav";
import { FixedCosts } from "../components/fixed-costs";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export default async function Expenses({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const shop = await getShop();
  return (
    <Shell active="expenses" shopName={shop.name}>
      <header className="pagehead">
        <div>
          <h1>Expenses</h1>
          <p className="sub">Costs you pay whether or not you sell. They turn profit after ads into net profit.</p>
        </div>
      </header>
      <Flash saved={sp.saved} error={sp.error} />
      <FixedCosts back="/expenses" />
    </Shell>
  );
}
