// SPDX-License-Identifier: AGPL-3.0-only
// The real root layout is app/[locale]/layout.tsx. This one only exists so
// app/not-found.tsx can render for paths outside any locale.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
