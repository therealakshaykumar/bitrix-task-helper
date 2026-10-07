import "./globals.css";

export const metadata = { title: "Bitrix Task Helper" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
