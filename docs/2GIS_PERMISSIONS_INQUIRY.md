# 2GIS permissions inquiry — draft, not sent

Prepared: 2026-10-18. Owner: member 1. No API requests or outbound messages are authorized by this document.

Suggested recipient: `api@2gis.com`, the support contact in the [official Places API overview](https://docs.2gis.com/en/api/search/places/overview), checked 2026-10-18. Ask support to route the request to the team responsible for Kazakhstan data licensing if needed. Do not include the API key or screenshots containing it.

## Ready-to-send email

**Subject:** Kazakhstan hackathon project Qadam — permission for Places API storage, retrieval and OpenAI inference

Hello 2GIS team,

We are a three-person team developing Qadam for the Build with AI hackathon. Qadam is a walking assistant for Astana residents and first-time visitors. It will suggest nearby sights, short walks, and coffee/rest stops, with source attribution and clear uncertainty labels. We would like 2GIS to be a main POI source and use 2GIS for the map.

Our Platform Manager organization is **qadam**, country **Kazakhstan**. We created a demo key named **qadam-data-dev**, shown as active from 18 October to 18 November 2026, with a Places API allowance of 1,000 requests. We have not yet made a Places API request. We are asking about permitted use before collecting a dataset; we are not requesting a paid subscription or accepting a quotation through this email.

The proposed Python backend would automatically collect a small, bounded Astana POI sample, retain source IDs and provenance, and search those records before generating recommendations. We propose an initial feasibility probe of at most 10 requests; any larger collection would have a separately agreed scope. The initial fields would be IDs, names, coordinates, categories, descriptions and opening hours when available. We do not currently need contact details, photos or review text.

Could you please confirm the following separately, including any limits or additional agreements required?

1. **Applicable agreement and access:** Which terms govern this Kazakhstan organization, demo key and Astana data? Is this educational hackathon use permitted during the demo? Are the requested fields available with this key, and are there geographic restrictions?
2. **Temporary feasibility probe:** May we inspect responses in memory, compute field-completeness and relevance diagnostics, and retain aggregate counts without keeping the venue records? If even this needs additional permission, please specify the process.
3. **Private storage and automated collection:** May our team store raw responses and normalized POI records locally for development and a repeatable demo? Which fields, maximum volume, retention period, refresh frequency, deletion requirements and post-demo expiry rules apply? Does access by our three teammates require separate users or agreements?
4. **Retrieval indexing:** May we build a private lexical search index from those records? Separately, may we derive and retain vector embeddings? We can use lexical retrieval initially if embeddings are not permitted.
5. **OpenAI processing:** May we send a small set of retrieved POI fields to the OpenAI API to generate grounded recommendations and summaries? This is inference, not a proposal to train or fine-tune a model. If we later use OpenAI embeddings, does that require separate permission? Please specify any allowed fields, provider/retention conditions, territorial restrictions or required agreement. We have not yet selected or verified the OpenAI model and data-retention configuration.
6. **Demo display and recording:** May we show attributed POI facts and generated recommendations to judges, in slides, and in a public YouTube demo recording? Are screenshots, short source excerpts and derived summaries permitted, and what notices or links must accompany them?
7. **Redistribution:** Separately from display, may we publish a small POI snapshot, test fixtures derived from real records, or an index/embeddings in our public GitHub repository or prototype archive? If not, may we publish only our collector code and synthetic fixtures while keeping the permitted dataset private? Please distinguish permissions for source records and derived artifacts.
8. **Attribution and continuation:** What exact attribution, source links and freshness labels are required? If the demo license is insufficient, is an educational/hackathon permission or suitable data-export license available, and what would its scope and cost be? How should we handle retained data and public recordings after the demo expires?

Please reply with the applicable agreement or written authorization and any conditions for each use. In particular, permission for API calls alone would not resolve our questions about storage, third-party AI processing or redistribution.

Thank you,
Qadam team
Build with AI hackathon, Astana

## How to record the reply

Keep the original correspondence private; record only the necessary permission scope and an evidence reference in project documentation. Do not publish personal contact details or confidential contract terms. Fill the following only from an explicit answer; silence is unresolved, not consent.

| Use | Current status | Evidence / conditions to record |
|---|---|---|
| In-memory probe and aggregate diagnostics | Unconfirmed | Applicable terms or written answer |
| Private raw/normalized records | Unconfirmed | Fields, volume, storage location, retention, expiry |
| Lexical index | Unconfirmed | Permitted scope and deletion |
| Embeddings | Unconfirmed | Derivation, provider and storage conditions |
| OpenAI inference | Unconfirmed | Fields, third-party transfer and retention conditions |
| Public display / video | Unconfirmed | Attribution, excerpts and post-expiry handling |
| Public snapshot / derived artifacts | Unconfirmed | Separate redistribution grant |

Next: human review of this draft. Sending requires an explicit instruction; no email has been sent. The [probe plan](2GIS_PROBE_PLAN.md) also requires execution approval before any live calls.
