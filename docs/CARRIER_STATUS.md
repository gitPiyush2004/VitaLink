# Carrier integration status

**Last verified: 8 September 2026, by reading each carrier's own developer
documentation.** Where a claim in the spec's PART 6.1 table has drifted, the
correction is stated and marked.

This document exists because the six carriers are **not equivalent**, and
pretending they are would mean either fabricating quotes for the ones that have no
public quotation API, or quietly dropping them from the comparison. Rule 4
forbids both.

---

## Summary

| Carrier            | Public self-serve portal                                                                         | Quotation API                                                                      | Transit time        | Tracking                  | Auth                         | Sandbox                          | Tier                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------- | ------------------------- | ---------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| **DSV**            | Yes — `developer.dsv.com`                                                                        | Yes — Quote API (Air, Sea, Road)                                                   | via Quote           | Tracking API              | OAuth 2.0 client_credentials | Yes — `my-demo` product variants | **A — reference adapter**                                            |
| **FedEx**          | Yes — `developer.fedex.com`                                                                      | Yes — Rates and Transit Times v1                                                   | same API            | Track API                 | OAuth 2.0                    | Yes                              | A                                                                    |
| **UPS**            | Yes — `developer.ups.com`                                                                        | Yes — Rating API                                                                   | Time in Transit API | Tracking API              | OAuth 2.0                    | Yes                              | A                                                                    |
| **DHL**            | Yes — `developer.dhl.com`                                                                        | Express Rating self-serve; **Freight / Global Forwarding rating is account-gated** | via rating          | Shipment Tracking Unified | API key / OAuth per product  | Per-product test keys            | A for tracking + express rating, **B for healthcare freight rating** |
| **Kuehne+Nagel**   | **No public self-serve portal.** myKN "Connectivity" is an account-arranged EDI/API integration. | **Not publicly documented**                                                        | —                   | via myKN account          | account-arranged             | No public sandbox                | **C — adapter + sandbox only**                                       |
| **CEVA Logistics** | **No official public developer portal found.**                                                   | **Not publicly documented**                                                        | —                   | aggregator-mediated only  | n/a                          | No                               | **C — adapter + sandbox only**                                       |

---

## DSV — the reference adapter

DSV is built first and completely, and the others follow its shape. It is the only
one of the six with a documented, self-serve, OAuth-2.0 quotation API _and_ a
documented demo environment, which makes it the only carrier that can return a
real response against real credentials without a commercial account.

### What was verified directly

From `developer.dsv.com/oauth-guide`, read on 8 September 2026:

| Item                      | Value                                                           |
| ------------------------- | --------------------------------------------------------------- |
| Demo token endpoint       | `https://api.dsv.com/my-demo/oauth/v1/token`                    |
| Production token endpoint | `https://api.dsv.com/my/oauth/v1/token`                         |
| Grant type                | `client_credentials`                                            |
| `client_id`               | myDSV username                                                  |
| `client_secret`           | myDSV password                                                  |
| Required header           | `DSV-Subscription-Key` (from the developer-portal profile page) |
| Body encoding             | `application/x-www-form-urlencoded`                             |
| Access token lifetime     | **10 minutes**                                                  |
| Refresh token lifetime    | **30 days**, `grant_type=refresh_token`                         |
| Business API auth         | `Authorization: Bearer {access_token}`                          |

The ten-minute access token is the detail that shapes the adapter: a quote
fan-out cannot assume a cached token is still valid, so the adapter refreshes
proactively rather than reactively. See `packages/connectors/src/carriers/`.

A Quote product exists and covers Air, Sea, Road (EU) and Rail; the demo variant
is published as `generic-quote-demo`, matching the `-demo` naming the spec's table
predicted.

### Correction to the spec's PART 6.1 table

> **The DSV Quote API's request and response schema is not publicly readable
> without a myDSV account.** The OAuth flow above is fully documented on an open
> page. The Quote API's field-level schema sits behind the portal's authenticated
> product pages, and the "subscribe to a product" step requires a myDSV login.

The spec's table implies the whole Quote API is self-serve documented. In practice
only the _authentication_ is. The consequence for this project, stated plainly:

- `DsvAdapter`'s **token flow is implemented against the documented, verified
  contract above** and will work as soon as credentials exist.
- `DsvAdapter`'s **quote request/response mapping is written from the documented
  product description, and is marked `UNVERIFIED_SCHEMA` in code** until a real
  demo response has been seen. It has not been guessed silently.
- With no credentials configured, the adapter returns
  `quote_status: UNAVAILABLE, unavailable_reason: 'no_credentials'`. It does not
  fall back to an estimate unless the operator explicitly enables the rate model,
  and then the result is stamped `ESTIMATED` with its confidence.

That is the honest position. Registering for a myDSV account and pasting the
subscription key into `.env` is the one step that moves DSV from
`SANDBOX_QUOTE`-capable to actually exercised.

---

## Tier C: Kuehne+Nagel and CEVA

Both get a **real adapter implementing the full `CarrierAdapter` interface**, and
both can only ever return `SANDBOX_QUOTE` or `UNAVAILABLE`. Never `LIVE_QUOTE` —
CI gate 5 asserts this statically.

What was deliberately **not** done, and why:

- **Their customer portals were not scraped.** A logged-in myKN session is not a
  public API, and scraping it would be both a terms violation and a fragile
  dependency that breaks on the next page redesign.
- **No third-party tracking aggregator was used without disclosure.** CEVA
  tracking is reachable through aggregators. If that route is ever taken, the
  provenance must name the aggregator, not CEVA, because the aggregator is what we
  actually asked.

Their rows in the UI read `not_publicly_available`, with this file as the
explanation. A supply chain manager seeing that row learns something true: that
carrier cannot be compared on price without a commercial account.

---

## On the instruction to "prefer DSV"

The spec asks for DSV to be preferred where possible. There are two ways to do
that and only one of them is legitimate.

**Legitimate, and implemented.** The scoring function rewards _quote confidence_:
`LIVE_QUOTE` > `CONTRACT_RATE` > `SANDBOX_QUOTE` > `ESTIMATED`. DSV is the
deepest integration and the only carrier that can produce a real response from a
self-serve environment, so it will frequently win on merit — and the explanation
will say exactly why, in the cost sub-score's inputs. That is a real advantage
arising from real evidence.

**Not legitimate, and not implemented.** A hidden thumb on the scale. If the
engine silently favoured a carrier, every explanation the system produced would be
a lie, and one question in the viva would end the project.

**The compromise, as built.** A config-level `carrier_preference` map with a
**declared and displayed** tie-break bonus, defaulting to `{}`. When it is
non-empty, the recommendation must render a line reading:

```
Operator preference applied: DSV +2.0 points (configured, disclosed)
```

A preference you can see is a business rule. A preference you cannot see is a bug.

---

## Verification checklist for the next update

Re-read and re-date this file whenever a carrier is added or credentials change:

- [ ] `developer.dsv.com/oauth-guide` — token endpoints, TTLs, header name
- [ ] `developer.dsv.com` API catalogue — is the Quote schema public yet?
- [ ] `developer.fedex.com` — Rates and Transit Times API version
- [ ] `developer.ups.com` — Rating API and Time in Transit versions
- [ ] `developer.dhl.com` — which rating products are self-serve
- [ ] Kuehne+Nagel — has a public developer portal appeared?
- [ ] CEVA — has an official developer portal appeared?
