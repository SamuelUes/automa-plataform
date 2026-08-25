import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <SearchX className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="font-mono text-xs text-muted-foreground mt-4">404 / NOT FOUND</p>
        <h1 className="text-2xl font-semibold mt-2">No encontramos esta página</h1>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium mt-6 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Volver al Command Center
        </Link>
      </div>
    </main>
  );
}
