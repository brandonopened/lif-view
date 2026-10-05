# Implementation guide: showing a district's students at a college with lif-view

Three people are involved, and this guide is written for each of them separately:

- **Phil, the project coordinator.** Runs the project, owns the schedule and the checklist, does not touch servers.
- **The district's technical contact.** Runs the district side and sends the student records.
- **The college's technical contact.** Runs the college side and shows the students.

None of you is assumed to know LIF. Read the two pages of **Plain-language background** first, then your own
section. Each step says what to do and how you know it worked. Where a step needs someone else's output, it says
so and names them.

---

## Plain-language background (everyone reads this)

**What LIF is.** The Learner Information Framework is open-source software for moving student records between
organizations that describe students differently. A district's system might say `gradeLvl: "11"`; a college's
system might say `enrollmentLevel: "Grade 11"`. LIF holds each organization's **profile** (the list of fields it
uses and what they mean) and a **mapping** between two profiles (field-by-field rules that turn one shape into
the other). A small service called the **Translator** applies a mapping to a record.

**The four things that get installed.** Each organization runs its own copy of two LIF services:

| Thing | Plain description |
|---|---|
| **MDR** (Metadata Registry) | A web service plus database that stores the organization's profile, any partner profiles it has received, and the mappings between them. It has a web app for editing mappings and a programming interface (API) the page uses. |
| **Translator** | Applies a mapping to one record and returns the converted record. It sits behind the MDR and is never called directly from a browser. |

So there are **two MDRs and two Translators**: one pair at the district, one pair at the college. They never
call each other. Everything passes between them through a person (section "Handing the profile over").

**What lif-view is.** A single web page. Pick a student, and it shows that student's courses and grades as each
college's profile receives them. Under that it shows the record that went in, the record that came out, and the
mapping rules with the changed fields highlighted. It stores nothing. It reads the student list from one MDR
and asks each college's MDR to translate the record live.

**The one flow this project sets up.**

1. The district writes down its profile in its MDR and marks it *Published*.
2. The college's technical contact **pulls** a copy of that profile from the district MDR (using a read-only key
   the district gives them) and loads it into the college MDR.
3. A tool drafts a mapping from the district profile to the college profile. A person at the college fixes what
   the tool could not know (code lists, date formats, special flags).
4. The district supplies a file of **made-up** students in its profile's shape.
5. lif-view is pointed at the two MDRs, and the students appear with grades in the college's terms.

**Words you will hear.**

| Word | Meaning here |
|---|---|
| Profile / data model | The organization's list of fields. The MDR calls it a *data model*. |
| Published | A data model marked as final. Only Published models can be shared. |
| Bundle | A JSON file the MDR produces that carries a data model (or a mapping) so another MDR can load it. |
| Transformation group / mapping | The set of rules from one data model to another. |
| JSONata | The small expression language each rule is written in, e.g. `$uppercase(firstName)`. |
| API key | A password-like string a program sends with each request. There are several kinds (section "Keys"). |
| CORS | A browser safety rule. A web page may only call servers that have listed the page's address. Each MDR must list where lif-view is served from. |
| Docker / Docker Compose | The tool LIF uses to run all its services on one machine with one command. |

**Keys, and who gives which to whom.** This is the part people get wrong, so it is stated once here.

