# Fabric Specimen Log

A local Joplin desktop tool for keeping fabric specimen readings, wash conditions, and project notes together. It calculates dimensional contraction on the width and height axes independently, accepts mm/cm/in readings, imports CSV, and creates a separate summary note.

By [Sewlore](https://sewlore.com/). Measurement-method background: [fabric measurement methods guide](https://sewlore.com/pages/fabric-measurement-methods-guide).

## Installation

Requires Joplin desktop 3.7 or newer. In Joplin, open **Tools → Options → Plugins**, use **Install from file**, and select `publish/com.sewlore.fabric-specimen-log.jpl`. Restart Joplin when requested. This initial release has been compiled against the official generator-joplin 3.7.2 API definitions and tested in a host-API harness; installation in a native Joplin desktop application has not yet been verified. Mobile support is not declared.

## Record and compare

1. Use **Tools → Record fabric specimen**.
2. Enter a unique specimen ID, project, and actual measurement date.
3. Enter width and height before washing, then width and height afterwards. Keep the same marked directions on the specimen. The before and after pairs can use different explicit units.
4. Describe wash conditions, drying, conditioning, measurement method, and any notes useful for reproducing your own procedure.
5. Review the two results and choose **Save locally**. Cancel leaves the log unchanged.

Contraction (%) = `(before − after) ÷ before × 100`. Positive values indicate a smaller dimension. Negative values indicate growth. Width and height are never averaged. A 100 × 200 mm synthetic sample followed by 95 × 210 mm readings gives width contraction 5% and height contraction −5%. This is a digital example, not a Sewlore fabric test or material certification.

Use **View fabric specimen log** for an overview and **Create fabric specimen summary note** for method/notes plus a table in the selected notebook. A new note is created; existing notes are not replaced. Readings do not certify fabric quality, wash safety, garment fit, or a manufacturer specification.

## CSV backups and import

**Export fabric specimens to CSV clipboard** copies the complete log. Paste it into a UTF-8 `.csv` file as a backup. The header is:

```csv
id,project,date,beforeWidth,beforeHeight,beforeUnit,afterWidth,afterHeight,afterUnit,method,notes
```

Use **Import fabric specimens from CSV** to paste a backup. Imports append validated records. Duplicate IDs, malformed rows, invalid units, or invalid dimensions abort the entire import before saving. Up to 1000 specimens are supported; input CSV is limited to 16 million characters. Decimal numbers use a period; text is quoted using normal CSV rules. Quotes, commas, and line breaks in text fields are supported.

Export prefixes spreadsheet-risk text beginning with `=`, `+`, `-`, `@`, tab, or line break with an apostrophe. On reimport, that protective apostrophe remains part of the text; it is not automatically removed. Numeric readings are unchanged. This behaviour intentionally favours safe spreadsheet handling over an exact round trip of potentially executable labels.

**Remove fabric specimen** removes only the selected log entry after a second confirmation. Existing summary notes remain unchanged. To correct a specimen, export a backup, remove the old entry, and record the corrected readings. Keep regular CSV backups before uninstalling or changing profiles.

## Privacy and storage

The plugin stores its log as a private plugin setting in the Joplin profile. It makes no network requests, has no telemetry, and requires no account or payment. It reads its own settings and the selected notebook ID; it does not scan unrelated note content. CSV is written to the operating-system clipboard only when you request export. Summary notes are ordinary Joplin notes and follow your existing Joplin synchronization and encryption configuration. See [PRIVACY.md](PRIVACY.md).

No attribution link is forced into user-created CSV or notes. The plugin listing homepage links to the measurement guide so users can find the methodology.

## Development and checks

```sh
npm ci --ignore-scripts
npm test
npm pack --dry-run
```

Node 20 or newer is required for building; Python 3 is used only by `release.py` to create a reproducible source ZIP. `npm run dist` runs strict TypeScript checking, bundles the plugin, builds a native `.jpl` tar archive, and writes the publication manifest with its SHA-256. Tests check separate axes, mm/cm/in equivalence, malformed values, CSV quoting/formula defence, cancelled writes, duplicate import protection, saved-state restart behaviour in a host harness, and summary-note creation.

Native installation and native UI accessibility remain to be verified before describing this as native-app tested. No fabricated software screenshot is included.

## License

MIT © 2026 Sewlore. Official Joplin API definitions are MIT © Laurent Cozic and contributors; their notice is included in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). The formula-neutralizing CSV cell function follows Sewlore's existing MIT sewing-math implementation. This is an independent community extension, not an official Joplin product.
