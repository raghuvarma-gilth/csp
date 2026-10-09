import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

/**
 * Per-route metadata.
 *
 * Only the pages a search engine should actually see are listed. Everything
 * behind the sign-in wall falls through to `fallback`, which carries
 * `noindex` — a private progress page has no business in an index, and the
 * previous version advertised routes (/mindpulse, /ar-learning) that no longer
 * exist.
 *
 * The site's address comes from the environment for the same reason it does in
 * scripts/generate-seo.ts: a literal here meant a deployment to any other
 * domain kept emitting canonical and og:url tags pointing at the original
 * preview site, quietly handing it the search ranking.
 */

const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "https://eduverse.example.com").replace(/\/+$/, "");
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

type RouteMeta = {
  title: string;
  description: string;
  jsonLd?: Record<string, unknown>;
};

const routeMeta: Record<string, RouteMeta> = {
  "/": {
    title: "EduVerse — Learn Smarter. Master Faster.",
    description:
      "EduVerse finds the exact concepts you have not mastered, teaches them, and proves the gap is closed with adaptive practice, a personalised roadmap and an AI tutor grounded in your course material.",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          name: "EduVerse",
          url: SITE_URL,
          logo: OG_IMAGE,
        },
        {
          "@type": "WebSite",
          name: "EduVerse",
          url: SITE_URL,
          description:
            "Adaptive learning platform that measures concept mastery, detects misconceptions and builds a personalised study roadmap.",
        },
      ],
    },
  },
  "/auth": {
    title: "Sign in — EduVerse",
    description:
      "Sign in to EduVerse to keep your concept mastery, roadmap and practice history in sync.",
  },
  /* The three registration forms are listed individually because `routeMeta` is
     keyed by exact pathname — an unlisted path falls through to `fallback`, which
     carries `noindex`, and these three are public pages that should be findable. */
  "/register": {
    title: "Create a student account — EduVerse",
    description:
      "Create a free EduVerse student account. Your first diagnostic sets up a personalised learning path in minutes.",
  },
  "/register/faculty": {
    title: "Register as a professor or teacher — EduVerse",
    description:
      "Register as EduVerse faculty to author course material. Requests are reviewed by an administrator before contributor access is granted.",
  },
  "/register/industry": {
    title: "Register as an industry professional — EduVerse",
    description:
      "Register as an EduVerse industry contributor and add real-world applications, case studies and worked code alongside the curriculum.",
  },
};

const fallback: RouteMeta = {
  title: "EduVerse",
  description: "Adaptive learning that measures what you know and teaches what you do not.",
};

const RouteSeo = () => {
  const { pathname } = useLocation();
  const known = routeMeta[pathname];
  const meta = known ?? fallback;

  /* A canonical tag is a claim that this URL is the preferred address for a
     real page. Private routes and the 404 are neither, so they get `noindex`
     and no canonical rather than nominating themselves. */
  const canonical = known ? `${SITE_URL}${pathname === "/" ? "/" : pathname}` : null;

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      {canonical && <link rel="canonical" href={canonical} />}
      {!known && <meta name="robots" content="noindex, follow" />}
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:type" content="website" />
      <meta property="og:image" content={OG_IMAGE} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={OG_IMAGE} />
      {meta.jsonLd && <script type="application/ld+json">{JSON.stringify(meta.jsonLd)}</script>}
    </Helmet>
  );
};

export default RouteSeo;
