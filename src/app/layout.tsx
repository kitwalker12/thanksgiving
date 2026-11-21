import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { getPotluck } from "@/lib/potluck";
import { formatSchedule } from "@/lib/time";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-display",
});

const sans = Outfit({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#6e2430",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const potluck = await getPotluck();
    const when = formatSchedule(potluck.event);
    const place = [potluck.event.placeName, potluck.event.placeAddress].filter(Boolean).join(", ");
    const description = [when, place].filter(Boolean).join(" · ") || `Claim a dish for ${potluck.event.title}.`;
    return {
      title: potluck.event.title,
      description,
      robots: { index: false, follow: false },
      openGraph: { title: potluck.event.title, description, type: "website" },
      appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: potluck.event.title },
    };
  } catch {
    return { title: "Friendsgiving", robots: { index: false, follow: false } };
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a className="skip" href="#table">
          Skip to the dishes
        </a>
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
