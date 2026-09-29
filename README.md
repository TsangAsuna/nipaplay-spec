# NipaPlay-Reload workflow repository

Home for the feature-spec workflow, replacing the old `NipaPlay-Reload-features`
checkout (removed 2026-09-30: stale upstream clone at `c564b860`, 2026-09-21 —
older than the required baseline `b098594d`).

## What lives here

- `nipaplay-features-spec.workflow.ts` — the workflow script. Run it with
  ZCode's dynamic-workflow tools (`CreateWorkflow` with `path` pointing at this
  file).

## What the workflow does

1. **Gate** — `git merge-base --is-ancestor b098594d HEAD` against the
   NipaPlay-Reload repository. If HEAD does not contain `b098594d`, nothing is
   generated. This guarantees the spec content is never older than that commit.
2. **Draft** — one subagent writes `spec.md` into this folder: a compact,
   evidence-backed feature listing of NipaPlay-Reload (player kernels, decoder
   options, danmaku engines, subtitles, media library, downloads, remote
   playback, platforms), each bullet naming its implementing path.
3. **Verify** — an independent subagent cross-checks every claim in `spec.md`
   against the repository; problems are fixed in place before the spec is
   published as the run's artifact.

The workflow never edits NipaPlay-Reload itself; it reads the tree and writes
only `spec.md` here.

## Targets

- Source repository: `F:\Hermes Agent CN Desktop Portable\data\hermes-home\NipaPlay-Reload`
- Baseline commit: `b098594d` ("fix(subtitles): stacking a kernel-track subtitle must not steal playback")
- Output: `spec.md` in this folder
