# LawDiff · Drei Videos, jeweils unter 60 Sekunden

Regiehinweise sind deutsch; nur die englischen Sprechtexte werden gesprochen. Ruhiges Tempo, verständliche Aussprache, kurze Pausen. **105–125 Wörter sind ein Zielbereich, keine Dauergarantie:** jede fertige Aufnahme messen und auf 55–58 Sekunden bringen. Keine Musik unter den technischen Erklärungen nötig. Bildschirm gut lesbar, Maus ruhig, unnötige Browserleisten verborgen; Datum und Prototyp-Hinweis bleiben erkennbar.

## 1. Demo

**Vorbereitung:** Öffentliche Demo, T3 „New Jersey FAIR Act“, Ausgangsdatum 2026-10-01. Frische lokale Daten ohne alte Simulationen. Rechtliche Stadtzuordnung für A0107 prüfen. Den hypothetischen Zertifikatstag **1978-09-30** und die Kennzeichnung **Simulation — hypothetical certificate date** vorbereiten. Keine echte Bescheinigung behaupten.

### Sprechtext

One law changes. Which buildings need attention? This is LawDiff. Each mark represents one address in the supplied sample. New Jersey’s FAIR Act is enacted, but it is not yet effective on this date. Move to July 2027: its extracted statewide rule now covers the 140 New Jersey addresses. Open the original source to see where the requirement comes from. Now a separate Los Angeles case: the building year alone cannot answer an occupancy-date condition. I add a clearly labeled hypothetical date. That branch resolves; other exemption questions stay unresolved. Finally, the rights card shares the original-data result and its sources, without exporting my simulation. See what changed. See what is missing.

### Bildregie

| Zeit | Aktion |
|---|---|
| 0–7 s | T3 und gesamtes Adressfeld zeigen; keine Startfolie |
| 7–18 s | Von „Before“ zu „After“ wechseln; Datum und Statusänderung lesbar halten |
| 18–26 s | Originalquelle D069 öffnen; relevante Passage zeigen |
| 26–34 s | Zum Los-Angeles-Grenzfall A0107 wechseln; Jahr 1978 und fehlenden Zertifikatstag zeigen |
| 34–46 s | Hypothetischen Tag als Simulation hinzufügen; nur die aufgelöste Datumsbedingung hervorheben |
| 46–55 s | Rights card öffnen; Originaldaten-Kennzeichnung und Quellen sichtbar halten |
| 55–58 s | Ruhiges Schlussbild der Anwendung mit LawDiff |

**Freigabebedingung:** Die 140 müssen in der aufgenommenen Version tatsächlich sichtbar sein. Die LA-Demo setzt einen belegten Rechtsort voraus. Falls der lokale Fall noch nicht funktioniert, keine Szene nachstellen: Die Aufnahme wird angepasst oder erst nach der Korrektur erstellt.

**Aktualisierung des Aufnahmeplans:** Im geprüften Zwischenstand vom 3. Oktober sind 475 von 500 Adressen geografisch zugeordnet; **A0107 ist jetzt als City of Los Angeles aufgelöst**. Den gespeicherten Ortsnachweis unmittelbar vor der Aufnahme nochmals prüfen. Die beiden T2-Ortsgesetze sind mit ergänzten Quellen enthalten. Veränderungen der Trefferzahlen sind kein Anlass, die Sprechtexte um spontane Genauigkeitsbehauptungen zu erweitern. Ein geografischer Treffer bestätigt nicht die rechtliche Interpretation oder den simulierten Zertifikatstag.

## 2. Technik

**Vorbereitung:** Das tatsächliche Extraktionsaudit, einen echten Regelkandidaten samt Quelltext und die echte Testausgabe öffnen. Keine Modellkonsole oder Fortschrittsanzeige für einen nicht stattgefundenen API-Lauf nachbauen.

### Sprechtext

LawDiff separates interpretation from execution. Codex read the supplied source texts and produced structured candidate rules, with the extraction method recorded. The public demo runs those candidates through one shared rule engine; browser answers and submission exports use the same logic. Schema checks, exact source-span checks, calendar validation, and targeted tests catch structural errors. Three-valued logic preserves missing facts without guessing. City rules require geographic evidence, not a matching postal label. Evidence added in the browser stays separate from the original sample. A separate API compiler is implemented, but this presentation does not claim an unperformed API run. The remaining hard problem is legal interpretation: traceability supports review; it does not certify correctness.

### Bildregie

| Zeit | Aktion |
|---|---|
| 0–12 s | Originaltext und extrahierten Kandidaten nebeneinander zeigen; Methode `codex_assisted_extraction` lesbar |
| 12–23 s | Einfaches Diagramm: Quelle → Regelpaket → gemeinsame Engine → Oberfläche und Exporte |
| 23–35 s | Echte Prüfungen: Zitatmanipulation, ungültiges Datum und Drei-Werte-Logik |
| 35–46 s | Fehlender Gebäudefakt und getrennte Simulationsdaten in der Anwendung |
| 46–58 s | Audit-/Integrity-Ansicht; verbleibende Quellen- und Interpretationslücken |

**Wenn später ein echter API-Lauf erfolgt:** Den entsprechenden Satz erst nach Sichtung des Protokolls ersetzen durch „The separate API compiler also processed the source shown here; the audit records that run.“ Dazu genau den belegten Lauf zeigen. Keine Erfolgsquote oder Laufzeit ohne Messung ergänzen.

## 3. Team

**Vorbereitung:** Yannik spricht selbst in die Kamera. Ruhiger Hintergrund, Kamera auf Augenhöhe, weiches Licht von vorn, kurze Tonprobe. Ein schlichtes Namensschild „Yannik Trinn · Solo builder“ genügt. Keine Logos von Studieren ohne Grenzen verwenden und keine organisatorische Unterstützung behaupten.

### Sprechtext

My name is Yannik Trinn. I’m competing solo and serve on the federal board of Studieren ohne Grenzen, which supports access to education in the Global South. This project is my independent hackathon entry. I used AI extensively across product planning, coding, extraction, and testing, and I am responsible for what I present. With LawDiff, I want people to see how an answer was reached, which source supports it, and what is still missing. The ambition is a useful product with a clear interface and an honest technical foundation. Its next step is expert review and a focused pilot. I’m looking for critical feedback and people who understand this workflow.

**Persönliche Freigabe:** Yannik liest den Text vor der Aufnahme. Falls eine Formulierung seine tatsächliche Rolle oder Motivation nicht trifft, wird sie korrigiert. Keine Arbeitgeber, Hochschulen, Abschlüsse oder bisherigen Nutzer ergänzen, die nicht bestätigt sind.

## Export und Dateinamen

- `lawdiff-demo.mp4`
- `lawdiff-tech.mp4`
- `lawdiff-team.mp4`

Empfohlen: MP4/H.264, 1920×1080, gut verständliches Audio, eingebrannte oder mitgelieferte englische Untertitel. Die wichtigste Textpassage muss auch bei kleiner Videoansicht lesbar bleiben. Schnitte dürfen Wartezeit kürzen, aber keinen Verarbeitungserfolg vortäuschen. Beschleunigte Abläufe ausdrücklich kennzeichnen. Die endgültige Dauer jedes Videos wird vor dem Upload kontrolliert.
