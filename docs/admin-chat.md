# Internal Chat AI

The admin workspace exposes `/admin/chat` to owners and admins. Separate shop
workspaces expose `/shops/{slug}/chat` through the shop session and database
scope. Shop owners configure their own OpenAI connection on the connections
page; no primary-shop credential fallback is used. Platform view-only sessions
cannot issue chat requests or save credentials.

The server, rather than the model, chooses the database and validates the role.
The model can call only a fixed allowlist of read functions. It cannot submit
SQL, select another shop, perform writes, send messages, or create orders.

The owner also has a schema-aware business-data explorer: it discovers sources,
reads explicitly selected scalar fields, filters records, and counts/sums them.
These operations still use the current shop database; they cannot submit SQL.
Session material, credentials, platform databases, binary columns and opaque JSON
are excluded. Admin accounts retain the narrower report access.

Supported data:

- Recognized sales from the main sales report. Separate shops use booked sales
  from their existing sales page, with the different accounting basis stated.
- Accounting income, costs, expenses, profit and incomplete-data notices.
- Best-selling product rankings from recognized sales, by distinct order count or grams.
- Customer LINE binding, known profile name, last incoming-event time and message readiness. These do not imply that conversation text has been stored.
- Stock balances for accounts that can open the corresponding stock page.
  Sellable quantity uses the same pending-hold and safety-reserve calculation as the stock page. Physical-only cached fallback is labelled; unavailable live sellable data is an error.
- Customer code/name lists, optionally filtered by days since a qualifying
  order or by never having ordered. Inactive and never-ordered are distinct.
  Phones, addresses, credentials, payment slips and raw order text are omitted.
- Order counts by status for the owner, with the date basis stated.

The server supplies report links, timestamps and list rows; the model does not
invent those links. Customer lists show at most 30 rows and report the matching
total so users can refine the query. All monetary model inputs retain explicit
satang units. The browser renders text without interpreting model HTML.

Chat history exists only in page memory and is bounded when sent to the API.
Requests use `store: false`; normal provider data handling still applies.
Audit entries record request count and read-only mode, not prompts or answers.
There is a per-account eight-request/minute limit, a bounded function loop and
a request deadline. Source failures must not be reported as zero values.

Validation includes role restrictions, malformed dates, unexpected function
names, server-provided result tables, source failure and incomplete model
responses. A live model check uses synthetic sales values, not customer data.

This feature does not enable an AI customer-service bot or automatic LINE
replies. It does not change the LINE card-building workflow.
