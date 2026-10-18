# 2GIS collection preflight — historical evidence, 2026-10-18

This records the findings of the earlier read-only documentation and account preflight. It is not a current quota check or execution approval. A separately authorized private campaign subsequently used **11 of 12 collector attempts** and saved 73 unique normalized source records. Ten historical probe attempts remain counted. Detailed account observations, execution manifests and source findings remain local and excluded from Git; see [the member 1 handoff](MEMBER_1_HANDOFF.md) for current engineering status.

## Demo request limit

The [official results guide](https://docs.2gis.com/en/api/search/places/examples/results), reviewed during preflight, limits demo keys to **10 results per page**. The original plan incorrectly used the general API ceiling of 50. All twelve public-template queries now use ten, and the live adapter rejects larger pages before loading credentials, creating collection state or dispatching a request. Ten is a page limit, not a promised number of useful records.

Account quota was checked through the dashboard during the historical preflight. It was not checked again for this offline review/commit. Dashboard usage and the project's conservative attempt ledger are separate observations: failed or uncertain attempts remain counted locally, and a lower provider meter never permits resetting that ledger. Future authorized execution requires a fresh quota check and must preserve the same campaign ceiling.

## Storage evidence and remaining uncertainty

The [Kazakhstan directory API terms](https://law.2gis.kz/api-rules), sections 4.7 and 5.2, were reviewed during preflight and prohibit caching and saving results, including temporary storage; section 5.2 also restricts subsequent processing and distribution. No applicable account-specific exception has been verified. The [Platform Manager agreement](https://law.2gis.ru/en/platform-manager) governs access to that management service and does not establish a Places storage grant. These links preserve the earlier evidence; no fresh legal or provider verification was performed for this commit.

The public template retains `storage_basis=null`. Private execution manifests recorded the user's direction to save locally despite unresolved provider permission. This direction is not a provider license. Storage, retention, indexing, third-party AI processing and public redistribution need applicable coverage; neither demo access nor Git exclusion establishes it. No permission inquiry has been sent.

The collector preserves full credential-scrubbed responses and immutable normalized snapshots. It has no retention expiry or purge workflow. A time-limited or selected-field grant would require implementation changes before use. Manually deleting saved pages breaks replay; any future retention design must preserve attempt accounting. `demo_eligible=false` helps prevent accidental integration but does not grant provider rights.

## Offline verification

The regression test rejects oversized demo pages before key reads, ledger creation or dispatch, using synthetic inputs. **118 offline tests passed in an isolated export of the exact staged file set**, and both default CLI dry runs remained offline; see [the handoff](MEMBER_1_HANDOFF.md). Earlier full-workspace test totals included separate probe recovery changes and are not this commit's test evidence. No provider request, real key read or dataset publication is authorized by this review.
