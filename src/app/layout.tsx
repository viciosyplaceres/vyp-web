import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ReproductorProvider from "@/components/ReproductorProvider";
import BarraReproductor from "@/components/BarraReproductor";
import RegistrarSW from "@/components/RegistrarSW";
import InstalarApp from "@/components/InstalarApp";
import ActivarAvisosAuto from "@/components/ActivarAvisosAuto";
import { getSesion } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://viciosyplaceres.com"),
  title: {
    default: "Vicios & Placeres (VYP)",
    template: "%s · Vicios & Placeres",
  },
  description:
    "Peña Vicios & Placeres — Fuente Álamo de Murcia. Galería de las fiestas, música y gestión de la peña.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VYP",
  },
  icons: {
    icon: "/logo/vyp-icon-192.png",
    apple: "/logo/vyp-icon-192.png",
  },
  openGraph: {
    title: "Vicios & Placeres (VYP)",
    description:
      "Peña Vicios & Placeres — Fuente Álamo de Murcia. Galería de las fiestas, música y gestión de la peña.",
    url: "https://viciosyplaceres.com",
    siteName: "Vicios & Placeres",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vicios & Placeres (VYP)",
    description:
      "Peña Vicios & Placeres — Fuente Álamo de Murcia. Galería de las fiestas, música y gestión de la peña.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sesion = await getSesion();

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-black text-white">
        <ReproductorProvider>
          <Header />
          {/* Hueco inferior: barra de navegación (móvil) + reproductor */}
          <div className="flex flex-1 flex-col pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-24">
            {children}
          </div>
          <BarraReproductor />
          <BottomNav
            esMiembro={sesion?.esMiembro ?? false}
            esAdmin={sesion?.esAdmin ?? false}
            haySesion={Boolean(sesion)}
          />
        </ReproductorProvider>
        <RegistrarSW />
        <InstalarApp />
        <ActivarAvisosAuto haySesion={Boolean(sesion)} />
      </body>
    </html>
  );
}
