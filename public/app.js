// A10 Hospital website. Each page shows one MySQL table: its rows, a form to insert or edit a
// row, and the SQL statement the server ran. The form is built from the table's columns.

const INFO = {
  departments:        ['Departments', 'Clinical departments of the hospital.'],
  doctors:            ['Doctors', 'Doctors in the directory. Each belongs to one department.'],
  patients:           ['Patients', 'Registered users who receive care.'],
  appointments:       ['Appointments', 'Booked visits between one patient and one doctor.'],
  prescriptions:      ['Prescriptions', 'Medicines a doctor issues to a patient. Amended by issuing a new version that supersedes the old one.'],
  prescription_items: ['Prescription items', 'One medicine line on a prescription. Deleted together with its prescription.'],
  medicines:          ['Medicines', 'Products in the hospital pharmacy catalogue.'],
  medication_orders:  ['Medication orders', "A patient's pharmacy order, optionally backed by a prescription."],
}
// Column shown next to an id when another table points at this one.
const LABEL = { departments: 'name', doctors: 'full_name', patients: 'full_name', appointments: 'reference', prescriptions: 'reference', medicines: 'name' }

const nav = document.getElementById('nav')
const main = document.getElementById('main')
let lastMessage = null

async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error), { sql: data.sql })
  return data
}

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const isBool = (c) => c.columnType === 'tinyint(1)'

async function renderNav(active) {
  const counts = await api('tables')
  nav.innerHTML = `<a href="#" class="${active ? '' : 'active'}">Overview</a>` + counts.map((t) =>
    `<a href="#${t.name}" class="${t.name === active ? 'active' : ''}">${INFO[t.name][0]} <span class="count">${t.rows}</span></a>`).join('')
  return counts
}

async function renderHome() {
  const counts = await renderNav(null)
  main.innerHTML = `
    <h1>Overview</h1>
    <p class="muted">The database has 8 tables. Pick one to see its rows and add, edit or delete them.</p>
    <div class="cards">${counts.map((t) => `
      <a class="card" href="#${t.name}">
        <div class="n">${t.rows}</div>
        <div class="t">${INFO[t.name][0]} <code>${t.name}</code></div>
        <div class="d">${INFO[t.name][1]}</div>
      </a>`).join('')}
    </div>`
}

function messageHtml() {
  if (!lastMessage) return ''
  const { ok, text, sql } = lastMessage
  lastMessage = null
  return `<div class="message ${ok ? 'ok' : 'error'}">${esc(text)}${sql ? `<pre>${esc(sql)};</pre>` : ''}</div>`
}

function inputFor(c, value, lookups) {
  const v = value ?? ''
  const name = `name="${c.name}"`
  if (c.references) {
    const opts = lookups[c.references].map((r) =>
      `<option value="${r.id}" ${String(r.id) === String(v) ? 'selected' : ''}>${r.id} · ${esc(r[LABEL[c.references]])}</option>`)
    return `<select ${name}><option value="">${c.nullable ? '(none)' : '— choose —'}</option>${opts.join('')}</select>`
  }
  if (c.enumValues) {
    const opts = c.enumValues.map((e) => `<option ${e === v ? 'selected' : ''}>${esc(e)}</option>`)
    return `<select ${name}><option value="">${c.nullable || c.defaultValue ? '(default)' : '— choose —'}</option>${opts.join('')}</select>`
  }
  if (isBool(c)) {
    return `<select ${name}><option value="">(default)</option><option value="1" ${v === 1 ? 'selected' : ''}>Yes</option><option value="0" ${v === 0 ? 'selected' : ''}>No</option></select>`
  }
  if (c.type === 'text') return `<textarea ${name}>${esc(v)}</textarea>`
  if (c.type === 'date') return `<input type="date" ${name} value="${esc(v)}">`
  if (c.type === 'datetime') return `<input type="datetime-local" ${name} value="${esc(String(v).slice(0, 16).replace(' ', 'T'))}">`
  if (c.type === 'int') return `<input type="number" step="1" ${name} value="${esc(v)}">`
  if (c.type === 'decimal') return `<input type="number" step="0.01" ${name} value="${esc(v)}">`
  return `<input type="text" ${name} value="${esc(v)}">`
}

function hint(c) {
  if (c.references) return `→ ${c.references}.id`
  if (!c.nullable && c.defaultValue === null) return 'required'
  if (c.defaultValue !== null) return `default ${c.defaultValue}`
  return 'optional'
}

