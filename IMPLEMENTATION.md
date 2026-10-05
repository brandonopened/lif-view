# Implementation guide: a district and a college running lif-view

This guide is for the two organizations in the picture, a **school district** (the sender of student records)
and a **college** (the receiver that shows them in its own LIF profile), and for whoever sets the stack up for
them. It says what each side runs, what to ask each side for, who hands which key to whom, and the order of
steps that ends with a student's grades on the lif-view page.

Nothing here is specific to the demo names (Northgate, Riverbend, StateU). Where the demo stack is referenced
it is as a worked example of the same steps.

## 1. Who runs what

| Party | Runs | Why |
|---|---|---|
| District | A LIF **MDR** (Metadata Registry) and its **Translator** | Holds the district's own LIF profile and publishes it so the college can map to it. In the demo it also hosts the student roster the page reads. |
| College | A LIF MDR and its Translator | Holds the college's LIF profile and the **mapping** (transformation group) from the district's profile to its own. The translation of each student record happens here. |
| Either, or a third party | **lif-view** (`index.html`, `config.js`, `serve.py`) | A static page. No database, no learner data of its own. It calls the MDR APIs from the browser. |

Two deployment shapes work:

- **One host (demo).** Everything from `deployments/advisor-demo-docker` in LIF Core with the exchange override
  (`docker-compose.yml` + `docker-compose.exchange.yml`). The district MDR is on port 8012, the college MDR on
  8022, and lif-view on 8080. This is what the repository is configured for today.
- **Two hosts (real pilot).** Each party runs its own stack. The two MDRs never call each other; the exchange is
  a pull done by an operator with a read-only key (section 4). lif-view must then be reachable by the users and
  its origin must be allowed by each MDR it calls (section 6).

A second college is just another row in `config.js`; the page renders one card per entry.

## 2. What to ask the district for

1. **Their LIF profile.** The data model the district's records are shaped in, published in its MDR
   (`State = Published`). If they do not have one yet, this is a schema design task that comes first; LIF Core's
   OpenAPI upload endpoint and the MDR mapping editor are the tools.
2. **Sample student records shaped for that profile.** Synthetic or de-identified only (section 7). One JSON
   file in the shape `{"students": {"<id>": <record>, ...}}`, plus the model name and version it belongs to, so
   it can be listed in the samples manifest (`demo-samples.json`) the page reads the roster from.
3. **A publisher name.** Set on their MDR as `MDR__EXCHANGE__PUBLISHER_NAME`; it is stamped on every bundle they
   publish.
4. **A read-only exchange key.** They generate a value, set it on their MDR as
   `MDR__AUTH__SERVICE_API_KEY__EXCHANGE_PARTNER`, and hand it to the college's operator out of band. That key
   can only call `GET /exchange/*` (catalog and bundles); every other route answers 403.
5. **Where the roster comes from (demo only).** If the district MDR is the `ROSTER_MDR` in `config.js`, the page
   needs its base URL, CORS allowance for the page origin, and a service key (same shape as the college's,
   section 3).

## 3. What to ask the college for

1. **Their LIF profile**, published in their MDR. The page looks it up **by name** (`targetModel` in
   `config.js`), so agree the exact name.
2. **MDR base URL** reachable from the browsers that will open the page (not just from inside their network).
3. **A service API key for the page.** It is sent as `X-API-Key` on every call and goes in `config.js`. Today the
   only key the MDR offers for this is a full-privilege service key (the demo uses the compose default for
   `MDR__AUTH__SERVICE_API_KEY__GRAPHQL`, value `changeme1`). Treat it as a demo credential; see section 7.
4. **CORS allowance** for the page's origin: add it to `CORS_ALLOW_ORIGINS` on their MDR API. The demo default
   already includes `http://localhost:8080`, which is why `serve.py` picks 8080.
5. **Demo router enabled** on their MDR API: `MDR__DEMO_ENDPOINTS_ENABLED` (on by default),
   `MDR__DEMO_SAMPLES_DIR` pointing at the samples directory with the manifest, and `MDR__DEMO_TRANSLATOR_URL`
   pointing at their Translator. The page never calls the Translator directly; the MDR proxies the request.
