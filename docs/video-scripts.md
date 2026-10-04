# LawDiff · fertige Videos und persönliche Aufnahme

Demo und Technik dauern jeweils **56 Sekunden**, 1920 × 1080, 30 fps, H.264, mit **englischer synthetischer Narration und AAC-Tonspur**. Die Stimme **Leslie** ist eine synthetische Vorgabe von Runway / Eleven Multilingual v2, kein Stimmklon. Beide Filme kennzeichnen die synthetische Narration im Bild; sie geben die Stimme nicht als Yannik aus. Englische Erklärungen sind eingebrannt, passende SRTs liegen bei. Das Teamvideo nimmt Yannik persönlich mit eigener Stimme auf.

## Fakten, die in allen Aufnahmen gelten

133 automatisch erzeugte, unverändert ausgewählte Datensätze aus 24 Quellen; 22 ausführbare Bedingungssätze und 111 Datensätze mit gesperrter, noch zu prüfender Coverage-Prosa. 133 primäre Zitatstellen sind exakt abgeglichen. Der Katalog enthält 110 Quellen-IDs und 73 verfügbare Texte; 28 Quellen sind erfolgreich verarbeitet, 37 ohne Text, 38 abgewiesen/zurückgehalten und 7 unbearbeitet. 491 von 500 Adressen haben eine Census-basierte Rechtsortzuordnung: 481 mit einzelner Adressinterpolation, 10 durch übereinstimmende amtliche Rechtsortbelege ohne ausgewählte Einzelkoordinate. 9 Zuordnungen bleiben offen. **95 JavaScript-Tests und 15 Geografie-Tests bestanden**; der eingefrorene Technik-Snapshot dokumentiert den Lauf. T1 und T4 erfüllen die qualitative Erwartung; T2, T3 und T5 bleiben teilweise offen. Keine offizielle Genauigkeit, unabhängige Rechtsprüfung, Vollabdeckung, Kunden oder gemessene Einsparung behaupten.

## 1. Demo · 56 Sekunden

Datei `media/lawdiff-demo.mp4`. Sieben echte Interface-Standbilder in sechs Kapiteln. Kennzeichnung: **Actual interface captures · edited walkthrough** und **Synthetic narration**. Keine kontinuierliche Bildschirmaufnahme, nachgestellten Klicks oder generierten UI-Bilder. Ablauf: Änderung → Adresse → Originalquelle → Prüfliste → CSV → Herkunftskette.

| Zeit | Bild | Englische Narration und Untertitel |
|---|---|---|
| 00–08 s | T3 vor dem Wirksamkeitsdatum; Originalsample. | A new housing law lands on your desk. Which buildings need your attention? This is LawDiff. |
| 08–17 s | T3 nach dem Datum; fehlende Fakten zum Anwendungsbereich bleiben sichtbar. | Move New Jersey’s FAIR Act past its effective date. The workspace reveals where missing property facts need a closer look. |
| 17–27 s | Eine Adresse mit zugehöriger NJ-Regel (4 s), anschließend Originaltext D069 (6 s). | Open one address. See the requirement, its timing, and the original passage behind the interpretation. |
| 27–37 s | Review Brief mit offenen Fakten und nächstem Prüfschritt. | Now turn that finding into a review brief. Listed addresses get their status, source, and next check. |
| 37–47 s | Echte Oberfläche nach dem CSV-Download; keine nachgebaute Tabellenansicht. | Export the list for your compliance team: original address data, source wording, and what to review next. |
| 47–56 s | Integrity: automatische Extraktion, unveränderte Auswahl, gemeinsame Engine. | Rules extracted automatically. Selected records unchanged. One traceable pack powers the workspace and submission. Inspect the chain. |

Der Sprechtext enthält **102 Wörter**. Tatsächlich verwendete Audiosegmente, Text, Kapitelzeiten und Hashes stehen in `media/narration/demo.json`. Fehlende Gebäudefakten bleiben sichtbar; die Demo behauptet weder bestätigte Rechtsverstöße noch vollständige Anwendbarkeit. Die Quellenansicht unterstützt die Prüfung einer Interpretation, der Export bleibt auf Originaldaten beschränkt.

