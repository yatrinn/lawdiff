# LawDiff · Finale: drei Minuten, zwei Folien

Die bereitgestellten Eventangaben nennen den **10. Oktober 2026** für das Finale. Dieser Ablauf ist für den Fall einer Einladung vorbereitet. Er ersetzt keine spätere offizielle Terminbestätigung.

**Ziel des Pitches:** Die Jury erinnert sich an einen konkreten Ablauf: Eine Änderung wirkt auf Adressen; eine offene Bedingung wird sichtbar; ein Beleg löst genau diese Bedingung. Der Geschäftsvorschlag folgt aus derselben Arbeit, die die Demo zeigt.

## Ablauf und zwei Folien

| Zeit | Inhalt | Medium |
|---|---|---|
| 0:00–0:20 | Das konkrete Arbeitsproblem | Folie 1 |
| 0:20–1:30 | NJ-Datumswechsel, Quelle, separater LA-Grenzfall und Rights card | Anwendung |
| 1:30–2:05 | Architektur, Prüfungen und tatsächliche Grenzen | Anwendung/Integrity |
| 2:05–2:40 | Käuferhypothese und Pilot | Folie 2 |
| 2:40–3:00 | Nächster überprüfbarer Schritt und Abschluss | Folie 2 |

### Folie 1 — One law changes. What follows?

Sehr wenig Text. Links ein Quellenausschnitt, in der Mitte das Adressfeld, rechts eine offene Belegfrage. Darunter nur:

**Change → Address → Source → Missing evidence**

Die Abbildungen stammen aus der echten Anwendung. Keine erfundenen Kundenzahlen oder Milliardenmarktgrafik. Der eigentliche Wow-Moment passiert live.

### Folie 2 — A review workflow inside property software

Drei kurze Zeilen:

- **Buyer hypothesis:** Compliance teams and property-software providers.
- **First paid scope:** Reviewed changes for a limited set of jurisdictions and portfolios.
- **Next proof:** Expert-reviewed accuracy, workflow usefulness, and willingness to pay.

Unterzeile: **Proposed pilot — no customer or pricing validation claimed.**

Geschäftsmodell als Vorschlag erläutern: wiederkehrende Gebühr für überwachte Portfolios/Gebiete plus Schnittstellennutzung. Noch keinen Preis als getestet präsentieren. RealPage ist ein möglicher Gesprächspartner, kein bereits gewonnener Kunde.

## Englischer Sprechtext

A housing rule changes. Someone then has to connect a legal text to a portfolio: which buildings matter, which date matters, and which facts are missing? LawDiff brings that review into one workspace.

Each mark is one address in the supplied sample. Here is New Jersey’s FAIR Act. It has been enacted, but on this date it is not yet effective. Move to July 2027. The extracted statewide rule now covers the 140 New Jersey addresses. That means the rule belongs in their review, not that any owner has violated it. The original passage stays one click away.

Now a separate Los Angeles case. This building was constructed in 1978. The year alone cannot establish the exact occupancy-date condition. LawDiff shows the condition and the missing evidence together. I add a hypothetical date, visibly labeled as a simulation. That branch resolves. Other exemption questions remain unknown. The rights card shares the original-data answer and sources, while keeping my simulation out of the shared result.

The technical foundation separates interpretation from execution. Codex extracted structured candidates from supplied source text. A shared engine runs the same conditions in the browser and the submission exports. Source checks and targeted tests catch specific errors; they do not certify the legal interpretation. Missing sources and unresolved geographic matches stay visible. We report internal test results without inventing an official score.

Our buyer hypothesis is a compliance team or property-software provider handling buildings across multiple jurisdictions. The first commercial scope would be narrow: reviewed changes for a defined portfolio, delivered as an integration and a review queue. We have not yet validated customer demand or pricing.

The next milestone is an expert-reviewed pilot. We would measure missed applicable rules, unsupported conclusions, time needed to resolve an open case, and whether the customer would pay for the workflow. Expansion comes after that evidence.

LawDiff makes one promise you can inspect: see the change, follow the source, and understand what is still missing.

## Live-Demo vorbereiten

1. Eingereichte Version und stabile öffentliche URL öffnen; benötigte Daten vorab laden.
2. Vorher-Zustand von T3 und die Quelle D069 vorbereiten.
3. Rechtsortnachweis von A0107 prüfen. Die LA-Sequenz setzt den echten Nachweis voraus.
4. Alte lokale Simulationen entfernen. Hypothetischen Tag als Simulation eingeben, keine Originalunterlage behaupten.
5. Rights card zeigt Originaldaten; dies bewusst benennen.
6. Integrity zeigt den tatsächlich vorhandenen Stand. Keine Zahl spontan aus Erinnerung nennen.
7. Dreimal mit Stoppuhr proben. Ziel: 2:45–2:55 einschließlich Bedienung.

Bei Netzproblemen kann eine vorab aufgenommene, klar als Aufnahme bezeichnete Demo derselben Version abgespielt werden. Ein Video wird nicht als Live-Lauf bezeichnet. Falls keine Zeit für beide Beispiele bleibt, die Quelle und den Unsicherheitsfall priorisieren und den Introtext kürzen.

## Antworten auf wahrscheinliche Juryfragen

**Is this just another legal chatbot?**
The primary interaction is a change review tied to addresses. A restricted engine evaluates explicit conditions; the user can inspect source evidence and the exact facts still needed. We would compare its usefulness with existing tools in a pilot.

**What if the model extracts the wrong rule?**
That remains a real risk. Quotation matching and structural checks catch some errors, not every interpretation error. We retain the source and review notes, expose uncertainty, and would require expert review before a production deployment.

**Did you run a fully automated API extraction?**
The public pack is labeled Codex-assisted extraction. A separate automated Codex CLI extraction run is published with source hashes, model, timing, candidate output and unresolved review items. It is a pipeline demonstration, not a claim that the original 58 records came from that batch.

**Why are so many results unknown?**
Some decisions require facts absent from the sample. Unknown identifies the missing evidence. It does not replace a known negative: when a necessary condition is false, the engine excludes the rule even if other facts are missing.

**Did you pass every organizer test?**
The current package contains no official scoring script or answer key. We report internal checks and the actual T1–T5 outputs. Any incomplete source or boundary case is identified rather than described as passed.

Die lokalen Quellen für Hoboken und Jersey City sind inzwischen enthalten. Bei dieser Antwort deshalb keine weiterhin fehlende T2-Quelle behaupten; die verbleibende Einschränkung ist die tatsächliche geografische Auflösung und Prüfung einzelner Adressen. Den O001-Nachweis zum fehlgeschlagenen Vorschlag als Veranstalterangabe benennen.

**Why can’t a property-software company build this itself?**
It can. Our commercial hypothesis depends on maintaining reviewed coverage, reliable updates, useful integrations and an auditable correction history. The prototype does not establish a defensible business by itself.

**Who pays, and how much?**
The proposed buyer is a property-compliance team or software provider. A portfolio or jurisdiction subscription with API usage is a pricing hypothesis. We would test willingness to pay before treating it as revenue evidence.

**Does the rights card certify a tenant’s legal rights?**
No. It shares the prototype’s source-linked result from original sample data. Uncertainty and the date remain visible, and local simulations are excluded. Spanish text is an assisted translation.

**Did Studieren ohne Grenzen validate or endorse this?**
This is my independent hackathon entry. My board role is personal background; it is not evidence of organizational endorsement or a product pilot.

**What happens next?**
A small, expert-reviewed pilot in a defined jurisdiction set. We would verify coverage and errors, observe the review workflow, and test whether a potential buyer values it enough to adopt it.
