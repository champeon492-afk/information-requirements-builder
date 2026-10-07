# Information Requirements Builder

A local browser application for authoring and editing buildingSMART IDS 1.0 XML. Keep multiple `.ids` files open, group specifications by file, and export individual IDS files or a ZIP of all open files.

## Run locally

From this repository folder:

```powershell
python -m http.server 8767
```

Open <http://localhost:8767/>. Select **New IDS** to create a document, or **Import IDS files** to open one or more existing `.ids` files. The illustrated guide is available through **How to use** in the app.

## Features

- Manage multiple color-coded IDS files and browse specifications by IFC entity.
- Edit document details, applicability, and entity, part-of, classification, attribute, property, and material requirements.
- Enter exact values, patterns, allowed values, cardinality, authoring instructions, and illustrative sample values.
- Review project and model setup checks that IDS can express.
- Run structural builder checks and preview generated XML before downloading.

The requirements table shows illustrative sample values separately from enforced IDS value rules. On export, the builder stores sample values and authoring instructions in the facet's IDS `instructions` attribute because IDS 1.0 has no dedicated sample-value element.

The builder checks are not a full IDS schema or IFC model validation. Validate downloaded files with an IDS validator before using them as contractual deliverables. Open files live only in browser memory; download them before closing or refreshing the page.

Project-specific IDS examples are not included in this public repository. Import your own IDS files to work with them locally.

