# LawDiff — Method note

**RealPage Rental Housing Law Navigator · Hack-Nation 7 · Yannik Trinn, solo**
Repository: `[[PUBLIC_REPOSITORY_URL]]` · Demo: `[[PUBLIC_DEMO_URL]]`

**Scope.** LawDiff evaluates source-grounded rule candidates against the supplied 500-address sample across California, New Jersey and Massachusetts. The default query date is 2026-10-01. The interface connects a change, its address-level effects, the supporting passage and any missing evidence. It is a research prototype, not legal advice or a compliance certification.

**Sources and extraction.** The supplied manifest contains 87 records; acquired local sources and organizer metadata supplement it. Missing, redirected and draft material remain visible. The public legal-rule candidates are labeled `codex_assisted_extraction`, not an external API batch or independent legal review. The failed-proposal record cites organizer source O001 and is labeled `organizer_test_status`, not independently verified court evidence. A separate API compiler creates reviewable candidates; implementation or dry-run output does not establish a completed extraction. Records retain source identity, exact quotations and condition evidence.

**Execution.** A shared deterministic engine powers browser results and exports. Its restricted condition language uses true, false and unknown; a decisive false prerequisite can exclude a rule despite other missing facts. Geographic evidence determines legal city. Postal labels do not establish municipal jurisdiction. Effective and end dates are distinct. Pending and failed proposals cannot become active through date selection alone. User-entered evidence and hypothetical simulations remain separate from original sample data and are excluded from the sample export and shared original-data rights card.

**Validation.** Checks cover required structure, exact primary and supplemental quotations, calendar dates, restricted operators, jurisdiction handling, conditional uncertainty and temporal boundaries. Tests also mutate evidence to verify rejection. A source match demonstrates quotation presence, not correct interpretation. Internal results are reported separately from organizer scoring; the supplied participant v5 package contains no `score.py` or answer key.

**Changes.** Exports address T1–T5: California commencement, Hoboken/Jersey City boundaries, future NJ FAIR Act with possible municipal interaction, pending Massachusetts bills and the struck proposal. Both T2 local sources are now captured; unresolved geographic matches remain separate. Organizer-derived dates and negative findings are labeled. An empty result is not proof that no law exists. There is no surprise-document claim.

**Build snapshot, October 3, 2026.** 58 rule/status records; 91 source records; 54 captured texts; 152 verified quotation spans; 475/500 geographic matches. Counts describe this build and may change after documented acquisition or correction. They are not accuracy percentages.

**Limits and next step.** Owner facts, some unit counts and construction years, exact occupancy certificates, legal interpretations and parts of source coverage remain unresolved. Spanish summaries are unreviewed machine translations. Historical comparisons reuse supplied building facts, not reconstructed historical records. Production use requires expert interpretation review, verified geographic coverage and maintained source updates. A proposed pilot and buyer hypothesis are not existing customers or validated market demand.
