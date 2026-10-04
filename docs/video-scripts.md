# LawDiff · fertige Videos und persönliche Aufnahme

**Finaler Build vom 4. Oktober 2026.** Demo und Technik sind jeweils **56 Sekunden**, 1920 × 1080, 30 fps, H.264, **ohne Ton**. Die englischen Erklärungen sind eingebrannt; SRTs liegen bei. Eine optionale Sprachaufnahme ist noch nicht enthalten. Das Teamvideo ist von Yannik persönlich aufzunehmen.

## Fakten, die in allen Aufnahmen gelten

89 unverändert ausgewählte automatische Datensätze aus 17 Quellen. Davon 13 mit ausführbarer Coverage und 76 mit noch nicht ausführbarer Coverage-Prosa. 89 exakt geprüfte primäre Zitate. 110 Quellen-IDs / 73 vorhandene Texte; 21 erfolgreich verarbeitet, 37 ohne Text, 44 abgewiesen oder zurückgehalten, 8 unbearbeitet. 475/500 geografische Zuordnungen. **93 JavaScript-Tests und 10 Geografie-Tests**, kein offizieller Juryscore. T1 und T4 erfüllen die qualitative Erwartung; T2, T3 und T5 bleiben teilweise offen. Keine unabhängige Rechtsprüfung, Vollabdeckung, Kunden oder gemessene Einsparung behaupten.

## 1. Demo · 56 Sekunden

Datei `media/lawdiff-demo.mp4`. Sieben echte Interface-Standbilder in sechs Kapiteln. Kennzeichnung: **Actual interface captures · edited walkthrough**. Keine kontinuierliche Bildschirmaufnahme, nachgestellten Klicks, generierten UI-Bilder oder Tonspur. Ablauf: Änderung → Adresse → Originalquelle → Prüfliste → CSV → Herkunftskette.

| Zeit | Bild | Englischer Text |
|---|---|---|
| 00–08 s | T3 vor Datum; Originalsample. | A new housing law lands on your desk. Which buildings need your attention? This is LawDiff. |
| 08–17 s | T3 nach Datum: 140 Adressen benötigen Scope-Fakten. | Move New Jersey’s FAIR Act past its effective date. The workspace reveals where missing property facts need a closer look. |
| 17–27 s | A0002 mit zugehöriger NJ-Regel (4 s), anschließend D069-Originaltext (6 s). | Open one address. See the requirement, its timing, and the original passage behind the interpretation. |
| 27–37 s | Review Brief mit offenen Fakten und nächstem Prüfschritt. | Now turn that finding into a review brief. Listed addresses get their status, source, and next check. |
| 37–47 s | Echte Oberfläche nach CSV-Download; keine künstliche Tabellenansicht. | Export the list for your compliance team: original address data, source wording, and what to review next. |
| 47–56 s | Integrity: automatische Extraktion, unveränderte Auswahl, gemeinsame Engine. | Rules extracted automatically. Selected records unchanged. One traceable pack powers the workspace and submission. Inspect the chain. |

Der eingebrannte Text enthält **102 Wörter**. Er kann unverändert für ein optionales Voiceover verwendet werden; jedes Segment zeitlich einüben. Die sichtbaren 140 NJ-Adressen benötigen nach Datum fehlende Gebäudefakten. Sie werden nicht als bestätigte Rechtsverstöße oder vollständig in Scope bezeichnet. Die Quellenansicht macht die Interpretation überprüfbar; der Export bleibt auf Originaldaten beschränkt.

## 2. Technik · 56 Sekunden

Datei `media/lawdiff-tech.mp4`. Sechs gestaltete Erklärgrafiken. Kein API-Mitschnitt oder vorgetäuschter Live-Lauf. Der Renderer validiert den gleichen eingefrorenen Datenbestand wie der Build und führt die Tests aus.

