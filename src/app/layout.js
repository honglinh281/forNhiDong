import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "XNK Checker",
  description:
    "Công cụ đối chiếu HS Code và kiểm tra tên tiếng Anh hàng hóa xuất nhập khẩu.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className={inter.variable}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
