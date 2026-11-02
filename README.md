# A10 Hospital: DBMS project (MySQL)

A hospital management database with **8 tables** (matching the ER diagram) and a simple website to
view, insert, edit and delete rows. The website shows the exact SQL statement it ran each time.

| # | Table | What it stores | Keys |
|---|-------|----------------|------|
| 1 | `departments` | Clinical departments | PK `id`, unique `slug`, `name` |
| 2 | `doctors` | Doctors, each in one department | PK `id`, FK `department_id` |
| 3 | `patients` | Registered patients | PK `id`, unique `email` |
| 4 | `appointments` | A visit between one patient and one doctor | PK `id`, unique `reference`, FKs `patient_id`, `doctor_id`, `department_id` |
| 5 | `prescriptions` | Medicines a doctor issues; amended by a new version | PK `id`, unique `reference`, FKs `patient_id`, `doctor_id`, `appointment_id`, `supersedes_id` (self) |
| 6 | `prescription_items` | One medicine line on a prescription (weak entity) | PK `id`, FK `prescription_id` (ON DELETE CASCADE), FK `medicine_id` |
| 7 | `medicines` | Pharmacy catalogue | PK `id`, unique `slug` |
| 8 | `medication_orders` | A patient's pharmacy order | PK `id`, unique `reference`, FKs `patient_id`, `prescription_id` |

CHECK constraints: fees, prices and stock can't be negative, `ends_at > starts_at`,
`quantity > 0`, and `total = subtotal + delivery_fee`.

**PL/SQL** (`database/plsql.sql`, no extra tables):

| Kind | Name | What it does |
|------|------|--------------|
| Function | `fn_patient_age(dob)` | Age in years |
| Function | `fn_delivery_fee(subtotal)` | Free delivery above Rs 1000, else Rs 40 |
| Function | `fn_doctor_earnings(doctor_id)` | Fees from completed appointments |
| Procedure | `sp_book_appointment` | Books a slot; rejects past times and clashes |
| Procedure | `sp_amend_prescription` | New version + copied lines; old one superseded (transaction) |
| Procedure + cursor | `sp_place_order` | Walks the prescription lines, checks and reduces stock, rolls back if short |
| Procedure + cursor | `sp_department_report` | Doctors, appointments and earnings per department |
| Trigger | `trg_appointment_before_insert` | Doctor must be in that department; department must be active |
| Trigger | `trg_appointment_before_update` | Status can only change from `booked` |
| Trigger | `trg_prescription_before_insert` | Only an active prescription can be amended; sets the version |
| Trigger | `trg_order_before_insert` | Computes the total; prescription must be the patient's and active |

## Files

```
database/schema.sql   CREATE TABLE statements for the 8 tables
database/seed.sql     sample rows (INSERT statements)
database/plsql.sql    functions, stored procedures (two with cursors) and triggers
database/queries.sql  example queries for the review (joins, GROUP BY, subquery, UPDATE, DELETE, CALL)
public/               the website (plain HTML, CSS, JavaScript)
server/index.mjs      web server (Node.js + Express + mysql2)
scripts/              start MySQL, build the database, open the MySQL shell
```

## Running it

Needs Node.js and MySQL Server 8.4 installed. The project runs its **own** MySQL server on port
3307 (data in `.mysql/`), so it doesn't touch any other MySQL on the computer.

**Website:** double-click `start.bat`, or run:

```
npm install        (first time only)
npm start
```

Then open http://localhost:3000. Press Ctrl+C to stop. The first run builds the database.

**MySQL shell:** with `npm start` running, open a second terminal:

```
npm run db:sql
```

```sql
SHOW TABLES;
DESCRIBE doctors;
SELECT * FROM appointments;
INSERT INTO departments (slug, name, description) VALUES ('ent', 'ENT', 'Ear, nose and throat');
SOURCE database/queries.sql;
exit
```

## Other commands

| Command | What it does |
|---------|--------------|
| `npm run db:server` | Start only MySQL (port 3307) |
| `npm run web` | Start only the website (needs MySQL running) |
| `npm run db:setup` | Rebuild the database from `schema.sql` + `seed.sql` + `plsql.sql` (**deletes all changes**) |
| `npm run db:setup -- --empty` | Rebuild with the 8 empty tables |
| `npm run db:sql -- "SELECT * FROM doctors"` | Run one SQL statement |

Logins: MySQL `root` / `A10root#2026`. The website connects as `a10_app`, which can only
SELECT, INSERT, UPDATE and DELETE in `a10_hospital`. Change these in `.env` (see `.env.example`).

The earlier, larger version of this project is kept in git under the tag `full-version`.
