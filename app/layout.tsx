import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sika - Assistant IA du Gouvernement du Bénin",
  description: "Posez vos questions sur les procédures administratives et les documents officiels du Bénin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${figtree.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
