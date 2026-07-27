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
import { obtenerNoLeidos } from "@/app/actions/chat";
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
  // Nombre corto para el diálogo de instalación de escritorio y como respaldo
  // en Android: el nombre largo de la pestaña del navegador no cabe bien ahí.
  applicationName: "VYP",
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
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Vicios & Placeres — Fuente Álamo, Murcia",
      },
    ],
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
  const noLeidos = sesion?.esMiembro ? await obtenerNoLeidos().catch(() => 0) : 0;

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* El navegador puede disparar "beforeinstallprompt" antes de que
            React monte InstalarApp, y el evento se pierde para siempre si
            nadie lo escucha a tiempo. Se captura aquí, lo antes posible, y
            se guarda en window para que el componente lo recoja luego. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__vypInstallEvent=e;window.dispatchEvent(new Event('vyp-install-ready'));});`,
          }}
        />
      </head>
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
            userId={sesion?.userId ?? null}
            noLeidosInicial={noLeidos}
          />
        </ReproductorProvider>
        <RegistrarSW />
        <InstalarApp />
        <ActivarAvisosAuto haySesion={Boolean(sesion)} />
      </body>
    </html>
  );
}
