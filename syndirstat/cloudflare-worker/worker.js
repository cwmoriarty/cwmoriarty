/**
 * Cloudflare Worker for Synology DSM Package Center repository on cpan.zip
 *
 * Why this is needed:
 * Synology DSM Package Center queries repository URLs using HTTP POST requests
 * with form data (arch, build, language, major).
 * GitHub Pages is a static file host that rejects all POST requests with "405 Method Not Allowed",
 * causing Synology Package Center to show "Invalid location".
 *
 * This Worker:
 * 1. Intercepts POST and GET requests to "/" and "/packages.json" from DSM.
 * 2. Dynamically returns the SynDirStat package catalog in the exact JSON format DSM expects.
 * 3. Dynamically selects the right SPK (x86_64, arm64, or universal) based on the NAS arch.
 * 4. Passes all other requests (HTML pages, direct SPK downloads, icons) through to GitHub Pages.
 */

const PACKAGES = [
  {
    package: "syn-dirstat",
    version: "1.0.0-0001",
    dname: "SynDirStat",
    name: "SynDirStat",
    desc: "Interactive WizTree/WinDirStat style storage visualization and treemap analyzer for Synology DSM 7.",
    maintainer: "cwmoriarty",
    maintainer_url: "https://github.com/cwmoriarty",
    distributor: "cwmoriarty",
    distributor_url: "https://cpan.zip",
    changelog: "1.0.0-0001: Initial release with cushion treemaps, historical scan comparisons, and DSM 7 native integration.",
    qinst: true,
    qupgrade: true,
    qstart: true,
    startable: "yes",
    type: 0,
    category: "Utilities",
    beta: false,
    deppkgs: null,
    conflictpkgs: null,
    depsers: null,
    size: 9123840,
    md5: "de14af65ce0f3cad4c7888d199178527",
    thumbnail: [
      "https://cpan.zip/packages/syndirstat/icon_72.png",
      "https://cpan.zip/packages/syndirstat/icon_256.png"
    ],
    thumbnail_retina: [
      "https://cpan.zip/packages/syndirstat/icon_256.png"
    ],
    snapshot: []
  }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Check if DSM Package Center is querying the catalog
    const isCatalogPath =
      url.pathname === "/" ||
      url.pathname === "/packages.json" ||
      url.pathname === "/repository/packages.json" ||
      url.pathname === "/repository/package-index";

    // DSM sends POST with urlencoded form data, or a client asks for JSON
    if (
      isCatalogPath &&
      (request.method === "POST" ||
        request.headers.get("accept")?.includes("application/json") ||
        url.pathname.endsWith(".json"))
    ) {
      let arch = "x86_64";
      let build = 40000;

      if (request.method === "POST") {
        try {
          const formData = await request.formData();
          arch = formData.get("arch") || url.searchParams.get("arch") || arch;
          build = parseInt(formData.get("build") || url.searchParams.get("build") || "40000", 10);
        } catch (e) {
          arch = url.searchParams.get("arch") || arch;
        }
      } else {
        arch = url.searchParams.get("arch") || arch;
        build = parseInt(url.searchParams.get("build") || "40000", 10);
      }

      // Pick matching SPK link, size, and MD5 based on architecture
      let spkUrl = "https://cpan.zip/packages/syndirstat/syn-dirstat-all-1.0.0.spk";
      let spkSize = 9123840;
      let spkMd5 = "de14af65ce0f3cad4c7888d199178527";

      const archLower = String(arch).toLowerCase();
      if (archLower.includes("arm64") || archLower.includes("aarch64") || archLower.includes("rtd1296")) {
        spkUrl = "https://cpan.zip/packages/syndirstat/syn-dirstat-arm64-1.0.0.spk";
        spkSize = 4403200;
        spkMd5 = "27ac81b5dc66cfddf5f9b29d4b0bfe9b";
      } else if (
        archLower.includes("x86") ||
        archLower.includes("x64") ||
        archLower.includes("amd64") ||
        archLower.includes("broadwell") ||
        archLower.includes("geminilake") ||
        archLower.includes("apollolake") ||
        archLower.includes("denverton")
      ) {
        spkUrl = "https://cpan.zip/packages/syndirstat/syn-dirstat-x86_64-1.0.0.spk";
        spkSize = 4812800;
        spkMd5 = "86376fb770207aeb0bfc0d593621abe8";
      }

      const packages = PACKAGES.map((pkg) => ({
        ...pkg,
        link: spkUrl,
        size: spkSize,
        md5: spkMd5
      }));

      return new Response(JSON.stringify({ packages }), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Cache-Control": "public, max-age=120"
        }
      });
    }

    // Handle OPTIONS CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }

    // Pass through all other requests (HTML, direct SPK downloads, images) to GitHub Pages
    return fetch(request);
  }
};
