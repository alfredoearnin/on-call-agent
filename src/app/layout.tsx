import type { Metadata } from "next";
import "./globals.css";
import { SidebarNav } from "@/components/sidebar-nav";
import { TopBar } from "@/components/top-bar";

export const metadata: Metadata = {
  title: "On-call Ops Dashboard",
  description:
    "Daily on-call incidents and learned Datadog monitor-tuning recommendations.",
};

// Runs before paint to apply the stored theme (light/dark/system) and avoid a
// flash of the wrong theme on load. Default is "system".
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <div className="flex min-h-screen">
          <SidebarNav />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="flex-1 overflow-x-hidden px-6 py-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
