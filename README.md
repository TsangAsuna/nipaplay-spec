# NipaPlay-Reload workflow repository

Home for the feature-spec workflow, replacing the old `NipaPlay-Reload-features`
checkout (removed 2026-09-30: stale upstream clone at `c564b860`, 2026-09-21 —
older than the required baseline `b098594d`).

## What lives here

- `nipaplay-features-spec.workflow.ts` — the workflow script. Run it with
  ZCode's dynamic-workflow tools (`CreateWorkflow` with `path` pointing at this
  file).

## What the workflow does

The workflow is divided: **one trigger completes exactly one major item** —
one section of the spec — then the run ends.

1. **Gate** — `git merge-base --is-ancestor b098594d HEAD` against the
   NipaPlay-Reload repository. If HEAD does not contain `b098594d`, nothing is
   generated. This guarantees the spec content is never older than that commit.
2. **Pick the one major item** — the first section in the fixed 16-item list
   that is missing from `spec.md` or whose provenance marker
   (`*Verified against the tree at `<hash>`.*` under the heading) does not
   match the current HEAD short hash. If every section is fresh, the run
   reports the spec complete and stops without work.
3. **Draft** — one subagent regenerates only that section from the current
   tree, stamping its provenance marker.
4. **Verify** — an independent subagent cross-checks every claim in the
   section (including cited line ranges) against the repository; findings are
   fixed in place before anything is recorded.
5. **Checkpoint** — the verified section is committed to this repository, and
   the run ends.

Trigger repeatedly to walk through all 16 items; each run is short and ends at
a committed milestone. A section's marker makes staleness visible: after
NipaPlay-Reload advances, the next triggers refresh sections one at a time
against the new HEAD. To force a full rebuild, delete `spec.md` and commit the
deletion. The workflow never edits NipaPlay-Reload itself.

## Targets

- Source repository: `F:\Hermes Agent CN Desktop Portable\data\hermes-home\NipaPlay-Reload-features`
  (GitHub: [TsangAsuna/NipaPlay-Reload-features](https://github.com/TsangAsuna/NipaPlay-Reload-features),
  branch `nipaplay` — the working repo where feature development happens)
- Baseline commit: `b098594d` ("fix(subtitles): stacking a kernel-track subtitle must not steal playback")
- Output: `spec.md` in this folder
