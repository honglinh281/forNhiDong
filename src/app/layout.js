import { Inter } from 'next/font/google';

import '@/app/globals.css';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700', '800']
});

export const metadata = {
  title: 'nhidong',
  description: 'Ứng dụng đối chiếu tờ khai hải quan tự động giữa PDF Form E và Excel.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
