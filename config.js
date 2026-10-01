// lif-view configuration. Edit this file; index.html reads it at load.
//
// Each entry is a college that runs a LIF Metadata Registry (MDR) with the demo router enabled
// (GET /demo/samples, POST /demo/translate). `targetModel` is the college's own LIF profile by name;
// `sourceModels` maps the name a sample record reports to the name the same source model has in that
// registry. Ids are resolved by name at load time, so a re-seeded database does not break the page.
//
// API_KEY is the docker-compose default for the LIF demo stack (MDR__AUTH__SERVICE_API_KEY__GRAPHQL).
// Change it for any stack that is not the local demo.
const API_KEY = "changeme1";
const COLLEGES = [
  { key: "riverbend", name: "Riverbend Community College", mdr: "http://localhost:8022", targetModel: "Riverbend CC LIF",
    sourceModels: { "Northgate High School LIF": "Northgate High School LIF", "Northgate Ed-Fi v5": "Northgate Ed-Fi v5" } },
  { key: "stateu", name: "State University", mdr: "http://localhost:8012", targetModel: "StateU LIF",
    sourceModels: { "Northgate High School LIF": "Northgate High School LIF", "Northgate Ed-Fi v5": "Northgate Ed-Fi v5" } },
];
const ROSTER_MDR = "http://localhost:8012";
