import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.6 5.82c-.86-.85-1.34-2-1.34-3.2h-3.14v13.2a2.6 2.6 0 1 1-2.6-2.6c.24 0 .48.03.7.09V10.1a5.75 5.75 0 0 0-.7-.04A5.76 5.76 0 1 0 15.3 15.8V9.36a7.06 7.06 0 0 0 4.13 1.33V7.55a3.9 3.9 0 0 1-2.83-1.73Z" />
    </svg>
  );
}

export function Footer() {
  const { business } = useSiteSettings();
  return (
    <footer className="mt-24 border-t border-border bg-card/40">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <img
              src="/savior_logo.jpg"
              alt="Deepcuts Hair Studio"
              className="h-12 w-12 rounded-full object-cover"
            />
            <div className="font-display text-2xl tracking-widest">
              DEEPCUTS <span className="text-primary">HAIR STUDIO</span>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            The smart, detailed hairdresser. Premium barbering and curated grooming equipment.
          </p>
          <div className="mt-6 flex gap-3">
            <a
              href={business.instagram}
              aria-label="Deepcuts Hair Studio on Instagram"
              className="rounded-full border border-border p-2 hover:border-primary hover:text-primary"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href={business.facebook}
              aria-label="Deepcuts Hair Studio on Facebook"
              className="rounded-full border border-border p-2 hover:border-primary hover:text-primary"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href={business.twitter}
              aria-label="Deepcuts Hair Studio on Twitter"
              className="rounded-full border border-border p-2 hover:border-primary hover:text-primary"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              href={business.tiktok}
              aria-label="Deepcuts Hair Studio on TikTok"
              className="rounded-full border border-border p-2 hover:border-primary hover:text-primary"
            >
              <TikTokIcon className="h-4 w-4" />
            </a>
            <a
              href={business.youtube}
              aria-label="Deepcuts Hair Studio on YouTube"
              className="rounded-full border border-border p-2 hover:border-primary hover:text-primary"
            >
              <Youtube className="h-4 w-4" />
            </a>
          </div>
        </div>
        <div>
          <h4 className="mb-4 text-xs uppercase tracking-widest text-primary">Explore</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/services">Services</Link>
            </li>
            <li>
              <Link to="/shop">Shop</Link>
            </li>
            <li>
              <Link to="/book">Book</Link>
            </li>
            <li>
              <Link to="/about">About</Link>
            </li>
            <li>
              <Link to="/contact">Contact</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-xs uppercase tracking-widest text-primary">Visit</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>{business.address}</li>
            <li>
              <a href={`tel:${business.phone}`} className="hover:text-primary">
                {business.phone}
              </a>
            </li>
            <li>{business.hours}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {business.business_name}. All rights reserved.
      </div>
    </footer>
  );
}
