import "./globals.css";
import "@fontsource-variable/open-sans";
import { ThemeProvider } from "next-themes";
import { Nav } from "@/components/nav";

export const metadata = {
  metadataBase: new URL("https://natural-language-postgres.vercel.app"),
  title: "Advisor Intelligence Cockpit",
  description:
    "AI-powered advisor dashboard with client intelligence, morning briefings, and natural language analysis for an investment advisor CRM.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Nav />
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
