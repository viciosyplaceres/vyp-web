import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center px-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo/vyp-wordmark.png"
            alt="Vicios & Placeres"
            width={220}
            height={71}
            priority
            className="h-8 w-auto sm:h-9"
          />
        </Link>
      </div>
    </header>
  );
}