## 2. Technik · 56 Sekunden

Datei `media/lawdiff-tech.mp4`. Sechs gestaltete Erklärgrafiken mit synthetischer englischer Narration. Kein API-Mitschnitt oder vorgetäuschter Live-Lauf. Der Bildrenderer validiert den eingefrorenen Datenbestand und führt die Tests aus; danach wird die gespeicherte Narration hinzugefügt.

| Zeit | Bild | Englische Narration und Untertitel |
|---|---|---|
| 00–12 s | Aufgezeichnete Extraktion → unveränderte Auswahl → Adressauswertung. | Recorded model calls extract rule candidates. Source review selects unchanged records. One selected pack drives the workspace and all five hundred submitted address lookups. |
| 12–19 s | Quellenhash und exakte Originalpassage. | Captured files carry hashes. Source quotations must occur verbatim in their referenced text. |
| 19–29 s | Eine Engine für Browser und Exporte. | One JavaScript engine serves browser answers and submission exports. It evaluates explicit conditions, without model calls at query time. |
| 29–38 s | Wahr, falsch und unbekannt; Wirksamkeit und Pending-Status. | Missing evidence remains unknown unless another condition decides it. Calendar checks distinguish effective laws from pending proposals. |
| 38–45 s | Tatsächlich bestandene Regressionstests des eingefrorenen Builds. | Regression tests cover source tampering, jurisdiction mismatches, missing facts and calendar boundaries. |
| 45–56 s | Amtliche geografische Belege, ungeklärte Zuordnungen und Grenzen der Auslegung. | Official geographic evidence identifies legal cities. Unresolved addresses stay visible. Exact quotations support review, but do not prove legal interpretation. |

`media/narration/tech.json` ist die Quelle für den gesprochenen Wortlaut und die Kapitelzeiten. Die Diagramme zeigen aufgezeichnete Ergebnisse. Automatische Extraktion ist von der modellfreien Laufzeitauswertung zu unterscheiden. Der frühere Zwei-Quellen-Versuch bleibt historisches Auditmaterial und ist nicht die Herkunft des aktuellen Pakets. Der alternative Anthropic-Compiler wurde nicht live ausgeführt.

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

Drei vollständige Takes aufnehmen. Den klarsten, natürlichsten auswählen, nicht den schnellsten. Ziel 55–58 Sekunden einschließlich Anfang und Ende. In QuickTime mit **Ablage → Sichern** als `lawdiff-team.mov` speichern. Ein tatsächlich als MP4 exportierter Film darf `lawdiff-team.mp4` heißen; das bloße Umbenennen der Dateiendung konvertiert keine Datei. Englische Untertitel nach dem aufgenommenen Wortlaut erstellen. Ein authentisches Teamfoto bleibt zusätzlich erforderlich.


## Vor dem Upload

1. Persönliches Teamvideo und echtes Foto ergänzen. Die separate lokale Klickanleitung `LawDiff-Jetzt-einreichen.html` führt durch Aufnahme, Freigabe und beide Formulare.
2. Jeden endgültigen Film vollständig ansehen **und anhören**; höchstens 60 Sekunden je Film. Ton, Satzenden und Untertitel prüfen.
3. Für Demo und Technik die fertigen vertonten MP4s verwenden, nicht ältere stumme Zwischenstände. Nach einem neuen Bildrender muss die Narration erneut hinzugefügt werden.
4. Keine alten Zahlen aus früheren Builds verwenden. Die Demo zeigt keine neue Extraktion in Echtzeit.
5. Öffentliche Links ohne Anmeldung prüfen. Die tatsächlichen Videodateien für die Google-Form-Uploads bereithalten.
6. HackOS **und** Google Form abschließen, beide Bestätigungen sichern. Noch wurde keine dieser Einreichungen vorgenommen.
