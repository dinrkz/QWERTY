# 2GIS permissions inquiry — deferred, not sent

Prepared: 2026-10-18. Owner: member 1. The user chose to continue without contacting 2GIS. Keep this draft as a reference; do not send it or make outreach a prerequisite for ordinary API evaluation. No API requests or outbound messages are authorized by this document. Persistent storage, AI-processing and redistribution rights remain unverified.

Suggested recipient: `api@2gis.com`, the support contact in the [official Places API overview](https://docs.2gis.com/en/api/search/places/overview), checked 2026-10-18. Ask support to route the request to the team responsible for Kazakhstan data licensing if needed. Do not include the API key or screenshots containing it.

## Deferred email template

This template records questions for possible future use. It has not been sent, and no outreach is requested now. Account identifiers, key labels, quota observations and private source records are deliberately omitted.

**Subject:** Kazakhstan hackathon project Qadam — permission for Places API storage, retrieval and OpenAI inference

Hello 2GIS team,

We are a three-person team developing Qadam for the Build with AI hackathon. Qadam is a walking assistant for Astana residents and first-time visitors. It will suggest nearby sights, short walks, and coffee/rest stops, with source attribution and clear uncertainty labels. We would like 2GIS to be a main POI source and use 2GIS for the map.

We have completed a bounded transient feasibility probe and a separately bounded private collection using demo access for Astana. The project owner authorized those activities, but we have not verified a provider grant for persistent storage, retrieval indexing, third-party AI processing or redistribution. We are asking for clarification of the applicable terms and the handling of retained records; we are not requesting a paid subscription or accepting a quotation through this email.

Our Python tooling collected a small Astana POI sample, retaining source IDs and provenance privately. A future retrieval-and-generation flow would search eligible records before generating recommendations; that integration is not yet verified. The collected fields include IDs, names, coordinates, categories, descriptions and opening hours when available. We do not currently need contact details, photos or review text.

Could you please confirm the following separately, including any limits or additional agreements required? Our immediate questions concern the retained private records and their proposed use in a local demo. Embeddings, public dataset publication and a hosted public prototype are optional future uses; please distinguish them from the local demo.

1. **Applicable agreement and access:** Which terms govern Kazakhstan demo access and Astana data? Is this educational hackathon use permitted during the demo? Which requested fields are covered, and are there geographic restrictions?
2. **Temporary feasibility diagnostics:** What terms apply to in-memory response inspection and retaining aggregate field-completeness and relevance diagnostics without venue records? Does this require additional permission?
3. **Private storage and automated collection:** May our team retain the existing raw responses and normalized POI records locally for development and a repeatable demo? Which fields, maximum volume, retention period, refresh frequency, deletion requirements and post-demo expiry rules apply? Please specify any required handling of records already collected. Does access by our three teammates require separate users or agreements?
4. **Retrieval indexing:** May we build a private lexical search index from those records? Separately, for an optional future use, may we derive and retain vector embeddings? We can use lexical retrieval initially if embeddings are not permitted.
5. **OpenAI processing:** May we send a small set of retrieved POI fields to the OpenAI API to generate grounded recommendations and summaries? This is inference, not a proposal to train or fine-tune a model. If we later use OpenAI embeddings, does that require separate permission? Please specify any allowed fields, provider/retention conditions, territorial restrictions or required agreement. We have not yet selected or verified the OpenAI model and data-retention configuration.
6. **Demo display and recording:** May we show attributed POI facts and generated recommendations to judges, in slides, and in a public YouTube demo recording? Are screenshots, short source excerpts and derived summaries permitted, and what notices or links must accompany them? Separately, would we need additional permission if we later offer a publicly accessible interactive prototype?
7. **Optional redistribution:** Separately from display, may we publish a small POI snapshot, test fixtures derived from real records, or an index/embeddings in our public GitHub repository or prototype archive? If not, would keeping the permitted dataset private while publishing only our own collector code and synthetic fixtures satisfy the demo's licensing conditions? Please distinguish permissions for source records and derived artifacts.
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
| Optional hosted public prototype | Unconfirmed | Public access, attribution and service conditions |
| Public snapshot / derived artifacts | Unconfirmed | Separate redistribution grant |

Updated on 2026-10-18 to reflect the completed transient probe and separately authorized private collection. The [probe plan](2GIS_PROBE_PLAN.md) exhausted its ten-attempt budget. The collector remains at eleven of twelve attempts, with 73 unique records kept privately. No email has been sent; outreach remains deferred at the user's request. This template authorizes no additional API request, message, data transfer or publication, and the project owner's authorization does not establish provider permission.