6. **An admin/operator** who will refine the drafted mapping in the mapping editor. The drafter gets the identity
   matches; a person writes the rules that change shape or vocabulary.

## 4. The keys, and who gives them to whom

| Key | Set by | Given to | Lets the holder |
|---|---|---|---|
| `MDR__AUTH__SERVICE_API_KEY__EXCHANGE_PARTNER` on the **district** MDR | District | College operator | Pull the district's published catalog and bundles (`GET /exchange/*`) and nothing else. |
| `MDR__AUTH__SERVICE_API_KEY__EXCHANGE_PARTNER` on the **college** MDR | College | District operator | Same, in the other direction, if the district also wants to see the college's profile. Optional. |
| Admin service key on each MDR (`MDR__AUTH__SERVICE_API_KEY__GRAPHQL` in the compose files) | Each party | Its own operator | Receive bundles, create and publish models and groups. Never leaves the organization. |
| `API_KEY` in `config.js` | College (and district if it serves the roster) | lif-view | Read models, groups and samples, and call the translate proxy. Visible to anyone who opens the page. |

Nobody stores a partner's URL or credential in an MDR. The exchange key travels person to person and lives in
the operator's shell, which is the design decision recorded in LIF Core's ADR on partner connections.

## 5. Steps, in order

Verification for each step is in italics. Commands are for the LIF Core checkout; `scripts/exchange-demo.sh`
runs steps 2 to 5 end to end against the demo stack and prints the `curl` calls with `--dry-run`.

1. **Stand up both stacks.** District: MDR, its database, Translator. College: the same. For the one-host
   demo this is the compose pair in `deployments/advisor-demo-docker`.
   *Verify:* `GET {mdr}/health-check` on both MDRs; the MDR web app logs in.
2. **Publish the district's profile.** In the district MDR set the data model's `State` to `Published`
   (`PUT /datamodels/{id}` or the web app).
   *Verify:* it appears in `GET {district}/exchange/catalog` when called with the exchange key.
3. **College pulls the district's profile.** With the district's exchange key:
   `GET {district}/exchange/bundles/data-models/{id}` saves a bundle. With the college's own admin key:
   `POST {college}/exchange/receive?data_model_type=SourceSchema` with that bundle.
   *Verify:* the response lists the model with `status: created`; it shows in the college's data models as a
   Draft source schema.
4. **Draft the mapping.** Export the college's own profile as a bundle
   (`GET {college}/exchange/bundles/data-models/{own id}`, admin key) and run the `crosswalk_draft` CLI
   (`scripts/generate-crosswalk-draft.py`) with `--source` the received district bundle and `--target` the
   college bundle. Pass `--authored <rules.json>` for hand-written JSONata rules; authored rules win over the
   identity matches. `--notes` attaches an explanation per rule that the page shows.
   *Verify:* the report lists matched, unmatched and `supersededByAuthored` fields; every expression parses
   (the Translator drops a rule whose JSONata does not parse, silently).
5. **Receive and refine the mapping.** `POST {college}/exchange/receive` with the group bundle (admin key). Open
   the group in the college web app's mapping editor and fix what the drafter could not know: code lists,
   date formats, dual-credit flags, split or merged fields. Publish the group when done.
   *Verify:* the college web app's **Import Playground** translates a sample district record through the group
   and shows the expected fields on the right.
6. **Load the roster.** Put the district's sample file in the directory mounted at `MDR__DEMO_SAMPLES_DIR` on
   the MDR named as `ROSTER_MDR`, and add an entry to `demo-samples.json` with `file`, `sourceDataModelName`,
   `sourceDataModelVersion`, `kind: "students"`.
   *Verify:* `GET {roster mdr}/demo/samples` returns one entry per student.
7. **Configure lif-view.** Edit `config.js`: `API_KEY`; one `COLLEGES[]` entry per college with `name`, `key`,
   `mdr` (base URL), `targetModel` (the college profile's exact name), and `sourceModels` mapping the name the
   sample reports to the name the same district model has in that college's registry (they differ when the
   receive step renamed it); `ROSTER_MDR`.
