import "./globals.css";

export const metadata = {
  title: "ECS Commerce Classroom Demo",
  description: "A microservices-based ecommerce storefront built for Docker Compose and AWS ECS."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

