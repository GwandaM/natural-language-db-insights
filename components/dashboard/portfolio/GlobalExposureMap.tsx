"use client";

import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { GeographicExposureBucket } from "@/lib/portfolio-deepdive";
import { ChartCard, formatZar } from "./ChartCard";

// world-atlas countries-110m.json uses numeric ISO codes; map each to ISO3.
// This map only covers ISO3 codes we emit from the geographic heuristic —
// expand as the inference adds more countries.
const ISO_NUMERIC_TO_ISO3: Record<string, string> = {
  "004": "AFG", "008": "ALB", "010": "ATA", "012": "DZA", "016": "ASM",
  "020": "AND", "024": "AGO", "028": "ATG", "031": "AZE", "032": "ARG",
  "036": "AUS", "040": "AUT", "044": "BHS", "048": "BHR", "050": "BGD",
  "051": "ARM", "052": "BRB", "056": "BEL", "060": "BMU", "064": "BTN",
  "068": "BOL", "070": "BIH", "072": "BWA", "076": "BRA", "084": "BLZ",
  "090": "SLB", "096": "BRN", "100": "BGR", "104": "MMR", "108": "BDI",
  "112": "BLR", "116": "KHM", "120": "CMR", "124": "CAN", "132": "CPV",
  "140": "CAF", "144": "LKA", "148": "TCD", "152": "CHL", "156": "CHN",
  "158": "TWN", "170": "COL", "174": "COM", "178": "COG", "180": "COD",
  "188": "CRI", "191": "HRV", "192": "CUB", "196": "CYP", "203": "CZE",
  "204": "BEN", "208": "DNK", "214": "DOM", "218": "ECU", "222": "SLV",
  "226": "GNQ", "231": "ETH", "232": "ERI", "233": "EST", "242": "FJI",
  "246": "FIN", "250": "FRA", "262": "DJI", "266": "GAB", "268": "GEO",
  "270": "GMB", "275": "PSE", "276": "DEU", "288": "GHA", "300": "GRC",
  "304": "GRL", "320": "GTM", "324": "GIN", "328": "GUY", "332": "HTI",
  "340": "HND", "348": "HUN", "352": "ISL", "356": "IND", "360": "IDN",
  "364": "IRN", "368": "IRQ", "372": "IRL", "376": "ISR", "380": "ITA",
  "384": "CIV", "388": "JAM", "392": "JPN", "398": "KAZ", "400": "JOR",
  "404": "KEN", "408": "PRK", "410": "KOR", "414": "KWT", "417": "KGZ",
  "418": "LAO", "422": "LBN", "426": "LSO", "428": "LVA", "430": "LBR",
  "434": "LBY", "440": "LTU", "442": "LUX", "450": "MDG", "454": "MWI",
  "458": "MYS", "462": "MDV", "466": "MLI", "478": "MRT", "484": "MEX",
  "496": "MNG", "498": "MDA", "499": "MNE", "504": "MAR", "508": "MOZ",
  "512": "OMN", "516": "NAM", "524": "NPL", "528": "NLD", "540": "NCL",
  "548": "VUT", "554": "NZL", "558": "NIC", "562": "NER", "566": "NGA",
  "578": "NOR", "586": "PAK", "591": "PAN", "598": "PNG", "600": "PRY",
  "604": "PER", "608": "PHL", "616": "POL", "620": "PRT", "624": "GNB",
  "626": "TLS", "630": "PRI", "634": "QAT", "642": "ROU", "643": "RUS",
  "646": "RWA", "682": "SAU", "686": "SEN", "688": "SRB", "694": "SLE",
  "702": "SGP", "703": "SVK", "704": "VNM", "705": "SVN", "706": "SOM",
  "710": "ZAF", "716": "ZWE", "724": "ESP", "728": "SSD", "729": "SDN",
  "740": "SUR", "748": "SWZ", "752": "SWE", "756": "CHE", "760": "SYR",
  "762": "TJK", "764": "THA", "768": "TGO", "776": "TON", "780": "TTO",
  "784": "ARE", "788": "TUN", "792": "TUR", "795": "TKM", "800": "UGA",
  "804": "UKR", "807": "MKD", "818": "EGY", "826": "GBR", "834": "TZA",
  "840": "USA", "854": "BFA", "858": "URY", "860": "UZB", "862": "VEN",
  "882": "WSM", "887": "YEM", "894": "ZMB",
};

interface GlobalExposureMapProps {
  data: GeographicExposureBucket[];
  totalValue: number;
}

function exposureColor(pct: number, maxPct: number): string {
  if (pct <= 0) return "hsl(var(--muted))";
  const intensity = Math.min(1, pct / Math.max(maxPct, 0.0001));
  const lightness = 82 - intensity * 50;
  return `hsl(200 95% ${lightness}%)`;
}

export function GlobalExposureMap({ data, totalValue }: GlobalExposureMapProps) {
  const [hovered, setHovered] = useState<GeographicExposureBucket | null>(null);

  const byIso3 = useMemo(() => {
    const map = new Map<string, GeographicExposureBucket>();
    for (const bucket of data) map.set(bucket.country_iso3, bucket);
    return map;
  }, [data]);

  const maxPct = useMemo(
    () => data.reduce((m, b) => Math.max(m, b.pct), 0),
    [data],
  );

  const regionTotals = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const bucket of data) {
      grouped.set(bucket.region, (grouped.get(bucket.region) ?? 0) + bucket.value);
    }
    return Array.from(grouped, ([region, value]) => ({
      region,
      value,
      pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [data, totalValue]);

  return (
    <ChartCard
      title="Global Exposure"
      caption="Geographic exposure inferred from fund metadata. Replace with a dedicated field once available."
      rightSlot={
        <div>
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground">Total</p>
          <p className="text-sm font-semibold brand-amount">{formatZar(totalValue)}</p>
        </div>
      }
    >
      <div className="rounded-lg bg-muted/30 overflow-hidden">
        <ComposableMap
          projectionConfig={{ scale: 140 }}
          style={{ width: "100%", height: 320 }}
        >
          <ZoomableGroup center={[10, 10]}>
            <Geographies geography="/world-110m.json">
              {({ geographies }) =>
                geographies.map((geo) => {
                  const numericId = String(geo.id ?? "").padStart(3, "0");
                  const iso3 = ISO_NUMERIC_TO_ISO3[numericId];
                  const bucket = iso3 ? byIso3.get(iso3) : undefined;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => setHovered(bucket ?? null)}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        default: {
                          fill: bucket
                            ? exposureColor(bucket.pct, maxPct)
                            : "hsl(var(--muted))",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 0.4,
                          outline: "none",
                        },
                        hover: {
                          fill: "hsl(var(--chart-2))",
                          outline: "none",
                          cursor: bucket ? "pointer" : "default",
                        },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground min-h-[32px]">
          {hovered
            ? `${hovered.country_name} — ${formatZar(hovered.value)} (${hovered.pct.toFixed(1)}%)`
            : "Hover a country to see exposure."}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          By region
        </p>
        <div className="space-y-1.5">
          {regionTotals.map((row) => (
            <div key={row.region} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">{row.region}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatZar(row.value)} · {row.pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-[hsl(var(--chart-2))]"
                  style={{ width: `${Math.min(100, row.pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
