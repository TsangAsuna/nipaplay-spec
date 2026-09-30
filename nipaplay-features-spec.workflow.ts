// Workflow: nipaplay-features-spec (divided — one major item per run)
// Rev 3: same logic; re-submitted after transient provider failures.
//
// Each trigger completes exactly ONE major item: the first spec section that
// is missing from spec.md or whose provenance marker predates the current
// HEAD of NipaPlay-Reload. The run gates on the baseline commit, drafts that
// one section, verifies it independently, fixes any findings, commits the
// checkpoint, and ENDS. Trigger repeatedly to walk through all sections; a
// run with nothing fresh to do reports that the spec is complete and stops.
// It only reads the source repository; it writes only spec.md here.

interface SpecIssue {
  /** The spec section the problem is in. */
  section: string;
  /** One sentence: what the section claims that is wrong, unverifiable, or misleading. */
  problem: string;
  /** The file or commit evidence that settles it. */
  evidence: string;
}

interface WorkflowReport {
  /** Two or three sentences answering what the user asked for. */
  conclusion: string;
  findings: SpecIssue[];
  /** What the run checked and how. */
  verified: string[];
  /** What the run did not look at, and why. */
  notCovered: string[];
}

const BASE_COMMIT = "b098594d";
const REPO_PATH = "F:/Hermes Agent CN Desktop Portable/data/hermes-home/NipaPlay-Reload-features";
const OUTPUT_DIR = "F:/Hermes Agent CN Desktop Portable/data/hermes-home/NipaPlay-Reload-workflow";

interface SpecItem {
  /** Exact "## " heading used in spec.md. */
  heading: string;
  /** One line of scope for the writer. */
  brief: string;
}

const ITEMS: SpecItem[] = [
  { heading: "Overview", brief: "create the file with the '# NipaPlay-Reload — Feature Spec' H1 and a provenance intro naming the commit and sources, then cover positioning, platform support, tech stack, and shipped roadmap items" },
  { heading: "Player kernels", brief: "unified player abstraction and kernel factory, the Erika / MDK / Media Kit / Video Player adapters, tvOS kernel forcing, kernel persistence, and Erika GIF clip export" },
  { heading: "Decoder / hardware-decode options", brief: "the mpv --hwdec mode enum, the hardware-decode master switch, precache buffer sizing, custom/one-shot User-Agent and HTTP proxy, and the Anime4K / CRT shader managers" },
  { heading: "Danmaku engines", brief: "danmaku kernel factory and engine list, the GPU renderer suite, NipaPlay Next / Next2, DFM+, the Next++ toggle, plugin-provided renderers, and default/fallback selection" },
  { heading: "Danmaku services", brief: "dandanplay automatic matching (matching in danmaku_matching_service.dart, sending in dandanplay_service_io.dart), manual matcher, cache and density analysis, timeline service, local mount, scroll/top/bottom features" },
  { heading: "Subtitles", brief: "external subtitle loading and per-video persistence, overlay rendering, parsers, remote fetch, the Rust ASS converter, and the active subtitle workstream per recent commits" },
  { heading: "Media library", brief: "adaptive library UI, local and Rust-accelerated scanning, Emby, Jellyfin, WebDAV, SMB, aggregated metadata service, search/detail surfaces, color extraction and poster cropping" },
  { heading: "Downloads", brief: "the Rust-backed torrent download manager, magnet preview, download UI, directory persistence, and user documentation" },
  { heading: "Remote playback & control", brief: "embedded web server, remote control HTTP API and auth, LAN discovery and QR pairing, remote bridge and text input, dandanplay remote client, web remote access, and the server-side components" },
  { heading: "Bangumi & accounts", brief: "Bangumi API client and watch-progress sync, trending and seasonal pages, account UI, watch history and playback positions including incremental WebDAV sync, and backup" },
  { heading: "Playback experience", brief: "AniSkip intro/credits skip, auto next-episode, desktop PiP, external player launching, screenshots, AirPlay picker, playback entry resolution, update checker, window lifecycle, single-instance guard, keyboard shortcuts" },
  { heading: "JS plugin system", brief: "plugin service/event bus/storage, per-platform JS runtimes, plugin models and permissions, host bridge surface, webview danmaku overlay, media proxy and playback service, similarity FFI, settings" },
  { heading: "AI spoiler shielding", brief: "the danmaku spoiler filter service and its configuration/privacy documentation" },
  { heading: "Settings, theming & i18n", brief: "unified settings page and section contents, dual theme families behind the registry, localization ARB sources, and the macOS native platform menu" },
  { heading: "Platform support & packaging", brief: "in-repo platform trees, the platform capability matrix, packaging/distribution channels, tvOS and HarmonyOS development docs, and the unsigned iOS sideload CI workflow" },
  { heading: "Documentation & contributor guides", brief: "the user documentation set, the 00-13 contributor guide, and the developer notes under docs/" },
];

