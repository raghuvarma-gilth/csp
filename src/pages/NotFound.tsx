import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Compass, Home, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import EduVerseBackground from "@/components/EduVerseBackground";

/**
 * 404.
 *
 * Three things here were wrong in the prototype and are worth not
 * reintroducing. It logged `console.error` on every render, which made a page
 * behaving exactly as designed look like a crash in the console and buried
 * real errors. It linked home with a bare `<a href="/">`, throwing away the
 * loaded application and refetching the whole bundle to move one route. And it
 * said only "Oops!", which tells someone who mistyped a URL nothing about what
 * to do next.
 *
 * The retired prototype paths (/mindpulse, /talk2code and the rest) never
 * reach here — App.tsx redirects them to their replacements — so anyone
 * landing on this page has a genuinely unknown address.
 */
const NotFound = () => {
  const { pathname } = useLocation();

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <EduVerseBackground />
      <Helmet>
        <title>Page not found · EduVerse</title>
      </Helmet>

      <div className="surface-card w-full max-w-lg rounded-2xl p-8 text-center sm:p-10">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Search className="h-6 w-6" aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">Page not found</h1>

        <p className="mt-3 text-muted-foreground">
          There is nothing at{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">{pathname}</code>. It may have been
          renamed, or the link that brought you here may be out of date.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/home">
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              Go to your dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/learn">
              <Compass className="mr-2 h-4 w-4" aria-hidden="true" />
              Browse the curriculum
            </Link>
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Not signed in?{" "}
          <Link to="/" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to the home page
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default NotFound;