| Key | Who creates it | Who receives it | What it allows |
|---|---|---|---|
| **Exchange partner key** (set on the district MDR) | District | College's technical contact | Downloading the district's Published profile. Nothing else. |
| **Admin key** on each MDR | Each organization | Nobody outside | Full control of that MDR. Stays inside the organization. |
| **Page key** (goes in lif-view's `config.js`) | College (and the district, if its MDR serves the student list) | Whoever hosts lif-view | What the page needs to read models, mappings and samples, and ask for a translation. Anyone who opens the page can see it, so treat it as a demo key and rotate it when the demo is over. |
| **Demo user password** (`LIF_DEMO_USER_PASSWORD`) | Each organization | Its own staff who log in to the MDR web app | Logging in to the MDR web app. Not used by lif-view. |

**Data.** The page reads students from a sample file, and the endpoint that serves it has no per-user login.
That is acceptable for **fictional students only**. Do not put real student records into this flow. If the
project later needs real records, that is a different piece of work on the LIF side, not a configuration change.

---

## Part A: Phil, the project coordinator

You do not install anything. You make sure the right things exist in the right order and that the two
technical contacts have what they need from each other. Expect four to six working sessions across the three of
you; the longest step is the college fixing the mapping.

### A1. Kickoff (one meeting, both technical contacts)

1. Agree the **student fields the demo must show**. The default set this page was built for:
   student identity (name, ids), demographics (birth date, sex, race/ethnicity), enrollment (school, grade,
   entry and exit dates), and course completion and grade (course, term, letter and numeric grade, credits,
   dual-credit flag). Write the agreed list down; it drives the mapping work.
2. Agree the **exact names** of the two profiles as they will appear in the MDRs, for example
   "Northgate High School LIF" and "Riverbend CC LIF". The page looks them up by name, so a spelling change
   later breaks it.
3. Agree **where lif-view will be served**. For a first run this is one laptop (`http://localhost:8080`). If
   anyone outside that laptop needs to see it, decide the address now, because both MDRs must list it (CORS).
4. Agree who is the **mapping editor** at the college: the person who will read the drafted rules and fix them.
   They need to know the college's own fields well; they do not need to be a programmer.
5. Agree the **date the keys get rotated** after the demo.

*Done when:* the five items above are written in the kickoff note. Send the note to both contacts with the
intake checklist (A5) attached.

### A2. District track (you chase these)

| # | Ask the district for | Why | Done when |
|---|---|---|---|
| 1 | Their LIF stack running (B1) | Everything else needs it | District confirms the MDR web app opens |
| 2 | Their profile entered and Published (B2) | The college can only pull Published models | District sends you the model name, version and id |
| 3 | The exchange partner key (B3) | The college uses it to pull | District confirms it was handed to the college contact directly (not through you, not by email if avoidable) |
| 4 | The fictional students file (B4) | The roster the page shows | File received, and it says which profile and version it is shaped for |
| 5 | Page key and CORS entry, if the district MDR serves the roster (B5) | The page reads the student list from one MDR | District confirms both |

### A3. College track (you chase these)

| # | Ask the college for | Why | Done when |
|---|---|---|---|
| 1 | Their LIF stack running (C1) | | College confirms the MDR web app opens |
| 2 | Their profile entered and Published (C2) | The mapping target | College sends you the model name, version and id |
| 3 | District profile pulled and received (C3) | Needs the key from A2 step 3 | College shows the district model in their MDR's data-model list |
| 4 | Mapping drafted, refined and Published (C4, C5) | The core of the project | College's Import Playground translates a sample student correctly |
| 5 | Page key, CORS entry, demo settings (C6) | So the page can call the college MDR | College sends the MDR address and confirms the three settings |
| 6 | Roster loaded (C7, if the college MDR serves it) | | `/demo/samples` lists the students |
| 7 | lif-view configured and opened (C8) | The deliverable | A screenshot of a student's card from the college's side |

### A4. Walk-through and sign-off

1. Pick two students from the file: one with completed courses, one with a course still in progress.
2. Open lif-view for each. Check the four agreed field areas appear on the college card.
3. Scroll to "How each college produced that view". Check that the highlighted fields are the ones the
   college's mapping editor said they changed. Hover one and read the rule name.
4. Have the district contact confirm the "In" record is their file's record untouched, and the college contact
   confirm the "Out" record is in their profile's shape.
5. Confirm the key rotation date is in someone's calendar.

### A5. Intake checklist (paste into the kickoff note)

```
Agreed at kickoff
  [ ] Field list to demonstrate
  [ ] Exact profile names: district ______________  college ______________
  [ ] Where lif-view is served: ______________
  [ ] College mapping editor: ______________
  [ ] Key rotation date: ______________

District
  [ ] LIF stack running; MDR web app opens
  [ ] Profile entered, Published; name/version/id sent to Phil
  [ ] Publisher name set (MDR__EXCHANGE__PUBLISHER_NAME)
  [ ] Exchange partner key created and handed to the college contact
  [ ] Fictional students file sent, with profile name + version
  [ ] (if serving the roster) MDR address, CORS entry, page key

College
  [ ] LIF stack running; MDR web app opens
  [ ] Profile entered, Published; name/version/id sent to Phil
  [ ] District profile received (shows in data-model list)
  [ ] Mapping drafted, refined, Published
  [ ] Import Playground shows a sample student translated correctly
  [ ] MDR address reachable from the demo browser
  [ ] CORS_ALLOW_ORIGINS includes the lif-view address
  [ ] MDR__DEMO_SAMPLES_DIR and MDR__DEMO_TRANSLATOR_URL set
  [ ] Page key issued
  [ ] (if serving the roster) students file + manifest entry in the samples folder
  [ ] lif-view config.js filled in; page opens; screenshot sent to Phil
```

---

## Part B: the district's technical contact

You will run LIF on one machine, describe your student fields in it, mark that description final, hand the
college a read-only key, and produce a file of made-up students. You need: a machine with Docker Desktop, Git,
and about 8 GB of free RAM; a terminal; a text editor.

### B1. Install and start LIF

1. Install Docker Desktop and Git if you do not have them. Start Docker Desktop and wait until it says it is
   running.
2. Get the LIF Core code:
   ```bash
   git clone https://github.com/LIF-Initiative/lif-core.git
   cd lif-core/deployments/advisor-demo-docker
   ```
3. Create a file named `.env` in that folder with two lines. Pick long random values; these are passwords.
   Never paste them into chat or email.
   ```
   LIF_DEMO_USER_PASSWORD=<a password for logging in to the MDR web app>
   MDR__AUTH__SERVICE_API_KEY__EXCHANGE_PARTNER=<a long random string; this is the key you will give the college>
   ```
   Also set your organization's name so it is stamped on what you publish, by adding:
   ```
   MDR__EXCHANGE__PUBLISHER_NAME=<Your District Name>
   ```
4. Start the district services (database, MDR, Translator, and the MDR web app):
   ```bash
   docker compose up -d lif-mdr-database lif-mdr-database-restore lif-mdr-api lif-translator-org1 lif-mdr-app
   ```
   The first run downloads and builds images and can take 10 to 20 minutes.
5. Open http://localhost:5173 in a browser. Log in with one of the demo users (listed in LIF Core's
   `docs/operations/guides/testing.md`; e-mail style names such as `smarin_lifdemo@stateu.edu`) and the
   password you put in `.env`.

