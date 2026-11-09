"use client";
import * as React from "react";
import { Search, FolderGit2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { portfolioItems as portfolioItemsSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";

export default function PortfolioMatcherPage() {
  const portfolioItems = useEntity("portfolio", portfolioItemsSeed);
  const [query, setQuery] = React.useState("");
  const [applied, setApplied] = React.useState("");

  // Simple keyword + related-term ranking over title, tags and semantic hints.
  const ranked = React.useMemo(() => {
    const terms = applied.toLowerCase().split(/[^a-z0-9+#]+/).filter((t) => t.length > 2);
    if (terms.length === 0) return portfolioItems.map((p: any) => ({ p, score: 0 }));
    return portfolioItems
      .map((p: any) => {
        const hay = `${p.title} ${(p.tags ?? []).join(" ")} ${(p.semantic ?? []).join(" ")}`.toLowerCase();
        return { p, score: terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0) };
      })
      .filter((x: any) => x.score > 0)
      .sort((a: any, b: any) => b.score - a.score);
  }, [applied, portfolioItems]);

  return (
    <>
      <PageHeader
        title="Semantic Portfolio Matcher"
        description="ChromaDB matches meaning, not just keywords — 'event ticketing' matches 'booking reservation system'."
      />

      <Card>
        <CardHeader>
          <CardTitle>Find matching portfolio pieces</CardTitle>
          <CardDescription>Paste a job description or keywords — we'll semantically surface relevant work.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setApplied(query.trim()); }}>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. event ticketing system, booking reservation..."
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="gradient">
              <Sparkles className="size-4" /> Match
            </Button>
            {applied && <Button type="button" variant="outline" onClick={() => { setQuery(""); setApplied(""); }}>Clear</Button>}
          </form>
          {applied && <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">{ranked.length} {ranked.length === 1 ? "match" : "matches"} for &ldquo;{applied}&rdquo;</p>}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {portfolioItems.length === 0 && <p className="col-span-full rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">No portfolio pieces yet.</p>}
        {applied && ranked.length === 0 && portfolioItems.length > 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Nothing matches that description. Try different keywords.</p>}
        {ranked.map(({ p }: any) => (
          <Card key={p.id} className="overflow-hidden">
            <div className="aspect-video overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt={p.title} className="h-full w-full object-cover" />
            </div>
            <CardContent className="p-5">
              <h3 className="font-semibold">{p.title}</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(p.tags ?? []).map((t: string) => (
                  <Badge key={t} variant="secondary">{t}</Badge>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Semantic matches: {(p.semantic ?? []).join(", ")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
