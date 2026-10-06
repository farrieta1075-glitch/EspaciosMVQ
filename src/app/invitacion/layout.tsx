import type { Metadata } from "next";
import { Cormorant_Garamond, Great_Vibes, Outfit } from "next/font/google";
import { quinceEvent } from "@/lib/invitacion/event";
import "./invitacion.css";

const script = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-invite-script",
});

const serif = Cormorant_Garamond({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-invite-serif",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-invite-sans",
});

export const metadata: Metadata = {
  title: `${quinceEvent.headline} · ${quinceEvent.honoreeFirstName}`,
  description: `Te invitamos a celebrar los quince años de ${quinceEvent.honoreeFullName}.`,
};

export default function InvitacionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${script.variable} ${serif.variable} ${sans.variable} invite-root`}
    >
      {children}
    </div>
  );
}
