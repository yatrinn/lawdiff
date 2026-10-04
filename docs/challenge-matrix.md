# LawDiff — finaler Anforderungsabgleich

Stand: 4. Oktober 2026, finaler 89-Datensatz-Build. Dieser Bericht ersetzt den früheren Zwischenstand. Maßgeblich sind das gelieferte Teilnehmer-PDF v5, README, Originalschema und die T1–T5-Definitionen. Kein offizielles Scoring-Skript oder Entwicklungsschlüssel wurde mitgeliefert. Keine Halbzeit-Überraschungsregel wird behauptet.

## Tatsächlicher Stand

89 automatisch erzeugte, unverändert ausgewählte Datensätze aus 17 Quellen; 13 ausführbare Bedingungssätze und 76 Datensätze mit gesperrter, noch zu prüfender Coverage-Prosa. 89 primäre Zitatstellen sind exakt abgeglichen. Der Katalog enthält 110 Quellen-IDs und 73 verfügbare Texte; 21 Quellen sind erfolgreich verarbeitet, 37 ohne Text, 44 abgewiesen/zurückgehalten und 8 unbearbeitet. 475 von 500 Adressen haben eine Census-basierte Rechtsortzuordnung.

Die Herkunftslücke des früheren Builds ist geschlossen: `automatic-selection.json` benennt Originalartefakt, Hash, Quelle und unveränderte IDs. `promote-candidates.mjs` prüft die Auswahl, `assemble.mjs` rekonstruiert sie aus den Originalausgaben und `validate-artifacts.mjs` bindet diese an Katalog und Korpusbericht. Der Browser und alle drei Abgabe-JSONs verwenden genau dieses Paket. Es wird kein handgeschriebener O001-Statusdatensatz in das automatische Paket eingefügt. Die älteren assistierten Dateien dienen nur als historische Regressionseingaben.

## Pflichtanforderungen

| Anforderung | Nachweis / Stand | Bewertung |
|---|---|---|
| Automatisierte Extraktion, nachvollziehbar bis zu B/C | Aufgezeichnete Modellläufe → unveränderte Auswahl → gemeinsames Paket → 500 Lookups und Änderungen. Originale in `data/extracted/recorded-runs/`. | Mechanismus und Herkunft belegt; keine Vollkorpus-Abdeckung |
| Quellen, Ausnahmen, Daten und Status | Exakte Quellenstellen, Einschränkungen, Reviewnotizen und Laufdaten; 76 Prosa-Datensätze bleiben nicht ausführbar. | Teilweise; fachliche Abdeckung offen |
| Sechs Pflichtkategorien | Alle sechs sind vertreten; die Existenz eines Datensatzes belegt keine vollständige Kategorieabdeckung. | Strukturell vorhanden, inhaltlich unvollständig |
| Santa Ana auch ohne Sample-Adressen | 26 unveränderte Kandidaten aus vollständiger Verordnung plus separat gekennzeichneter Statusresolution; alle mit Ausführungsprüfung. | Quellenmaterial und Records vorhanden; Interpretation nicht abgeschlossen |
| Adresse, Datum, Zuständigkeit, Unsicherheit | 500 Originaladressen; 475 geografische Zuordnungen; eingeschränkte Bedingungen mit dreiwertiger Logik. | Implementiert; 25 Ortszuordnungen und weitere Fakten offen |
| Konfliktbehandlung | Gleichzeitige Anwendbarkeit und belegte Beziehungen erforderlich; keine erfundenen automatischen Vorränge. | Mechanismus vorhanden; T3-Beziehungsnachweis unvollständig |
| Abgabeformat | Drei JSON-Dateien in den gelieferten Vorlagen; IDs, Quellbezüge und erneute Berechnung geprüft. | Erfüllt für Dateiform und Konsistenz |
| Einseitige Methodennotiz | `submission/method-note.pdf`, gleiche Zahlen und Grenzen. | Vorhanden |
| Pipeline in Demonstration | Demo endet mit echter Herkunftsansicht; Technikvideo erklärt dieselbe Auswahl und Engine. | Aufgezeichneter Nachweis, kein Live-Modelllauf |
| Öffentliche Demo / Repo / MIT-Code | Veröffentlichtes statisches Projekt mit reproduzierbarem Build; Quellen behalten eigene Rechte. | Technisch vorbereitet; Veröffentlichung separat prüfen |
| Drei ≤60-s-Videos und echtes Foto | Demo und Technik je 56 s, eingebrannte englische Erklärung; persönliche Teamaufnahme und Foto von Yannik nötig. | Persönliche Bestandteile offen |
| HackOS und zusätzlich Google Form | Anleitung, Links und Paket vorhanden. | Keine Einreichung vorgenommen |

## Tatsächliche Änderungsfälle

`submission/change-case-review.json` ist ein qualitativer Vergleich mit den Veranstaltererwartungen, kein Juryscore.

| Fall | Tatsächliches Ergebnis | Urteil |
|---|---|---|
| T1 California | 250 nach Datum im Anwendungsbereich; vorher noch nicht wirksam. | PASS |
| T2 Hoboken / Jersey City | 0 bestätigt, 93 ungeklärt; sowohl materielle Fakten als auch teilweise Rechtsort fehlen. Keine Ausdehnung auf belegtes Newark. | PARTIAL |
| T3 NJ FAIR Act | Vorher 140 künftig; danach 140 ungeklärt. Primärwohnsitz/institutionelle Ausnahmen fehlen. Keine belegten operativen Konflikte. | PARTIAL |
| T4 MA-Vorhaben | 110 potenziell betroffene Adressen; beide Gesetzestexte bleiben pending, keine aktive Pflicht. | PASS |
| T5 gescheiterter Vorschlag | Keine neue Mietgrenze. Automatisch extrahierter Failed-Status fehlt; leere Ausgabe ist kein allgemeiner Negativnachweis. | PARTIAL |

## Aussagegrenzen

Ein exakt gefundenes Zitat validiert keine Rechtsauslegung. Modellläufe oder Quellenzahlen sind keine Genauigkeitsquote. Abgewiesene Batch-Ausgaben bleiben abgewiesen; ihre früheren Zwischenkandidaten werden nicht als erfolgreiche Abdeckung wiederhergestellt. Die sichtbaren 89 Datensätze sind keine 89 unabhängig juristisch geprüften Gesetze. Die Anwendung ist ein belegbarer Teilprototyp und erfüllt nicht nachweislich sämtliche inhaltlichen Pflichten vollständig. Gewinnchance, Neuheit und Marktpreis sind nicht gemessen.
