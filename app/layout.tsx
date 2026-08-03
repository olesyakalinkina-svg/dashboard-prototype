import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Аналитика хоккейного клуба",
  description: "Дашборд продаж билетов, мерча, абонементов и рекламных акций",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="min-h-screen overflow-x-clip bg-[var(--background)] antialiased">
        {children}
      </body>
    </html>
  );
}