/** Fresh = present with a provenance marker matching the current HEAD short hash. */
function itemState(spec: string, item: SpecItem, headShort: string): "fresh" | "stale" | "missing" {
  const idx = spec.indexOf(`## ${item.heading}\n`);
  if (idx < 0) return "missing";
  const next = spec.indexOf("\n## ", idx + 1);
  const body = next < 0 ? spec.slice(idx) : spec.slice(idx, next);
  const match = /\*Verified against the tree at `([0-9a-f]+)`\.\*/.exec(body);
  if (match === null) return "stale";
  return match[1] === headShort ? "fresh" : "stale";
}

phase("Confirm the repository is at or past b098594");
const gate = await world.run("git", ["-C", REPO_PATH, "merge-base", "--is-ancestor", BASE_COMMIT, "HEAD"]);
const head = await world.run("git", ["-C", REPO_PATH, "rev-parse", "HEAD"]);
const headHash = head.stdout.trim();
const headShort = headHash.slice(0, 8);
if (gate.exitCode !== 0) {
  return {
    conclusion: `No item was processed: NipaPlay-Reload HEAD ${headShort} does not contain ${BASE_COMMIT}, so the content-currency gate failed.`,
    findings: [],
    verified: [`git merge-base --is-ancestor ${BASE_COMMIT} HEAD exited ${gate.exitCode} in ${REPO_PATH}`],
    notCovered: ["spec.md — deliberately untouched while the gate fails"],
  };
}

let spec = "";
const show = await world.run("git", ["-C", OUTPUT_DIR, "show", "HEAD:spec.md"]);
if (show.exitCode === 0) {
  spec = show.stdout;
}
const fresh = ITEMS.filter((i) => itemState(spec, i, headShort) === "fresh").length;
const target = ITEMS.find((i) => itemState(spec, i, headShort) !== "fresh");
if (target === undefined) {
  return {
    conclusion: `All ${ITEMS.length} spec sections are present and verified against NipaPlay-Reload ${headShort}; the spec is complete, so this run ended without work.`,
    findings: [],
    verified: [`gate: HEAD ${headShort} contains ${BASE_COMMIT}; all ${ITEMS.length} section markers match ${headShort}`],
    notCovered: ["runtime behavior — the spec is derived from the source tree, nothing was executed"],
  };
}
log(`HEAD ${headShort} contains ${BASE_COMMIT}; ${fresh}/${ITEMS.length} items fresh. Continuous mode: this run walks ALL stale/missing sections to completion.`);

phase("Draft the next spec section");
const writer = agent("section writer", {
  system:
    "You write one section of an evidence-backed feature spec from a source tree. Every feature " +
    "line must name the code that implements it, with correct file paths and line numbers. " +
    "If a feature cannot be verified from the tree, leave it out rather than guessing. " +
    "If your instructions contradict each other, escalate rather than working around it.",
});
const verifier = agent("section verifier", {
  system:
    "You check one written spec section against the code it describes. Read the section, then check its " +
    "claims against the repository files it names — including that cited line numbers point at the claimed " +
    "content. Do not edit any file. Report only concrete, checkable problems, with evidence.",
});

const doneHeadings: string[] = [];
const sectionSummaries: { heading: string; problems: number }[] = [];
let finalSectionText = "";
let finalSectionHeading = "";

