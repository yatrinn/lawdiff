# LawDiff — release verification, October 4, 2026

This is a bounded technical and artifact review, not independent legal validation, exhaustive security certification or an official jury score. The final snapshot contains 133 unchanged automatic records from 24 sources; 22 have executable coverage and 111 require interpretation review.

## Verified release behavior

- **98 JavaScript tests pass**, with no failures, skips or cancelled tests. They cover the engine, original-data exports, condition/date/jurisdiction failures, narrative-coverage gating, strict compiler events, exact quotations, selection and corpus hash integrity, the review handoff, and delayed/failed/invalid startup data.
- **15 geography tests pass**. The sample contains 500 unique addresses; 491 have recorded legal-city matches and 9 remain unresolved. The 491 matches comprise 481 individual address interpolations and 10 legal-jurisdiction consensus records without a selected coordinate. Match counts are not measured geographic or legal accuracy.
- All **133 submitted records pass the supplied Draft 2020-12 rule schema**, rerun for this freeze with zero schema errors. All 133 primary quotations occur verbatim in the identified captured source; this does not establish their interpretation.
- The three submission JSONs are generated from the same selected pack. Browser evidence and simulations are excluded. The audit now includes the selected provenance, assembly, source reviews and no-rule findings; the earlier two-source test is explicitly historical.
- The final archive contains **44 recorded public runs**. At 13:46 Europe/Berlin, an isolated copy of the current release restored all 44 runs, passed all 98 JavaScript and 15 geography tests, and built the same 133-record / 491-city snapshot. It contained no private caches, starter downloads, environment files or prebuilt output, and used no network, model calls or credentials. Build/hosting commands restore the pinned archive before validation.
- The actual qualitative scenario report gives **T1 PASS, T2 PARTIAL, T3 PARTIAL, T4 PASS, T5 PARTIAL**. It retains missing facts and missing conflict/status evidence rather than counting these as correct answers.

## Browser checks

Desktop at 1440 × 1000: T3 before/after, the correct rule preserved when opening an address, original-source modal, 140-address review brief, real CSV-download action and automatic provenance card. The selected rule is visible first in the address list. The app explicitly displays missing primary-residence and institutional-use evidence instead of claiming confirmed scope.

Mobile at 390 × 844: light/dark appearances, pending and failed change cases, selected horizontal navigation, address view, English/Spanish rights card and QR. The document width remained 390px. The selected case is kept visible after rerendering. The source and rights dialogs are scrollable at this width. Translation is not independently reviewed.

## Media and documents

FFprobe verified both final MP4 files at 56 seconds, 1920 × 1080, H.264 and 1,680 video frames, with an AAC audio stream. The render rate is 30 fps. Both films disclose their English synthetic narration in the picture: Leslie preset, generated through Runway with Eleven Multilingual v2, without voice cloning. The recorded chapter texts and audio hashes are in `media/narration/demo.json` and `tech.json`. Demo chapters are 8/9/10/10/10/9 seconds; technical chapters are 12/7/10/9/7/11 seconds. The demo identifies its real UI stills as an edited walkthrough. The technical picture renderer validates the frozen artifacts and reruns both test suites; a separate narration step verifies the audio inputs and final encoding. A render receipt is not a substitute for viewing and listening to the final files. No live model-run footage is claimed.

The one-page method PDF was rendered and visually reviewed. The two-slide editable PowerPoint passed structural, layout, font-policy and embedded-chart checks and was reimported/rendered. Its matching PDF was generated from those final rendered slides. Native Microsoft PowerPoint execution was not tested. Counts, missing-fact states and buyer hypotheses agree with the shipped pack.

## Fixed during this review

Data-dependent controls stay disabled until both startup files validate. Navigation, search shortcuts and import handlers also reject early events; failed loads retain a usable retry. The final browser check reproduced an eight-second collection load, observed disabled controls while loading, then successfully opened Integrity with no console errors. Three regression tests cover the actual application module under delayed, failed and invalid-data responses.

Source/jurisdiction substitution and mixed condition-tree bypasses are rejected. Narrative extraction cannot be silently treated as executable logic. Original automatic records cannot be edited or selected from differing runs without invalidating pinned provenance. CSV text neutralizes spreadsheet formulas. Advancing time cannot activate a pending bill. Source capture scope and historical pipeline provenance stay explicit. The application preserves the selected change when opening its example address and preserves the active case in mobile navigation.

## Remaining limits

The 110-source catalog contains 73 texts. The final corpus receipt counts 28 successfully processed, 37 text-missing, 38 rejected/withheld and 7 unprocessed sources. Failed batch outputs remain withheld; intermediate candidates are not promoted. Coverage, penalties, state/local interactions and property facts are not complete. Automatic provenance is a completed mechanism, not proof of complete legal coverage. A qualified review and a measured customer pilot remain necessary.

Yannik's authentic team video and photograph, and both final hackathon submissions, remain outstanding. The repository/hosting publication and anonymous links are checked separately after deployment. Do not infer an event submission from a Git commit or deployment.