8. **Serve and open.** `python serve.py` and open `http://localhost:8080/?student=<name>`.
   *Verify:* the student list fills, each college card shows courses and grades, and the "How each college
   produced that view" section shows the record in, the LIF record out, and the rules with highlighted fields.
   The browser console shows no CORS or 401 errors.

## 6. Hosting lif-view somewhere other than localhost

- Serve the three files from any static host; `serve.py` is only a convenience.
- Add the page's origin (scheme, host, port) to `CORS_ALLOW_ORIGINS` on every MDR listed in `config.js`.
  Opening `index.html` from the file system never works: the browser sends a `null` origin.
- Each MDR URL in `config.js` must be reachable from the users' browsers, so it is a public or VPN address, not a
  Docker service name.
- Put the page behind the same login the MDR web app uses before anyone outside the demo can reach it (section 7).

## 7. Limits to state up front

- **Synthetic data only, today.** The roster and records come from a samples directory read by an endpoint with
  no per-user authorisation, and the page carries a service key in the browser. That is fine for fictional
  students on a laptop and for nothing else. Real student records would enter through LIF's inbound path
  (Query Planner, Learner Data Export) under the MDR's user login, which lif-view does not use yet.
- **The key in `config.js` is full privilege.** The MDR has a read-only key only for `/exchange/*`. A read-only
  key scoped to `/datamodels`, `/transformation_groups` and `/demo/*` is the change that would make the page
  safe to host; until then rotate the key after any demo given outside the organization.
- **Received profiles are source schemas.** A bundle carries the OpenAPI export, not the inclusion list that
  defines an organization's LIF profile, so the district's profile shows in the college MDR as a `SourceSchema`.
  Mapping works; organization-extension entities do not chain.
- **The Translator has no inbound auth** and takes the newest version of every group registered for a
  source/target pair. Keep it on the private network behind the MDR proxy.
- **A rule that fails to parse is dropped without a message** at translate time. Parse-check authored rules
  before receiving them (step 4).

## 8. Intake checklist

Copy this into the kickoff note and fill it in with each party.

```
District
  [ ] LIF profile name + version, Published in district MDR
  [ ] Publisher name (MDR__EXCHANGE__PUBLISHER_NAME)
  [ ] Exchange partner key generated and handed to the college operator
  [ ] Synthetic sample students file + which model/version it is shaped for
  [ ] (if roster host) MDR base URL, CORS for the page origin, service key for config.js

College
  [ ] LIF profile name + version, Published in college MDR
  [ ] MDR base URL reachable from users' browsers
  [ ] Service key for config.js
  [ ] CORS_ALLOW_ORIGINS includes the page origin
  [ ] MDR__DEMO_SAMPLES_DIR and MDR__DEMO_TRANSLATOR_URL set on the MDR API
  [ ] Named operator for the mapping editor
  [ ] Authored JSONata rules (or the list of fields that need them)

Shared
  [ ] Agreed field list to demonstrate (identity, demographics, enrollment, course completion and grade)
  [ ] Where lif-view is served and who can reach it
  [ ] Date the keys get rotated
```

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Console: CORS error, request blocked | Page origin not in that MDR's `CORS_ALLOW_ORIGINS`, or the page was opened as `file://` | Add the origin and restart the MDR API; serve the page over HTTP. |
| 401 on every call | Wrong `API_KEY`, or the key is not registered on that MDR | Match it to the MDR's service key environment variable. |
| Student list empty | `demo-samples.json` missing from `MDR__DEMO_SAMPLES_DIR`, or the MDR was just restarted | Check `GET /demo/samples`; retry after the container is up. |
| "no mapping found for this pair" | `targetModel` or `sourceModels` name does not match the names in that MDR, or the group is not registered for that exact source/target pair | Compare with `GET /datamodels/?pagination=false` and `GET /transformation_groups/`. |
| Card shows the record but a field is missing | The rule that produces it failed to parse and was dropped, or an identity match was superseded | Run the rules through a JSONata parser; check the report from step 4. |
| Translate returns 502 | `MDR__DEMO_TRANSLATOR_URL` wrong or the Translator is down | Fix the URL on the MDR API; check the Translator container. |
