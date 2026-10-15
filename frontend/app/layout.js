import { Kanit } from "next/font/google";
import "./globals.css";

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "Short URL – ย่อลิงก์",
  description: "ย่อ URL ให้สั้น สร้าง QR Code และดูสถิติการคลิก",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={`${kanit.variable} h-full antialiased`}>
      <body className="relative min-h-full flex flex-col border-t-4 border-ink">{children}</body>
    </html>
  );
}
