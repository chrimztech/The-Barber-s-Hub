import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Deepcuts Hair Studio" },
      { name: "description", content: "Our story and our team of master barbers." },
    ],
  }),
  component: About,
});

function About() {
  const { data } = useQuery({
    queryKey: ["barbers"],
    queryFn: async () =>
      (await supabase.from("barbers").select("*").eq("status", "active")).data ?? [],
  });
  return (
    <SiteLayout>
      <section className="container-x pt-16 pb-12 max-w-3xl">
        <p className="text-primary text-xs tracking-[0.4em] uppercase mb-3">Our story</p>
        <h1 className="font-display text-5xl md:text-6xl">A craft. A chair. A community.</h1>
        <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
          Founded in 2014, Deepcuts Hair Studio began as a single chair in Chelstone with one
          obsession: a sharper, slower, more deliberate cut. A decade later we're a shop and a
          marketplace — curating the same gear our barbers reach for daily.
        </p>
      </section>
      <section className="container-x pb-24">
        <h2 className="font-display text-3xl mb-8">The team</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(data ?? []).map((b) => (
            <div key={b.id} className="border border-border/60 bg-card">
              <div className="aspect-[4/5] bg-muted overflow-hidden">
                {b.photo_url && (
                  <img
                    src={b.photo_url}
                    alt={b.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="p-5">
                <div className="text-xs uppercase tracking-widest text-primary">{b.specialty}</div>
                <h3 className="font-display text-2xl mt-1">{b.name}</h3>
                <p className="text-sm text-muted-foreground mt-2">{b.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
