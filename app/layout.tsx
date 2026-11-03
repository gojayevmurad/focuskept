// The real root layout (with <html lang dir>) lives in app/[locale]/layout.tsx.
// This pass-through layout exists only because app/not-found.tsx needs one.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
