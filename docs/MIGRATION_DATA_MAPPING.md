# SmartLib Data Migration — Field Mapping Reference

> Phase 4C | Enterprise Data Migration Suite  
> Version 1.0 | November 2026

---

## Overview

The SmartLib migration engine automatically resolves column headers from legacy Library Management Systems (LMS) — including Koha, LibSys, Sierra, and MARC21 exports — to their canonical SmartLib field names. This resolution is case-insensitive and strips all non-alphanumeric characters before matching.

---

## Canonical Fields

| Canonical Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | **Yes** | Full bibliographic title |
| `subtitle` | string | No | Subtitle / remainder of title |
| `isbn13` | string | Recommended | 13-digit ISBN (validated against check digit) |
| `isbn10` | string | No | Legacy 10-digit ISBN |
| `authors` | string / array | **Yes** | Author name(s); comma-separated strings are split |
| `publisher` | string | **Yes** | Publisher name; created if not found |
| `category` | string | **Yes** | Subject / genre; created if not found |
| `edition` | string | No | Edition statement (e.g., "3rd") |
| `publicationYear` | integer | No | 4-digit year (1000–2099) |
| `language` | string | No | Language name or ISO code (default: "English") |
| `callNumber` | string | No | Dewey / LC call number |
| `accessionNumber` | string | No | Physical copy accession number (must be unique) |
| `barcode` | string | No | Physical copy barcode |
| `shelfLocation` | string | **Yes** | Shelf or stack location code |
| `copiesCount` | integer | No | Number of copies to create (default: 1) |
| `condition` | enum | No | `EXCELLENT` \| `GOOD` \| `FAIR` \| `POOR` \| `DAMAGED` |
| `price` | decimal | No | Replacement cost |
| `isReferenceOnly` | boolean | No | Reference-only (non-circulating); default: false |
| `description` | string | No | Abstract, summary, or notes |

---

## Alias Dictionary

### `title` → Book Title
```
title, book_title, booktitle, item_title, name, main_title, title_statement
```

### `subtitle` → Subtitle
```
subtitle, sub_title, remainder_of_title
```

### `isbn13` → ISBN-13 / ISBN
```
isbn13, isbn_13, isbn-13, isbn, isbn_no, isbnno,
international_standard_book_number, 020$a
```

### `isbn10` → ISBN-10
```
isbn10, isbn_10, isbn-10
```

### `authors` → Author(s)
```
authors, author, writer, creator, contributors,
primary_author, author_name, authorname, 100$a, 700$a
```

### `publisher` → Publisher Name
```
publisher, pub, publisher_name, publisher_house,
publisherhouse, imprint, publication_details, 260$b, 264$b
```

### `category` → Subject / Category
```
category, genre, subject, classification_name, topic, collection, 650$a
```

### `edition` → Edition Statement
```
edition, ed, edition_statement, 250$a
```

### `publicationYear` → Publication Year
```
publicationyear, publication_year, publish_year, publishyear,
pub_year, year, date, pubdate, copyright_year, 260$c, 264$c
```

### `language` → Language
```
language, lang, language_code, 041$a
```

### `callNumber` → Call Number / Classification
```
callnumber, call_number, callno, classification, dewey,
ddc, loc_class, 082$a, 050$a
```

### `accessionNumber` → Accession Number
```
accessionnumber, accession_no, accession_number, accessionno,
acc_no, accno, accession, barcode_number
```

### `barcode` → Copy Barcode
```
barcode, item_barcode, copy_barcode
```

### `shelfLocation` → Shelf Location
```
shelflocation, shelf_location, shelf, location, stack,
stacks, sublocation, holding_branch
```

### `copiesCount` → Number of Copies
```
copiescount, copies_count, copies, copy_count, quantity,
num_copies, numcopies, items_count
```

### `condition` → Copy Condition
```
condition, copy_condition, physical_condition, state
```

### `price` → Replacement Price
```
price, cost, item_price, amount, replacement_price
```

### `isReferenceOnly` → Reference-Only Flag
```
isreferenceonly, reference_only, ref_only, reference,
non_circulating, circulating_status
```

### `description` → Abstract / Notes
```
description, summary, abstract, notes, 520$a, 500$a
```

---

## Alias Matching Algorithm

```
Input column header  →  lowercase  →  strip non-alphanumeric  →  match against alias list
```

**Example:**
- `"Publication Year"` → `"publication year"` → `"publicationyear"` → matches `publicationYear`
- `"ISBN-13"` → `"isbn-13"` → `"isbn13"` → matches `isbn13`
- `"Author Name"` → `"author name"` → `"authorname"` → matches `authors`

---

## Data Type Coercion Rules

| Field | Input Example | Stored As |
|---|---|---|
| `authors` | `"Fowler, Martin; Beck, Kent"` | `["Fowler, Martin", "Beck, Kent"]` |
| `publicationYear` | `"2024"`, `2024`, `"2024-01-01"` | `2024` (integer) |
| `isReferenceOnly` | `"yes"`, `"true"`, `"1"`, `"Y"` | `true` |
| `isReferenceOnly` | `"no"`, `"false"`, `"0"`, `"N"` | `false` |
| `condition` | `"good"`, `"GOOD"` | `GOOD` (enum) |
| `copiesCount` | `"3"`, `3.0` | `3` (integer, min 1) |

---

## Formula Injection Sanitization

Any cell value beginning with `=`, `+`, `-`, `@`, tab, or carriage return is prefixed with `'` (apostrophe) before storage to prevent CSV/Excel formula injection attacks.

---

## Unmapped Fields

Columns that do not match any canonical field or alias are:
1. Stored verbatim in `unmappedFields` on the staging record
2. Included in the validation error report as a **WARNING** (not ERROR)
3. Never silently discarded

---

## Supported File Formats

| Format | Extension | Notes |
|---|---|---|
| CSV | `.csv` | UTF-8 and Latin-1 auto-detected |
| Excel | `.xlsx`, `.xls` | Reads first worksheet |
| JSON | `.json` | Array of objects |
| Text | `.txt` | Tab-separated or comma-separated |

Maximum file size: **50 MB**

---

## Validation Classification

| Classification | Meaning |
|---|---|
| `VALID` | Record passes all validation rules; eligible for commit |
| `INVALID` | One or more required fields missing or format error |
| `DUPLICATE` | ISBN or accession number conflicts within batch or existing catalog |
| `WARNING` | Optional field issues; record is still committed |

---

## Sample CSV Headers (Minimal)

```csv
title,isbn,authors,publisher,category,shelfLocation
"Clean Code",9780132350884,"Robert C. Martin","Prentice Hall","Software Engineering","STACK-A-01"
```

## Sample CSV Headers (Full)

```csv
title,subtitle,isbn13,isbn10,authors,publisher,category,edition,publicationYear,language,callNumber,accessionNumber,shelfLocation,condition,referenceOnly,description
"The Pragmatic Programmer","Your Journey to Mastery",9780135957059,,"David Thomas; Andrew Hunt","Addison-Wesley","Software Engineering","20th Anniversary",2019,English,"QA76.6.T46 2019","ACC-2024-001","STACK-A-01",GOOD,false,"Principles and best practices of software craftsmanship."
```

## Sample MARC21-Derived Headers

```csv
title_statement,020$a,100$a,260$b,650$a,082$a,250$a,260$c
"Introduction to Algorithms",9780262046305,"Cormen, Thomas H.","MIT Press","Computer Algorithms","005.1","4th","2022"
```

