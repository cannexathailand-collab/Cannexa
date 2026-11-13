# LINE OA worker

Open reliability follow-ups and incident acceptance criteria are tracked in
[LINE OA improvements](./line-oa-improvements.md).

The stock page creates durable `LineOaJob` records. The Vercel daemon in
`workers/line-oa` claims up to five operations for distinct OA destinations at a time, performs research first,
saves keyword replies, and then saves product-card sets. A job reaches
`COMPLETE` only after the manager pages have been re-opened and checked.

## Deployment

The `line-oa-worker` daemon is declared in `vercel.json`. It uses the same
production `DATABASE_URL` and `SESSION_SECRET` as the web application. It
currently handles the primary shop only. The database migration creates
the schema in existing tenant databases as preparation; tenant processing
has not been enabled.

The Docker image installs Chromium and Thai fonts. Browser files are
ephemeral. Authentication state is encrypted with a separate AES-GCM
domain and persisted in `LineOaBrowser`, never exported to client code.
Browser input commands and temporary screenshots are encrypted too. The
owner-only web endpoints require the existing session and same-origin
checks for mutations. Inputs from expired remote-login sessions are
rejected. Login windows expire after ten minutes.

## Connection and recovery

The owner opens `/admin/line-browser` and requests a login session. The
daemon opens LINE OA in a dedicated server browser. The owner completes
the login (including any verification challenge) through that view and
selects **ตรวจการเชื่อมต่อ**. The worker verifies the configured OA account
before persisting the session. It then reads every page of the account list
and records accessible OA identifiers and display names. The owner can also
refresh that list without signing in again.

The stock page selects a discovered OA as the job destination. The default
is the shop's configured OA; other destinations are owner-only. Jobs and
artifacts remain keyed by OA, so identical product codes on different OAs
do not conflict. A repeated request key cannot change its destination.
The worker uses separate tabs with independent browser contexts cloned from the saved login and verifies each job's OA
before editing. A transactional per-OA exclusion prevents two jobs for the same destination from running together. Authentication state is persisted once after all tabs finish. Removed or unavailable destinations cannot receive new jobs.

Each running job stores its current step and the last 60 progress events.
The stock page polls these events and shows the current SKU, video/image
upload steps, completed reply count, card-set count, and review pauses.
These events contain status messages only, never login state or tokens.
If an OA item was deleted outside the application, the worker reconciles
the exact title within the selected OA before recreating it.
Transient failures retry the same unfinished step after 10, 30, then 90
seconds; verified earlier results are retained. A successful step resets
the retry budget. Login, identity, duplicate-keyword, duplicate-file, and
permission failures pause for intervention. Exhausted retries show the
last unfinished step instead of starting another job.

When LINE expires the login, work pauses with `AWAITING_LOGIN`. Reconnecting
the same account requeues those jobs. Existing remote item identifiers and
exact item titles are used to reconcile a retry; ambiguous duplicates or
changed items stop for review instead of creating another item. Per-job leases and serializable claims protect against duplicate processing and restart
recovery. The browser lease remains active until the last running operation releases it.
The concurrency cap is five on the 2 GiB worker.

## Current acceptance scope

- One primary application shop, multiple OA destinations from its shared
  LINE login, product cards with three uploaded images and at most
  five distinct products per set.
- Gray product-code tags; `Show details` sends the exact product code.
- `Order Now` currently opens a test page, not a live purchase page.
- Research includes a source and is limited to 500 characters. Ambiguous
  research pauses for review before saving.
- `/admin/drive` connects a Drive account using read-only OAuth and the
  existing registered Google callback. The connection and tokens are
  separate from Gmail. An optional folder restricts lookup to its children.
- Drive video names match the exact SKU (case insensitive), such as
  `AE05.mp4`. Missing files leave the reply text and any existing video in
  place. Duplicate names, denied downloads, unsupported formats, and files
  above 200 MiB stop the job with a reviewable error.
- Videos stream to an isolated temporary directory and are removed after
  upload, including failed uploads. File size and available MD5 checksums
  are verified before uploading. The worker places the video first and
  checks it again after saving. A source fingerprint avoids repeat uploads.
- JPEG and PNG images are accepted by the current OA uploader; missing
  images and other formats require correction before completing a set.
- The worker never broadcasts a message. Saved keyword replies are
  activated as authorized for this workflow.

Tests cover payload limits, product-code consistency, encrypted state,
expired input sessions, HTTP authorization, queue replay, and overlapping
product protection. Live LINE OA save behavior must be validated after
the owner signs in to the server browser.
