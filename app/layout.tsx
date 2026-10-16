import type { Metadata } from "next";
import "./globals.css";
import { DesktopOnlyGuard } from "@/components/studio/DesktopOnlyGuard";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://studio.liorandb.com"),
  title: {
    default: "LioranDB Studio — Developer Control Plane",
    template: "%s | LioranDB Studio",
  },
  description:
    "Secure web management console and control plane for LioranDB deployments. Browse collections, evaluate live queries, configure granular RBAC security, and inspect Raft cluster topologies with editorial clarity.",
  applicationName: "LioranDB Studio",
  authors: [{ name: "LioranDB Team" }],
  keywords: [
    "LioranDB",
    "Database Studio",
    "Developer Control Plane",
    "Raft Cluster",
    "NoSQL",
    "Document Database",
    "gRPC",
    "Query Workbench",
  ],
  alternates: {
    canonical: "https://studio.liorandb.com",
  },
  openGraph: {
    title: "LioranDB Studio — Developer Control Plane",
    description:
      "A quietly confident developer-platform console and control plane for LioranDB deployments. Browse collections, evaluate live queries, and inspect Raft cluster topologies.",
    url: "https://studio.liorandb.com",
    siteName: "LioranDB Studio",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LioranDB Studio — Developer Control Plane",
    description:
      "A quietly confident developer-platform console and control plane for LioranDB deployments.",
  },
};

const themeBootstrapScript = `
(function() {
  try {
    var saved = localStorage.getItem('liorandb_theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <DesktopOnlyGuard>{children}</DesktopOnlyGuard>
      </body>
    </html>
  );
}
