/**
 * Writes public/sitemap.xml and public/robots.txt. Runs from the `predev` and
 * `prebuild` hooks in package.json.
 *
 * Two things here are deliberate and easy to get wrong again.
 *
 * First, the sitemap lists only the pages an anonymous crawler can actually
 * read. Every feature route — /tutor, /learn, /practice, /code, /progress and
 * the rest — is wrapped in `ProtectedRoute` in src/App.tsx, so a crawler that
 * follows one is bounced to /auth and indexes a sign-in form under a lesson's
 * URL. The previous version of this file listed nine URLs, of which seven
 * redirected and six pointed at features that no longer exist (/ar-learning,
 * /mindpulse, /talk2code, /learnflow, /adaptive-learning, /select-role). A
 * sitemap is a set of claims about what is at an address; these were false.
 *
 * Second, the site's own address is read from the environment. It used to be a
 * literal in this file and a second literal in a checked-in robots.txt, which
 * meant deploying anywhere other than the original preview domain silently
 * published a sitemap pointing at somebody else's site. Both files are now
 * generated from SITE_URL, and the fallback is a reserved example.com name that
 * cannot resolve to a real site, so forgetting SITE_URL produces an obviously
 * wrong sitemap and a warning on stdout rather than a plausible-looking lie.
 *
 * There is no <lastmod>. A real one needs a per-page content date that nothing
 * in this project tracks, and an invented one is a lie told to a crawler that
 * uses it to schedule recrawls.
 */

import { writeFileSync } from "fs";
import { resolve } from "path";
import { loadEnv } from "vite";

/**
 * Read .env the same way Vite does, so SITE_URL / VITE_SITE_URL work from the
 * project's .env file and not only from an exported shell variable. The empty
 * prefix loads unprefixed names too; this script runs at build time on the
 * developer's machine and nothing it reads is written into the bundle.
 */
const env = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "");

/** Where the built site will be served from, without a trailing slash. */
const FALLBACK_URL = "https://eduverse.example.com";
const configured = process.env.SITE_URL ?? env.SITE_URL ?? env.VITE_SITE_URL;
const BASE_URL = (configured ?? FALLBACK_URL).replace(/\/+$/, "");

if (!configured) {
  console.warn(
    `[seo] SITE_URL is not set — falling back to ${FALLBACK_URL}. ` +
      `Set SITE_URL before building for any other domain, or the sitemap will point at the wrong site.`,
  );
}

interface SitemapEntry {
  path: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: string;
}

/**
 * Public routes only. If you add a route to src/App.tsx, it belongs here only
 * if it renders real content for a signed-out visitor.
 */
const PUBLIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/auth", changefreq: "yearly", priority: "0.3" },
  /* The three registration forms. They are listed because they are the only
     other pages a signed-out visitor can read, and because src/components/RouteSeo.tsx
     gives each one a canonical tag and no `noindex` — omitting them here would
     leave pages the app declares indexable missing from the one file that claims
     what the site contains. `/register` outranks the role forms: it is the
     student form and the common case. `/register/*` is a redirect and is not a
     page, so it is not here. */
  { path: "/register", changefreq: "yearly", priority: "0.5" },
  { path: "/register/faculty", changefreq: "yearly", priority: "0.3" },
  { path: "/register/industry", changefreq: "yearly", priority: "0.3" },
];

/**
 * Paths a crawler should not spend its budget on: the signed-in application,
 * and the retired prototype paths that now only redirect. Keeping these out of
 * the index stops a lesson URL from resolving to a sign-in page in search
 * results.
 */
const DISALLOWED = [
  "/home",
  "/learn",
  "/roadmap",
  "/practice",
  "/tutor",
  "/code",
  "/visual",
  "/focus",
  "/progress",
  "/achievements",
  "/profile",
  "/diagnostic",
  "/request-access",
  "/faculty",
  "/research",
  "/admin",
  // Retired paths from the prototype; these 301 to their replacements.
  "/dashboard",
  "/student-dashboard",
  "/adaptive-learning",
  "/learnflow",
  "/talk2code",
  "/ar-learning",
  "/mindpulse",
  "/progress-board",
  "/select-role",
  "/faculty-dashboard",
  "/research-dashboard",
];

const buildSitemap = (list: SitemapEntry[]): string =>
  [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...list.map((e) =>
      [
        `  <url>`,
        `    <loc>${BASE_URL}${e.path}</loc>`,
        `    <changefreq>${e.changefreq}</changefreq>`,
        `    <priority>${e.priority}</priority>`,
        `  </url>`,
      ].join("\n"),
    ),
    `</urlset>`,
    ``,
  ].join("\n");

/**
 * The `Allow:` lines, derived from PUBLIC_ENTRIES rather than listed a second
 * time — otherwise adding a public route allows it in the sitemap and forgets it
 * in robots.txt, which is exactly how `/register` came to be missing from both.
 *
 * Only the first segment is needed: robots.txt matches by prefix, so
 * `Allow: /register` already covers /register/faculty and /register/industry.
 * "/" is anchored with `$` so it allows the home page and not the whole site.
 */
const buildAllows = (): string[] => {
  const prefixes = new Set(
    PUBLIC_ENTRIES.filter((entry) => entry.path !== "/").map(
      (entry) => `/${entry.path.split("/")[1]}`,
    ),
  );
  return [`Allow: /$`, ...[...prefixes].map((prefix) => `Allow: ${prefix}`)];
};

const buildRobots = (): string =>
  [
    `# Generated by scripts/generate-seo.ts — edits here are overwritten on every build.`,
    ``,
    `User-agent: *`,
    ...buildAllows(),
    ...DISALLOWED.map((path) => `Disallow: ${path}`),
    ``,
    `Sitemap: ${BASE_URL}/sitemap.xml`,
    ``,
  ].join("\n");

writeFileSync(resolve("public/sitemap.xml"), buildSitemap(PUBLIC_ENTRIES));
writeFileSync(resolve("public/robots.txt"), buildRobots());
console.log(
  `[seo] ${BASE_URL} — sitemap.xml (${PUBLIC_ENTRIES.length} public entries), robots.txt (${DISALLOWED.length} disallowed paths)`,
);
