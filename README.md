# lif-view

A single-page view over the **Learner Information Framework (LIF)**: pick a student, and see that student's
courses and grades as each college's own LIF profile receives them, produced live by the data-model crosswalks
held in each college's LIF Metadata Registry (MDR).

It is one HTML file, a config file and a tiny static server. It holds no learner data and no mappings of its
own: every roster entry, every translation and every rule shown comes from the MDR APIs at the moment you ask.

## What you see

1. **Student** — the district roster, read from the district MDR (`GET /demo/samples`).
2. **One card per college** — the district's record for that student posted to each college's MDR
   (`POST /demo/translate`), which hands it to that college's LIF Translator with the mapping registered for
   the pair. Courses, terms, status, letter and numeric grade, credits, dual-credit tags; running grades are
   marked for in-progress courses.
3. **How each college produced that view** — per college: the record in, the LIF record out, and the mapping's
   rules (JSONata, provenance, notes) read from `GET /transformation_groups/{id}/export`. Fields a hand-written
   rule read are highlighted on the left; fields a hand-written rule wrote are highlighted on the right.
   Hover a highlighted field for the rule.

`?student=Sofia` (a name) or `?student=<record id>` pre-selects a student.

## Requirements

- A running LIF stack whose MDR API(s) expose the demo router (`MDR__DEMO_ENDPOINTS_ENABLED`, on by default),
  with `MDR__DEMO_SAMPLES_DIR` pointing at a samples directory that carries a `demo-samples.json` manifest and
  `MDR__DEMO_TRANSLATOR_URL` pointing at that registry's Translator. The LIF Core demo stack
  (`deployments/advisor-demo-docker` with `docker-compose.exchange.yml`) is set up this way: district MDR on
  8012, college MDR on 8022.
- The page's origin must be in each MDR's `CORS_ALLOW_ORIGINS`. The demo stack allows `http://localhost:8080`,
  which is why `serve.py` defaults to 8080. Opening `index.html` from the file system does not work: browsers
  send a `null` origin, which the MDR rejects.
- Python 3 for `serve.py` (any static file server will do).

## Run

```bash
python serve.py            # http://localhost:8080/
python serve.py 8080       # explicit port
```

Then open http://localhost:8080/?student=Sofia.

## Configure

`config.js`:

| Setting | Meaning |
|---|---|
| `API_KEY` | Sent as `X-API-Key` on every call. The demo stack's default service key is `changeme1`; change it for any other stack. |
| `COLLEGES[]` | One entry per college: display name, MDR base URL, the college's own LIF profile name (`targetModel`), and the source-model names as that registry knows them (`sourceModels`). |
| `ROSTER_MDR` | The MDR whose `/demo/samples` provides the student list. |

Model and mapping ids are never configured: the page resolves them by name (`GET /datamodels/`,
`GET /transformation_groups/`) at load, and picks the newest mapping version registered for each source/target
pair, which is what the Translator applies.

## How it talks to LIF

| Call | Purpose |
|---|---|
| `GET {mdr}/demo/samples` | roster and the source records |
| `GET {mdr}/datamodels/?pagination=false` | model ids by name |
| `GET {mdr}/transformation_groups/?page=1&size=100` | the mapping registered for a source/target pair |
| `POST {mdr}/demo/translate?source_data_model_id=&target_data_model_id=` | the translation (the MDR proxies to its Translator) |
| `GET {mdr}/transformation_groups/{id}/export` | the mapping's rules, provenance and notes |

Nothing is cached across page loads; a mapping's rules are cached for the session.

## Security note

The page carries a service API key in the browser and the demo router has no per-user authorisation. That is
acceptable for a local demo against synthetic data and nothing else. For anything hosted, put the page behind
the MDR's user login and swap the shared key for a per-user credential.

## Provenance

Extracted from `deployments/advisor-demo-docker/demo-pages/course-grades.html` in the LIF Core `localworks`
branch (schema-exchange demo), so it can live and move independently of the LIF Core repository.

## Implementing it for a real district and college

Who runs what, what to ask each party for, which keys go where, and the steps in order: [IMPLEMENTATION.md](IMPLEMENTATION.md).
