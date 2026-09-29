// Workflow: nipaplay-features-spec
//
// Verifies the NipaPlay-Reload repository is at or past commit b098594d, then
// generates spec.md in this folder: an evidence-backed feature listing derived
// from the current tree, independently checked against the code before it is
// published. Run with ZCode's CreateWorkflow tool using this file as `path`.
// It only reads the source repository; it writes only spec.md here.

interface SpecIssue {
  /** The spec.md section heading the problem is in. */
  section: string;
  /** One sentence: what the spec claims that is wrong, unverifiable, or misleading. */
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
const REPO_PATH = "F:/Hermes Agent CN Desktop Portable/data/hermes-home/NipaPlay-Reload";
const OUTPUT_DIR = "F:/Hermes Agent CN Desktop Portable/data/hermes-home/NipaPlay-Reload-workflow";

phase("Confirm the repository is at or past b098594");
const gate = await world.run("git", ["-C", REPO_PATH, "merge-base", "--is-ancestor", BASE_COMMIT, "HEAD"]);
const head = await world.run("git", ["-C", REPO_PATH, "rev-parse", "HEAD"]);
const headHash = head.stdout.trim();
if (gate.exitCode !== 0) {
  return {
    conclusion: `spec.md was not generated: NipaPlay-Reload HEAD ${headHash.slice(0, 8)} does not contain ${BASE_COMMIT}, so the content-currency gate failed.`,
    findings: [],
    verified: [`git merge-base --is-ancestor ${BASE_COMMIT} HEAD exited ${gate.exitCode} in ${REPO_PATH}`],
    notCovered: ["spec.md — deliberately not written while the gate fails"],
  };
}
log(`NipaPlay-Reload HEAD ${headHash.slice(0, 8)} contains ${BASE_COMMIT}; drafting the feature spec.`);

phase("Draft spec.md from the current tree");
const writer = agent("spec writer", {
  system:
    "You inventory an application's features from its source tree and write a precise, " +
    "evidence-backed spec. Every feature line must name the code that implements it. " +
    "If a feature cannot be verified from the tree, leave it out rather than guessing. " +
    "If your instructions contradict each other, escalate rather than working around it.",
});
const specText = await writer.ask<string>(
  `Write spec.md into ${OUTPUT_DIR} (the file ${OUTPUT_DIR}/spec.md): a feature listing of ` +
  `the NipaPlay-Reload repository at ${REPO_PATH}, as of commit ${headHash.slice(0, 8)}, written in English ` +
  `to match the repo's docs. Derive everything from that repository's current tree (README, CONTRIBUTING_GUIDE, docs/, ` +
  `lib/ — player kernels, decoder/hwdec options, danmaku engines, subtitles, media library, downloads, remote playback, ` +
  `platform support) plus its recent commit subjects; do not speculate. Keep it compact: one section per area, one bullet ` +
  `per feature, each bullet naming its implementing path. Write the file, then return the FULL text of spec.md as your ` +
  `final answer and nothing else.`,
);

phase("Verify the spec against the code, then publish");
const issues = await agent("spec verifier", {
  system:
    "You check a written spec against the code it describes. Read the spec, then check each section's claims " +
    "against the repository it describes. Do not edit any file. Report only concrete, checkable problems, with evidence.",
}).ask<SpecIssue[]>(
  `Read ${OUTPUT_DIR}/spec.md and verify its feature claims against the NipaPlay-Reload repository at ${REPO_PATH} ` +
  `(the spec names paths — read them). Return the claims that are wrong, unverifiable, or misleading, with evidence. ` +
  `An empty list means every claim you checked held up.`,
);
issues.forEach((issue) => report(issue));
let finalSpec = specText;
if (issues.length > 0) {
  finalSpec = await writer.ask<string>(
    `An independent verifier found problems in ${OUTPUT_DIR}/spec.md. Fix each one in place in that file, ` +
    `keeping the spec compact. Return the FULL updated text of spec.md as your final answer and nothing else. ` +
    `Problems: ${JSON.stringify(issues)}`,
  );
}
await artifact.markdown("spec-md", finalSpec, {
  title: "spec.md — feature listing",
  description: `Feature inventory of NipaPlay-Reload generated at ${headHash.slice(0, 8)} (gate: ${BASE_COMMIT}); file lives at ${OUTPUT_DIR}/spec.md.`,
  primary: true,
});

return {
  conclusion: `spec.md was written to ${OUTPUT_DIR}/spec.md from NipaPlay-Reload HEAD ${headHash.slice(0, 8)} ` +
    `(verified to contain ${BASE_COMMIT}) and independently checked against the code: ` +
    `${issues.length} problem(s) found${issues.length > 0 ? " and fixed in place" : ""}.`,
  findings: issues,
  verified: [
    `git merge-base --is-ancestor ${BASE_COMMIT} HEAD exited 0 in ${REPO_PATH}`,
    "an independent verifier cross-checked spec.md's claims against the repository files it names",
  ],
  notCovered: [
    "runtime behavior — the spec is derived from the source tree, nothing was executed",
  ],
};