function cell(c, value, lookups) {
  if (value === null) return '<td class="null">NULL</td>'
  if (isBool(c)) return `<td>${value ? 'Yes' : 'No'}</td>`
  if (c.references) {
    const r = lookups[c.references].find((x) => x.id === value)
    return `<td>${value}${r ? ` · ${esc(r[LABEL[c.references]])}` : ''}</td>`
  }
  const s = String(value)
  return `<td title="${esc(s)}">${esc(s.length > 60 ? `${s.slice(0, 60)}…` : s)}</td>`
}

async function renderTable(name, editId = null) {
  await renderNav(name)
  const table = await api(`tables/${name}`)
  const refTables = [...new Set(table.columns.filter((c) => c.references).map((c) => c.references))]
  const lookups = {}
  for (const t of refTables) lookups[t] = t === name ? table.rows : (await api(`tables/${t}`)).rows

  const editing = editId !== null ? table.rows.find((r) => r.id === editId) : null
  const formCols = table.columns.filter((c) => !c.autoIncrement)

  main.innerHTML = `
    <h1>${INFO[name][0]} <code>${name}</code></h1>
    <p class="muted">${INFO[name][1]}</p>
    ${messageHtml()}
    <h2>${editing ? `Edit row id ${editing.id}` : 'Insert a row'}</h2>
    <form class="row-form">
      ${formCols.map((c) => `<label>${c.name} <small>${c.columnType} · ${hint(c)}</small>${inputFor(c, editing?.[c.name], lookups)}</label>`).join('')}
      <div class="form-buttons">
        <button type="submit">${editing ? 'Save changes (UPDATE)' : 'Insert row (INSERT)'}</button>
        ${editing ? '<button type="button" class="secondary" data-cancel>Cancel</button>' : ''}
      </div>
    </form>
    <h2>Rows (${table.rows.length}) <small class="muted">SELECT * FROM ${name};</small></h2>
    <div class="table-wrap">
      <table>
        <thead><tr>${table.columns.map((c) => `<th>${c.name}<small>${c.columnType}${c.key === 'PRI' ? ' · PK' : c.references ? ' · FK' : c.key === 'UNI' ? ' · unique' : ''}</small></th>`).join('')}<th></th></tr></thead>
        <tbody>${table.rows.map((r) => `
          <tr>${table.columns.map((c) => cell(c, r[c.name], lookups)).join('')}
            <td class="actions"><button class="small secondary" data-edit="${r.id}">Edit</button> <button class="small danger" data-delete="${r.id}">Delete</button></td>
          </tr>`).join('') || `<tr><td colspan="${table.columns.length + 1}" class="null">No rows yet.</td></tr>`}
        </tbody>
      </table>
    </div>`

  const form = main.querySelector('form')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const body = {}
    for (const c of formCols) {
      let v = form.elements[c.name].value
      if (c.type === 'datetime' && v) v = `${v.replace('T', ' ')}:00`
      body[c.name] = v
    }
    try {
      const res = editing
        ? await api(`tables/${name}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : await api(`tables/${name}`, { method: 'POST', body: JSON.stringify(body) })
      lastMessage = { ok: true, text: editing ? 'Row updated.' : `Row inserted with id ${res.id}.`, sql: res.sql }
      renderTable(name)
    } catch (err) {
      lastMessage = { ok: false, text: `MySQL error: ${err.message}`, sql: err.sql }
      main.querySelector('.message')?.remove()
      form.insertAdjacentHTML('beforebegin', messageHtml())
    }
  })
  main.querySelector('[data-cancel]')?.addEventListener('click', () => renderTable(name))
  main.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    renderTable(name, Number(b.dataset.edit)).then(() => window.scrollTo(0, 0))
  }))
  main.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', async () => {
    try {
      const res = await api(`tables/${name}/${b.dataset.delete}`, { method: 'DELETE' })
      lastMessage = { ok: true, text: 'Row deleted.', sql: res.sql }
    } catch (err) {
      lastMessage = { ok: false, text: `MySQL error: ${err.message}`, sql: err.sql }
    }
    renderTable(name).then(() => window.scrollTo(0, 0))
  }))
}

function route() {
  const name = location.hash.slice(1)
  const page = INFO[name] ? renderTable(name) : renderHome()
  page.catch((err) => { main.innerHTML = `<div class="message error">Could not load: ${esc(err.message)}. Is MySQL running?</div>` })
}
window.addEventListener('hashchange', route)
route()
