# LINE OA reliability improvements

## Open: diagnose and recover card saves without rewriting saved cards

Recorded: 13 November 2026 (Asia/Bangkok)

### Observed incident

- The AE01–AE05 run completed all five replies and videos before entering the card phase.
- The worker reported a generic failure after the card-save progress event and retried the card phase.
- A read-only inspection found the new card set already saved in LINE OA with five cards, three images configured per card, and descriptions within the character limit.
- The artifact reference still pointed to the previous card set during the failed attempts.
- The final retry completed the normal read-back verification and the job reached `COMPLETE` / `DONE` with no remaining error.
- The exact failing operation was not captured. A timeout, save-confirmation issue, or page-loading race remains a hypothesis, not an established root cause. The successful retry does not establish that the underlying issue was fixed.

### Required improvements

1. Record distinct stages for the initial save click, confirmation dialog, confirmation click, navigation, list lookup, opening the saved item, and read-back verification. Preserve a structured failure category and stage instead of reducing every unexpected failure to a generic message.
2. Keep diagnostics free of authentication state, cookies, tokens, customer data, and full user-entered URLs or message bodies. Capture only the minimum safe details needed to identify the failed operation.
3. Wait for observable save and load completion. Distinguish a successful save followed by failed verification from a save rejected by OA; do not infer either outcome solely from a click or an elapsed delay.
4. Track a newly discovered remote item as pending verification separately from a verified artifact. Reconcile against the actual saved item when an old item has been deleted or replaced, without prematurely marking the job complete.
5. Before a retry uploads or rewrites cards, inspect the saved set. Resume verification when its data already matches; rewrite only when a difference is established. Ambiguous matches must stop for review rather than creating duplicates.
6. Show a useful user-facing stage and reason while retaining the existing verified reply/video results. Report completion only after every required read-back check passes.

### Acceptance checks

- Reproduce a save that succeeds but whose navigation or read-back is delayed; the next attempt verifies the same remote set without duplicate creation or unnecessary uploads.
- Cover a deleted/stale artifact reference, delayed list loading, missing confirmation dialog, rejected save, and mismatched saved data as separate cases with distinguishable diagnostics.
- Verify all five cards and their expected fields after reopening the set; incomplete or mismatched data must never produce `COMPLETE`.
- Confirm that sensitive values are absent from logs and user-facing error messages.
- Perform an end-to-end run with synthetic products, including an induced failure between save and verification. Record evidence before closing this item.

Status: **open**. Recorded for follow-up; no root-cause fix is claimed by this document.

## Implemented safeguards pending live acceptance

- Video ordering checks the actual video position first, so an already-first video does not require a missing up-arrow control. Each move waits for a lower DOM position before the next move. Missing controls and unchanged positions have distinct error categories.
- Card saves record a separate pending artifact after the saved remote ID is known. Retries verify matching pending or completed sets before rewriting; only successful read-back promotes the completed artifact.
- Reuse requires matching expected fields and a fingerprint of the actual source-image bytes, not only their URLs.
- Unit tests cover already-first and delayed video moves, absent controls, failed moves, duplicate video blocks, pending-card recovery without uploads, changed image bytes, and failed read-back without promotion.
- Live acceptance is still required before closing this reliability item.

## Five-store production run: completed 13 November 2026

- Green Hub (Wholesale), both Green house destinations, Happy Happy Farm,
  and บ้านเขียว all reached `COMPLETE` / `DONE` with no final error.
- Each destination completed ten keyword replies with synchronized videos
  and two verified five-card sets: fifty replies/videos and ten card sets overall.
- The final destination completed at 14:10 Bangkok time. Previously verified
  results were retained while unfinished operations were retried.
- Reply activation now reopens the exact saved editor when LINE returns to
  the list after activation. The remaining replies passed with this change.
- The 2 GiB worker exited with code 137 during overlapping image-crop work.
  A 4 GiB replacement continued past that point and the run completed. This
  observation supports keeping the added headroom; it does not prove every
  browser failure was caused by memory exhaustion.
- Card list lookup still produced control timeouts after successful save
  responses, and one card attempt reported a closed browser. Recovery completed
  those sets, but the underlying lookup race has not been isolated. Keep this
  issue open, add finer-grained lookup diagnostics, and verify recovery with
  an induced failure before claiming the entire reliability follow-up closed.
