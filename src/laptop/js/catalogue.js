import { saved } from "./projects.js";
import { session } from "./session.js";

const user = "charmin990530-sudo";
const featured = new Map(saved.map((item) => [item.slug, item]));
let projects = saved,
  pendingProjects = null;
function applyPending() {
  if (pendingProjects) {
    projects = pendingProjects;
    pendingProjects = null;
  }
}
function safeSite(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
async function refreshProjects() {
  const records = [];
  try {
    for (let page = 1; ; page++) {
      const res = await fetch(
        "https://api.github.com/users/" +
          user +
          "/repos?type=owner&per_page=100&page=" +
          page,
        { signal: AbortSignal.timeout(9000) },
      );
      if (!res.ok) return;
      const batch = await res.json();
      if (!Array.isArray(batch)) return;
      for (const repo of batch) {
        if (repo.owner?.login?.toLowerCase() !== user || repo.private) continue;
        const curated = featured.get(repo.name);
        records.push({
          ...curated,
          slug: repo.name,
          title: curated?.title || repo.name.replace(/[-_]+/g, " "),
          category: curated?.category || "Repositorio público",
          description:
            curated?.description ||
            repo.description ||
            "Proyecto público de " + user + " en GitHub.",
          language: repo.language || "GitHub",
          year: repo.created_at.slice(0, 4),
          url:
            "https://github.com/" + user + "/" + encodeURIComponent(repo.name),
          demo:
            repo.name === "portafolio-maquillaje-paula" &&
            safeSite(repo.homepage) ===
              "https://portafolio-maquillaje-paula.vercel.app/"
              ? ""
              : safeSite(repo.homepage),
        });
      }
      if (batch.length < 100) break;
    }
    const rank = (slug) =>
      featured.has(slug) ? saved.indexOf(featured.get(slug)) : Infinity;
    records.sort(
      (a, b) =>
        rank(a.slug) - rank(b.slug) || a.title.localeCompare(b.title, "es"),
    );
    if (records.length) {
      pendingProjects = records;
      if (!session.busy && session.mode === "hero") applyPending();
    }
  } catch {
    /* The bundled catalogue remains available offline and during API rate limits. */
  }
}

export { projects, applyPending, refreshProjects };
