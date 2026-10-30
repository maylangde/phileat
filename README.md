# PhilEat

Ernährungs- und Intervallfasten-Tracker für die Philippinen. Läuft als Web-App (PWA) auf dem Handy, speichert alle Daten **lokal** auf dem Gerät (IndexedDB) und braucht keinen Server.

**Stand v0.1 (nur lokal, Android):** Profil und Tagesziele, Lebensmittelsuche (Deutsch/Englisch/Filipino), Tagebuch, Rezepte und Töpfe (Portionen aus dem fertigen Gericht), Intervallfasten, Wasser, Bewegung, Gewicht, Barcode-Scan, Sicherung/Wiederherstellung. Der Haushalt (Partner-Verknüpfung) ist als Platzhalter angelegt.

Zubereitung: Bei rohen Lebensmitteln (Fleisch, Fisch, Ei, Gemüse, Reis, Nudeln, Knollen, Tofu) wählst du beim Eintragen die Garart und die Garzeit. `src/lib/cooking.ts` rechnet daraus Wasserverlust, ausgetretenes Fett, Natrium im Kochwasser und aufgenommenes Öl. Das Modell ist gegen die gegarten Einträge der Datenbank kalibriert (`npm test`).

## Auf dem Handy nutzen (Android)

Die App liegt öffentlich auf GitHub Pages: **https://maylangde.github.io/phileat/**

1. Die Adresse in Chrome auf dem Android-Handy öffnen.
2. Menü (drei Punkte) → **App installieren** (oder in der App unter Mehr → Einstellungen → Installieren).
3. Die App erscheint auf dem Startbildschirm, startet im Vollbild und läuft danach auch ohne Internet.

Die Daten bleiben auf dem Handy. GitHub hostet nur den Programmcode, nie deine Einträge.

### Aktualisieren

Jeder Push auf `main` startet in GitHub Actions einen Lauf (Tests, Build, Veröffentlichung, siehe `.github/workflows/pages.yml`). Nach etwa einer Minute ist die neue Version online. Auf dem Handy aktualisiert sich die App beim nächsten Start selbst, bei Bedarf einmal komplett schließen und neu öffnen.

### Anderes Hosting

`npm run build` erzeugt den Ordner `dist/`. Dessen Inhalt kann auf jeden Webspace mit HTTPS hochgeladen werden, z. B. eine Subdomain bei Hostinger.

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Prüft Lebensmitteldaten, Rezepte, Übersetzungen und Rechenfunktionen
npm run build    # Typprüfung und Produktions-Build nach dist/
```

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/data/foods.ts` | Start-Datenbank (236 Lebensmittel, Gerichte, Fast Food) |
| `src/data/recipes.ts` | Startrezepte |
| `src/lib/nutrition.ts` | Nährwert- und Zielberechnung |
| `src/db.ts` | Lokale Datenbank (Dexie/IndexedDB), Sicherung |
| `src/screens/` | Bildschirme |
| `src/i18n-dict.ts` | Deutsch und Englisch |

Alle Datensätze haben eine eindeutige ID und einen Zeitstempel. Das ist die Grundlage für die spätere verschlüsselte Haushalts-Synchronisierung.

## Design

Helle, weiße Oberflächen mit weichen Schatten, hell und dunkel (folgt dem Handy). Der Stil ist angelehnt an das CodePen [„Sudoku Neumorphism Design“ von Flávio Amaral](https://codepen.io/flavio_amaral/pen/oNGPqEN). Farbpalette, Schatten und Komponenten sind für PhilEat neu aufgebaut (`src/styles.css`). Schrift: Open Sans, lokal eingebunden, damit die App auch offline gleich aussieht.

Navigation: ein runder Drehknopf unten öffnet sich als Fächer (`src/components/dial.tsx`), angelehnt an [„Futuristic Dial Button“ von LukyVJ](https://codepen.io/LukyVj/pen/xxyEYMJ). Er sitzt standardmäßig rechts, alternativ mittig oder links (Mehr → Einstellungen → Menü-Position).

## Hinweise zu den Daten

- Die Nährwerte der Start-Datenbank sind **gerundete Richtwerte** (Größenordnung PhilFCT/USDA und Herstellerangaben), als „estimate“ markiert und nicht gegen die offiziellen Tabellen geprüft. Gerichte aus Carinderias und Fast Food sind Schätzungen.
- Eigene Lebensmittel oder Kopien mit exakten Werten von der Verpackung lassen sich in der App anlegen.
- Produktdaten beim Barcode-Scan kommen von Open Food Facts (ODbL) und brauchen Internet.
- Die Zielwerte sind allgemeine Richtwerte und keine medizinische Beratung.