| Zeit | Bild | Englischer Text |
|---|---|---|
| 00–09 s | Dieselbe automatische Quelle→Auswahl→Adresse-Kette. 21/110 Quellen verarbeitet, 89 ausgewählte Records. | Recorded model calls extract candidates; source review selects unchanged records. One selected pack drives the workspace and all 500 submitted address lookups. |
| 09–18 s | Hash und exakte Originalpassage; 89 primäre Zitatstellen. | Captured files carry hashes. Primary and supplemental quotations must occur verbatim in their referenced source texts. |
| 18–28 s | Eine Engine für Browser und Exporte, kein Laufzeit-Modellaufruf. | One JavaScript engine serves browser answers and submission exports. It evaluates a restricted rule language. Runtime makes no model calls. |
| 28–38 s | Wahr/falsch/unbekannt, Datum und Pending-Status. | Missing evidence remains unknown unless another condition decides it. Calendar checks distinguish effective dates from pending proposals. |
| 38–48 s | 93 JavaScript- und 10 Geografie-Tests im geprüften Build. | Regression tests challenge source tampering, jurisdiction mismatches, malformed conditions, calendar boundaries and geographic provenance. |
| 48–56 s | 475 Ortszuordnungen, 25 offen; Grenzen des Zitatabgleichs. | 475 sample addresses have matched legal cities; 25 remain unresolved. Exact quotations support review. They do not prove legal interpretation. |

Die Diagramme zeigen aufgezeichnete Ergebnisse. Modellentwicklung und Extraktion sind von der modellfreien Laufzeitauswertung zu unterscheiden. Der frühere Zwei-Quellen-Versuch bleibt als historisches Audit erhalten, ist aber nicht die Herkunft des aktuellen Pakets. Der alternative Anthropic-Compiler wurde nicht live ausgeführt.

## 3. Team · Aufnahme durch Yannik, Ziel 56 Sekunden

**Status:** Noch aufzunehmen. Yannik spricht selbst. Kamera auf Augenhöhe, ruhiger Hintergrund, Tageslicht oder weiches Licht von vorn. Vorab zehn Sekunden Tonprobe; Telefon und Benachrichtigungen stumm. Ein Namensschild **“Yannik Trinn · Solo participant”** reicht. Keine Organisationslogos und keine Behauptung einer Unterstützung durch Studieren ohne Grenzen.

### Sprechtext und genaue Regie

| Zeit | Bild | Englischer Sprechtext |
|---|---|---|
| 00:00–00:08 | Direkt in die Kamera; Name kurz einblenden. | I’m Yannik Trinn, and I’m competing solo. LawDiff is my independent entry in this hackathon. |
| 00:08–00:19 | Gleiche Einstellung, ohne Reisebilder oder zusätzliche Titel. | I serve on the national board of Studieren ohne Grenzen, which supports access to higher education in the Global South. |
| 00:19–00:31 | Ruhig weiterreden; eigene Rolle klar benennen. | I worked with AI agents on product planning, code, extraction and tests. I am responsible for the project I submit. |
| 00:31–00:44 | Blick zur Kamera; beim Wort „missing“ eine kurze Pause. | I want a reviewer to see what supports an answer and what is missing. A useful interface should make that question easier to resolve. |
| 00:44–00:56 | Ruhiger Abschluss, letzte Sekunde stehen lassen. | LawDiff is a prototype. My next step is expert review and a focused pilot with people who do this work. |

Der Text enthält ungefähr 100 Wörter. Die genannten biografischen Fakten stammen von Yannik: Name, Solo-Teilnahme und Bundesvorstandstätigkeit. Motivation und nächster Schritt sind als persönliche Aussage vor der Aufnahme gegenzulesen. Wenn sie nicht passen, werden sie geändert. Keine unbestätigten Abschlüsse, Arbeitgeber, Hochschulen, früheren Kunden oder fachlichen Zulassungen ergänzen.

Drei vollständige Takes aufnehmen. Den klarsten, natürlichsten auswählen, nicht den schnellsten. Ziel 55–58 Sekunden einschließlich Anfang und Ende. Erst die tatsächlich exportierte Aufnahme heißt `lawdiff-team.mp4`. Englische Untertitel nach dem aufgenommenen Wortlaut erstellen. Ein authentisches Teamfoto bleibt zusätzlich erforderlich.


## Vor dem Upload

1. Persönliches Teamvideo und echtes Foto ergänzen.
2. Jeden endgültigen Film vollständig ansehen; höchstens 60 Sekunden.
3. Bei optionalem Voiceover Dauer und Untertitel mit dem wirklich gesprochenen Wortlaut abgleichen.
4. Keine alten Zahlen aus früheren Builds verwenden. Die Demo zeigt keine neue Extraktion in Echtzeit.
5. Öffentliche Links ohne Anmeldung prüfen. Die MP4-Dateien für Formular-Uploads bereithalten.
6. HackOS **und** Google Form abschließen, beide Bestätigungen sichern.
