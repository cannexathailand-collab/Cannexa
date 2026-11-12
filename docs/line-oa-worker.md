# LINE OA worker

The stock page creates durable `LineOaJob` records. The Vercel daemon in
`workers/line-oa` claims one operation at a time, performs research first,
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
before persisting the session.

When LINE expires the login, work pauses with `AWAITING_LOGIN`. Reconnecting
the same account requeues those jobs. Existing remote item identifiers and
exact item titles are used to reconcile a retry; ambiguous duplicates or
changed items stop for review instead of creating another item. A lease
and serializable claim protect against concurrent processing and restart
recovery.

## Current acceptance scope

- One primary shop, product cards with three uploaded images and at most
  five distinct products per set.
- Gray product-code tags; `Show details` sends the exact product code.
- `Order Now` currently opens a test page, not a live purchase page.
- Research includes a source and is limited to 500 characters. Ambiguous
  research pauses for review before saving.
- Existing reply video is retained when updating its text. Downloading
  and inserting new videos from Google Drive is not yet wired to this
  daemon.
- JPEG and PNG images are accepted by the current OA uploader; missing
  images and other formats require correction before completing a set.
- The worker never broadcasts a message. Saved keyword replies are
  activated as authorized for this workflow.

Tests cover payload limits, product-code consistency, encrypted state,
expired input sessions, HTTP authorization, queue replay, and overlapping
product protection. Live LINE OA save behavior must be validated after
the owner signs in to the server browser.
