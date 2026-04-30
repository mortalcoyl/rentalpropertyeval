import "./globals.css";

export const metadata = {
  title: "Rental Property Outcome Calculator",
  description: "Compare rental property purchase vs. market investment.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