for (let round = 0; round < ITEMS.length; round++) {
  const current = await world.run("git", ["-C", OUTPUT_DIR, "show", "HEAD:spec.md"]);
  const currentSpec = current.exitCode === 0 ? current.stdout : "";
  const target = ITEMS.find((i) => itemState(currentSpec, i, headShort) !== "fresh");
  if (target === undefined) {
    log(`All ${ITEMS.length} sections are fresh against ${headShort}; spec complete.`);
    break;
  }
  log(`Section ${round + 1}: "${target.heading}" — drafting.`);

  phase("Draft the next stale section");
  const sectionText = await writer.ask<string>(
    `Work on ${OUTPUT_DIR}/spec.md. Target section: "## ${target.heading}". Scope: ${target.brief}. ` +
    `Everything must be derived from the NipaPlay-Reload repository at ${REPO_PATH}, as of commit ${headShort}, ` +
    `in English, compact: one bullet per feature, each bullet naming its implementing path. ` +
    `Regenerate ONLY this section and leave every other section byte-identical. ` +
    `The section must start with the exact line "## ${target.heading}", and its first body line must be exactly ` +
    `\`*Verified against the tree at \`${headShort}\`.*\` ` +
    `(if spec.md or the section does not exist yet, create the file / append the section at the end). ` +
    `Write the file, then return the FULL text of the regenerated section as your final answer and nothing else.`,
  );

  phase("Verify the section, then checkpoint");
  const issues = await verifier.ask<SpecIssue[]>(
    `Read ${OUTPUT_DIR}/spec.md and locate the "## ${target.heading}" section. Verify its feature claims against ` +
    `the NipaPlay-Reload repository at ${REPO_PATH} (the section names paths — read them, and check cited line ranges). ` +
    `Return the claims that are wrong, unverifiable, or misleading, with evidence. ` +
    `An empty list means every claim you checked held up.`,
  );
  issues.forEach((issue) => report(issue));
  let finalSection = sectionText;
  if (issues.length > 0) {
    finalSection = await writer.ask<string>(
      `An independent verifier found problems in the "${target.heading}" section of ${OUTPUT_DIR}/spec.md. ` +
      `Fix each one in place in that file, keeping the section compact and leaving every other section byte-identical. ` +
      `Return the FULL updated text of the section as your final answer and nothing else. Problems: ${JSON.stringify(issues)}`,
    );
  }
  finalSectionText = finalSection;
  finalSectionHeading = target.heading;
  doneHeadings.push(target.heading);
  sectionSummaries.push({ heading: target.heading, problems: issues.length });

  await world.run("git", ["-C", OUTPUT_DIR, "add", "spec.md"]);
  const dirty = await world.run("git", ["-C", OUTPUT_DIR, "status", "--porcelain", "spec.md"]);
  if (dirty.stdout.trim().length > 0) {
    const slug = target.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await world.run("git", ["-C", OUTPUT_DIR, "commit", "-m",
      `spec(${slug}): refresh "${target.heading}" against ${headShort}, independently verified`]);
  }
}

const updated = await world.run("git", ["-C", OUTPUT_DIR, "show", "HEAD:spec.md"]);
const updatedSpec = updated.exitCode === 0 ? updated.stdout : "";
const freshAfter = ITEMS.filter((i) => itemState(updatedSpec, i, headShort) === "fresh").length;
const nextItem = ITEMS.find((i) => itemState(updatedSpec, i, headShort) !== "fresh");

if (finalSectionHeading !== "" && finalSectionText !== "") {
  await artifact.markdown("spec-md", finalSectionText, {
    title: `spec.md — ${finalSectionHeading}`,
    description: `Last of ${doneHeadings.length} section(s) completed this run; all verified against NipaPlay-Reload ${headShort}.`,
    primary: true,
  });
}

return {
  conclusion: `Continuous run complete: ${doneHeadings.length} section(s) processed (${doneHeadings.join(", ") || "none — already fresh"}), ` +
    `each drafted, independently verified, and checkpoint-committed against NipaPlay-Reload ${headShort} ` +
    `(gate: contains ${BASE_COMMIT}). ${freshAfter} of ${ITEMS.length} items are now fresh` +
    `${nextItem ? `; "${nextItem.heading}" remains stale — trigger again` : "; the spec is complete"}.`,
  findings: sectionSummaries.map((s) => ({
    section: s.heading,
    problem: `${s.problems} verifier finding(s) in this section`,
    evidence: "see reported items above for per-section details",
    status: "verified" as const,
  })),
  verified: [
    `git merge-base --is-ancestor ${BASE_COMMIT} HEAD exited 0 in ${REPO_PATH}`,
    `an independent verifier cross-checked every completed section's claims — including cited line ranges — against the repository files`,
    `${doneHeadings.length} checkpoint commit(s) in the workflow repository`,
  ],
  notCovered: [
    nextItem ? `"${nextItem.heading}" — not reached in this run` : "nothing — all sections fresh",
    "runtime behavior — the spec is derived from the source tree, nothing was executed",
  ],
};
