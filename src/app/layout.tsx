import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import Link from "next/link";
import { navGroups } from "./navigation";

const plusJakarta = localFont({
  src: [
    {
      path: "./fonts/plus-jakarta-regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Barn Gym OS",
  description: "Premium internal operating system for Barn Gym leadership.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const flatNav = navGroups.flatMap((group) => group.items);

  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} antialiased`}>
        <div className="flex min-h-screen flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
          <Sidebar />
          <div className="flex flex-1 flex-col gap-4 lg:hidden">
            <div className="glass-panel py-4">
              <p className="text-xs uppercase tracking-[0.35em] text-muted">
                Navigate
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {flatNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="chip text-xs font-semibold"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col rounded-[36px] border border-emerald-900/10 bg-white/80 text-primary backdrop-blur-xl min-w-0 overflow-x-hidden">
            <TopBar />
            <main className="flex-1 overflow-y-auto px-6 pb-10 pt-6 sm:px-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
