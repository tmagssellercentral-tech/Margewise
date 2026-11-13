// Plain-language definitions of the ad efficiency figures, shown under them wherever they appear.
export function AdMetricsGuide({ open = false }: { open?: boolean }) {
  return (
    <details className="guide" open={open}>
      <summary>What do MER, blended ROAS, break-even ROAS and POAS mean?</summary>
      <dl>
        <div>
          <dt>MER (marketing efficiency ratio)</dt>
          <dd>All store sales ÷ all ad spend. Counts every sale, including organic, email and repeat customers, using Shopify&apos;s real
            sales. The honest big-picture view of whether marketing as a whole is working.</dd>
        </div>
        <div>
          <dt>Blended ROAS</dt>
          <dd>Sales the ad platforms say their ads brought in, added up across all platforms ÷ all ad spend. Platforms use their own
            attribution and can claim the same sale twice, so this is often higher than reality. If it&apos;s above MER, the platforms are
            probably double-counting.</dd>
        </div>
        <div>
          <dt>Break-even ROAS</dt>
          <dd>The MER at which ads exactly pay for themselves after product cost, payment fees, courier, packaging and returns. Above it,
            ads make money; below it, they lose money.</dd>
        </div>
        <div>
          <dt>POAS (profit on ad spend)</dt>
          <dd>Profit before ads ÷ ad spend. 1.30 means every 1 spent on ads brought back 1.30 of profit, so ads made 0.30. Below 1.00
            ads are losing money, whatever ROAS says. The best single number for deciding whether to scale.</dd>
        </div>
      </dl>
    </details>
  );
}
