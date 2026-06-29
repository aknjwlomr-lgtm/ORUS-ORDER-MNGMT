import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getAppName } from "@/lib/settings";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const appName = await getAppName();
  return {
    title: `${appName} Order Manager`,
    description: `Receive, manage, track and analyse cake orders for ${appName}.`,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: appName,
      statusBarStyle: "default",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#b00d28",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Dev only: an already-installed service worker (from a prod build or the
            installed PWA) keeps intercepting Turbopack's dev chunks and triggers
            ChunkLoadError, which also stops PwaRegister's own chunk from loading - a
            deadlock. This inline script isn't bundled, so it runs even when chunks
            fail. It keys off serviceWorker.controller (the actual broken state):
            while a SW still controls the page it unregisters everything, drops the
            caches and reloads (a few retries, to avoid a loop); once the page is
            SW-free it just clears any leftovers and resets the retry counter, so a
            SW that reappears later gets cleaned up the same way. */}
        {process.env.NODE_ENV !== "production" && (
          <script
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: `(function(){if(!('serviceWorker' in navigator))return;var K='sw-clear-tries';function nuke(){return navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister();}));}).then(function(){return typeof caches!=='undefined'?caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);}));}):null;});}if(navigator.serviceWorker.controller){var t=parseInt(sessionStorage.getItem(K)||'0',10);nuke().then(function(){if(t<3){sessionStorage.setItem(K,String(t+1));location.reload();}});}else{sessionStorage.removeItem(K);nuke();}})();`,
            }}
          />
        )}
        {process.env.NODE_ENV === "production" && <PwaRegister />}
        {children}
      </body>
    </html>
  );
}
