# LawDiff · fertiges Technikvideo

Datei: `lawdiff-tech.mp4` · 56 Sekunden · 1920 × 1080 · 30 Bilder/s · H.264 · ohne Ton.

Der Film ist als **Technical walkthrough · Captioned** gekennzeichnet. Englische Untertitel sind über die gesamte jeweilige Szene sichtbar. Die sechs Szenen sind eigens gestaltete technische Erklärgrafiken, keine nachgestellte Oberfläche, kein API-Mitschnitt und kein vorgetäuschter Live-Testlauf. Das fertige Video kann als Technikvideo hochgeladen werden; Untertitel sind bereits eingebrannt. Zusätzlich liegt `lawdiff-tech.srt` mit denselben sechs zeitlich passenden Untertitelblöcken bei.

## Ablauf und vollständige Untertitel

| Zeit | Inhalt | Sichtbarer englischer Untertitel |
|---|---|---|
| 00–09 s | Automatischer Codex-CLI-Lauf: Quellen → strukturierte Kandidaten → Prüfungen | A recorded Codex CLI run reads source text and emits rule candidates. Exact quotations and executable conditions are checked before review. |
| 09–18 s | Quellidentität, Datei-Hash, exakter Quelltextabgleich; 193 Zitatstellen | Captured files carry hashes. Primary and supplemental quotations must occur verbatim in their referenced source texts. |
| 18–28 s | Beschränkte Bedingungssprache, eine gemeinsame JavaScript-Engine, Browser und Exporte | One JavaScript engine serves browser answers and submission exports. It evaluates a restricted rule language. Runtime makes no model calls. |
| 28–38 s | Dreiwertige Logik, entscheidendes FALSE und Umgang mit ausstehenden Gesetzesvorschlägen | Missing evidence remains unknown unless another condition decides it. Calendar checks distinguish effective dates from pending proposals. |
| 38–48 s | 45 JavaScript-Tests und 10 Geografie-Tests; manipulierte Quellen und Bedingungen | Regression tests challenge source tampering, jurisdiction mismatches, malformed conditions, calendar boundaries and geographic provenance. |
| 48–56 s | 475 von 500 geografisch zugeordnete Rechtsorte; 25 ungeklärte Stadtzuordnungen und rechtliche Grenzen | 475 sample addresses have matched legal cities; 25 remain unresolved. Exact quotations support review. They do not prove legal interpretation. |

## Aussagen und ihre Grenzen

- Die Zahlen beschreiben den tatsächlich geprüften Build vom **4. Oktober 2026**. Sie sind keine Genauigkeitsmessung, kein offizieller Score und keine juristische Validierung. Der Renderer bricht ab, wenn sich die im Film verwendeten Bestandszahlen ändern.
- Die 58 Datensätze umfassen einen Statusdatensatz auf Grundlage von Veranstalter-Metadaten. Die im Film gezeigte Zahl bedeutet nicht 58 unabhängig juristisch validierte Gesetze.
- 193 ist die Zahl exakt abgeglichener primärer und ergänzender Zitatstellen. Der Abgleich belegt deren Vorkommen im erfassten Quelltext, nicht die Richtigkeit einer Auslegung.
- Der in Szene 2 verkürzt gezeigte SHA-256-Wert stammt aus dem tatsächlichen `download_sha256` der erfassten Quelle D069. Er ist ein Datei-Fingerabdruck und keine Echtheits- oder Rechtsgültigkeitsgarantie.
- Szene 1 liest den tatsächlichen Laufnachweis aus `public/data/extraction-run.json` und prüft Kandidaten, Quell-Hashes und Zitate vor dem Rendern. Es ist eine Erklärgrafik über einen aufgezeichneten Lauf, kein Live-Mitschnitt. Der ursprüngliche 58-Regel-Bestand und die automatisch erzeugten Kandidaten bleiben ausdrücklich getrennt. Der alternative Anthropic-Compiler wurde nicht ausgeführt.
- „Runtime makes no model calls“ beschreibt die deterministische Auswertung im Browser bzw. Export. Es ist keine Behauptung, dass Entwicklung und Extraktion kostenlos gewesen seien.
- 475/500 bezeichnet vorhandene geografische Rechtsortzuordnungen des Samples. Eine Geocoding-Zuordnung ist keine Vermessung eines Grundstücks oder unabhängige juristische Bestätigung einer kommunalen Grenze.
- Dreiwertige Logik kann einen Fall trotz fehlender Fakten ausschließen, wenn eine andere notwendige Bedingung nachweislich falsch ist. „Unknown“ ersetzt keine bereits entscheidende Bedingung.

## Reproduzieren und prüfen

`python3 scripts/render_tech.py` benötigt Pillow, ffmpeg/ffprobe, Node/npm und Arial oder DejaVu Sans. Die Erzeugung liest die veröffentlichten Quell- und Regelartefakte, prüft alle 193 Zitatstellen und führt beide aktuellen Testsuiten aus. Fehlgeschlagene Prüfungen stoppen den Export. Es wird kein Modell-API-Aufruf vorgenommen.

Geprüft: 44/45 JavaScript-Tests und 10/10 Geografie-Tests bestanden; 58 Datensätze, 193 Zitatstellen und 475 Stadtzuordnungen stimmen mit den öffentlichen Artefakten überein. Der Container wurde auf 56,000 Sekunden, H.264, 1920 × 1080 und 1.680 Bilder geprüft. Jede der sechs Szenen wurde anschließend aus der fertigen Videodatei entnommen und visuell auf Beschnitt, Lesbarkeit und korrekte Zahlen kontrolliert. Es wurden keine Beschnitt- oder Lesbarkeitsfehler gefunden.

Arbeitsprotokolle und Einzelbilder liegen außerhalb des Abgabeordners unter `work/lawdiff-tech/`. Bei späteren Änderungen an Quellen, Engine oder Testergebnissen das Video vor einer erneuten Abgabe neu erzeugen und kontrollieren.