*Done when:* the MDR web app opens and you can see a list of data models. Your MDR's API address is
`http://localhost:8012`.

**If Docker Desktop restarts** (Windows updates do this), the containers stop. Start them again with the same
command. Do not add `--remove-orphans` to any compose command on this machine.

### B2. Enter your profile and publish it

Your profile is the list of fields your student records carry, grouped the way your records are grouped
(student, demographics, enrollment, course record). There are two ways to get it into the MDR.

**Option 1, start from the seeded LIF profile and edit (recommended for a first project).** The stack comes
with a sample profile already in it. In the web app, open it, rename it to the exact name agreed at kickoff,
and add or remove fields until it matches your records. For nested groups (a student with many course rows)
the MDR uses *entities* with parent-child links; the web app's data-model editor handles this.

**Option 2, upload a description file.** If you already have an OpenAPI/JSON Schema description of your
records, the MDR can import it (`POST /datamodels/open_api_schema/upload`, listed in the API docs at
http://localhost:8012/docs). A developer should do this step.

Then publish:

1. In the web app, open your data model and set its state to **Published**. (Through the API this is
   `PUT /datamodels/{id}` with `"State": "Published"`.)
2. Note the model's **name, version and id** (shown in the web app and in `GET /datamodels/`).

*Done when:* this command, run with the exchange key you created in B1, lists your model:
```bash
curl -H "X-API-Key: $EXCHANGE_KEY" http://localhost:8012/exchange/catalog
```
Send Phil the name, version and id. Not the key.

### B3. Hand the college its key

The value you set as `MDR__AUTH__SERVICE_API_KEY__EXCHANGE_PARTNER` is the key. It only works for
`GET /exchange/*` on your MDR, so the holder can download your Published models and nothing else.

1. Give it to the college's technical contact directly: a password manager share, or read aloud on a call.
   Not through Phil, and not in a group email.
2. Tell them your MDR address as reachable **from their machine**. On one laptop this is
   `http://localhost:8012`. On two machines it is your machine's address on a network you both reach, and
   port 8012 must be open to them.

*Done when:* the college contact confirms the catalog command above works from their side.

### B4. Produce the fictional students file

1. Create a JSON file in the shape below. Every record must follow your profile's field names exactly, so the
   college's mapping lands on them. Use invented names and ids. Include at least one student with a course still
   in progress (a running percentage, no final grade) so the page can show "running grade".
   ```json
   {
     "students": {
       "604858": { "Person": { "Name": { "firstName": "Sofia", "lastName": "Garcia" }, "...": "..." } },
       "604866": { "...": "..." }
     }
   }
   ```
   The LIF Core repository has a worked example in `reference_data/samples/northgate-lif-students.json`
   (seven students, four field areas) that you can copy the shape from.
2. Check it is valid JSON (any editor with JSON support will flag errors).
3. Send the file to the college contact (and Phil) **with your profile's exact name and version** written in the
   message. The college needs those two strings to register the file.

*Done when:* the college confirms the file loads into their Import Playground against your received model.

### B5. If your MDR will serve the student list to the page

The page reads its roster from one MDR (`ROSTER_MDR` in lif-view's `config.js`). If that is yours:

1. Copy your students file into `lif-core/reference_data/samples/` (that folder is mounted into the MDR
   container as `/opt/app/demo-samples`).
2. Add an entry to `reference_data/samples/demo-samples.json`:
   ```json
   { "file": "<your file>.json", "sourceDataModelName": "<exact profile name>",
     "sourceDataModelVersion": "<version>", "kind": "students" }
   ```
3. Check `curl -H "X-API-Key: <admin key>" http://localhost:8012/demo/samples` returns one entry per student.
   The admin key is the value of `MDR__AUTH__SERVICE_API_KEY__GRAPHQL` (default `changeme1` if you did not set
   it; change it before anyone else uses the stack).
4. Make sure the lif-view address is in your MDR's `CORS_ALLOW_ORIGINS` (`http://localhost:8080` is already in
   the default list). To add another, set `CORS_ALLOW_ORIGINS` in `.env` to the full comma-separated list and
   restart `lif-mdr-api`.
5. Give the college contact the key the page will use. Today that is the admin key (see "Keys" above about
   rotating it).

---

## Part C: the college's technical contact

You will run LIF on your machine, describe your fields, pull the district's profile with the key they give
you, draft and fix the mapping, and set up the page. You need the same machine requirements as the district,
plus Python 3 (for the drafting tool and the page server) and `uv` (`pip install uv`).

### C1. Install and start LIF

Same as B1 for the district, with one difference: the LIF demo stack ships a second, "college" copy of the
services so both sides can run on one laptop. If you are on **your own machine**, run the plain district
commands from B1 (your MDR will be on port 8012 and web app on 5173). If you are on the **same machine as the
district**, start the college copy instead, from `lif-core/deployments/advisor-demo-docker`:

```bash
docker compose -f docker-compose.yml -f docker-compose.exchange.yml up -d \
  lif-mdr-database-college lif-mdr-database-restore-college lif-mdr-api-college lif-translator-college lif-mdr-app-college
```

Your MDR API is then `http://localhost:8022` and the web app http://localhost:5174. The `.env` in B1 step 3 is
shared; set `MDR__EXCHANGE__PUBLISHER_NAME_COLLEGE=<Your College Name>` in it.

The rest of Part C uses `http://localhost:8022` as "your MDR". Substitute 8012 if you are on your own machine.

*Done when:* your web app opens and lists data models.

### C2. Enter your profile and publish it

Same as B2. Use the exact name agreed at kickoff. Publish it. Note name, version and id, and send them to Phil.

Keep a copy of your profile as a bundle; the drafter needs it in C4:
```bash
curl -H "X-API-Key: $ADMIN_KEY" "http://localhost:8022/exchange/bundles/data-models/<your model id>" -o college-bundle.json
```
`$ADMIN_KEY` is your MDR's `MDR__AUTH__SERVICE_API_KEY__GRAPHQL` value.

### C3. Pull the district's profile into your MDR

Needs: the district's exchange key and MDR address (B3).

1. See what they publish:
   ```bash
   curl -H "X-API-Key: $DISTRICT_EXCHANGE_KEY" http://<district mdr>/exchange/catalog
   ```
   Find the district model's id in the `dataModels` list.
2. Download its bundle:
   ```bash
   curl -H "X-API-Key: $DISTRICT_EXCHANGE_KEY" "http://<district mdr>/exchange/bundles/data-models/<id>" -o district-bundle.json
   ```
3. Load it into **your** MDR with **your** admin key:
   ```bash
   curl -H "X-API-Key: $ADMIN_KEY" -H "Content-Type: application/json" \
     -X POST "http://localhost:8022/exchange/receive?data_model_type=SourceSchema" \
     --data @district-bundle.json
   ```
   The response lists the model with `"status": "created"` and its new id in your MDR. Write that id down.

*Done when:* the district's model appears in your web app's data-model list (as a Draft source schema).
Nothing was sent to the district; you only downloaded.

### C4. Draft the mapping

The drafter matches fields with the same name and path automatically ("identity" rules) and reports what it
could not match. Hand-written rules can be supplied in a file and win over the automatic ones.

1. From the `lif-core` checkout:
   ```bash
   uv run python scripts/generate-crosswalk-draft.py \
     --source district-bundle.json --target college-bundle.json \
     --name "<District profile> -> <College profile>" --version 0.1 \
     -o group-bundle.json --report report.json
   ```
2. Open `report.json`. It lists `matched`, `unmatched` on each side, and later `supersededByAuthored`. The
   unmatched target fields are the ones that need a hand-written rule; the agreed field list from kickoff tells
   you which of them matter.
3. Write the hand-written rules in a JSON file (the LIF Core repo's `reference_data/samples/northgate-lif-sis-rules.json`
   is a 22-rule example covering identity, demographics, enrollment and course grades) and re-run with
   `--authored rules.json --notes notes.json`. Notes are one sentence per rule explaining the choice; the page
   shows them.
4. **Check every rule parses.** A rule with a JSONata typo is dropped by the Translator with no message. From
   the checkout:
   ```bash
   uv run python -c "import json,jsonata; [jsonata.Jsonata(r['Expression']) for r in json.load(open('rules.json'))['Transformations']]; print('all parse')"
   ```
   (The example rules files hold their rules under a top-level `Transformations` list.)

*Done when:* `report.json` shows the agreed fields matched or superseded by an authored rule, and the parse
check prints `all parse`.

### C5. Load the mapping, fix it, publish it

1. Load the group bundle into your MDR:
   ```bash
   curl -H "X-API-Key: $ADMIN_KEY" -H "Content-Type: application/json" \
     -X POST http://localhost:8022/exchange/receive --data @group-bundle.json
   ```
   The response gives the group's id and how many rules were imported and skipped.
2. In your web app open **Explore → Mappings → that group**. Each rule is a wire between a district field
   and a college field with its JSONata. This is where the mapping editor (the person named at kickoff) works:
   code lists (`"M"` to `"Male"`), date formats, grade scales, the dual-credit flag, fields split or merged.
3. Test as you go in **Import Playground** (web app menu): pick the group, pick a sample district student,
   run. The district record is on the left, your profile's record on the right, the rules underneath.
   The sample students come from the district's file (C7).
4. When the result is right for the agreed fields, set the group's state to Published in the web app.

*Done when:* Import Playground shows a district student translated with every agreed field filled correctly.

### C6. Open your MDR to the page

Three settings on your MDR API container (`lif-mdr-api-college`, or `lif-mdr-api` on your own machine). Set
them in `.env` and restart that container.

| Setting | Value | Why |
|---|---|---|
| `CORS_ALLOW_ORIGINS` | the default list plus the lif-view address (e.g. `http://localhost:8080`, already in the default) | Browsers refuse cross-site calls otherwise |
| `MDR__DEMO_SAMPLES_DIR` | `/opt/app/demo-samples` (already set in the compose file) | Where the roster file is read from |
| `MDR__DEMO_TRANSLATOR_URL` | `http://lif-translator-college:8007` (already set) | The page asks the MDR to translate; the MDR forwards to this Translator |

Then decide the **page key**. Today the page uses the admin key (`MDR__AUTH__SERVICE_API_KEY__GRAPHQL`). Set it
to something other than the default and plan to rotate it after the demo. If the page will be opened from any
machine other than yours, your MDR address must be reachable from there and that machine's view of the lif-view
address must be in `CORS_ALLOW_ORIGINS`.

*Done when:* `curl -H "X-API-Key: $PAGE_KEY" http://localhost:8022/datamodels/?pagination=false` lists your
models, and the browser later shows no CORS errors.

### C7. Load the student roster (if your MDR serves it)

Same as B5, in the college copy: put the district's file in `reference_data/samples/`, add the manifest entry
with the district profile's **exact name and version as the district wrote them**, and check
`GET /demo/samples` on your MDR returns the students. If the district MDR serves the roster instead, skip this
and make sure `config.js` points `ROSTER_MDR` at it.

### C8. Configure and open lif-view

1. Get the page: `git clone <lif-view repository>` and open its folder.
2. Edit `config.js`:
   - `API_KEY`: the page key from C6.
   - `COLLEGES`: one entry for your college: `key` (short id, e.g. `riverbend`), `name` (display name),
     `mdr` (`http://localhost:8022`), `targetModel` (your profile's exact name), and `sourceModels`: an object
     mapping the district profile's name **as written in the sample file** to its name **in your MDR** (usually
     the same string; different if you renamed it on receive).
   - `ROSTER_MDR`: the MDR address that serves `/demo/samples` (yours, or the district's).
   - Remove or keep the second demo college entry; one card per entry is drawn.
3. Serve it from the folder: `python serve.py` (port 8080).
4. Open http://localhost:8080/?student=<a first name from the file>.

*Done when:* the student list fills, your college's card shows courses and grades, and the section below shows
In / Out records with the highlighted fields and the rules table. Open the browser console (F12): no red
errors. Send Phil a screenshot.

### C9. If something is wrong

| You see | Likely cause | Do |
|---|---|---|
| Console: CORS / blocked request | lif-view's address is not in that MDR's `CORS_ALLOW_ORIGINS`, or you opened `index.html` as a file | Add the address, restart the MDR API; always open via `http://` |
| 401 on every call | `API_KEY` in `config.js` does not match the MDR's key | Check the MDR's `MDR__AUTH__SERVICE_API_KEY__GRAPHQL` |
| Student list empty | Manifest missing or wrong folder; MDR just restarted | `GET /demo/samples`; retry in a minute |
| "no mapping found for this pair" | A name in `config.js` does not match the MDR, or the group's source/target are different models | Compare with `GET /datamodels/?pagination=false` and `GET /transformation_groups/?page=1&size=100` |
| A field is empty in the Out record | Its rule failed to parse and was dropped, or the source field's path differs from the rule | Run the parse check (C4 step 4); open the rule in the mapping editor |
| Translate returns an error | `MDR__DEMO_TRANSLATOR_URL` wrong or Translator container down | `docker ps`; fix the URL; restart `lif-mdr-api-college` |
| Everything stopped after a reboot | Docker Desktop restarted | Re-run the `docker compose up -d ...` command from C1 |

---

## What this guide does not cover

- **Real student records.** Everything above uses a fictional roster served without per-user login. Live data
  would go through LIF's inbound path (Query Planner, Learner Data Export) behind the MDR's user login, and
  lif-view would need to read from there. That is development work, not configuration.
- **A page key that is read-only.** The MDR's read-only key covers only `/exchange/*`. The page would be safe to
  host once a read-only key exists for `/datamodels`, `/transformation_groups` and `/demo/*`.
- **A second college.** Repeat Part C at that college and add a second `COLLEGES` entry in `config.js`. The
  district does nothing new except hand that college its exchange key.
