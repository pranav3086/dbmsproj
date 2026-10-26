// Data access for the API server. Every request runs on a pooled connection of the
// application's MySQL account, after `SET @app_session_token = <browser session token>`,
// so the database itself decides which rows the caller may read (security views in
// <prefix>_api) and what they may change (stored procedures in <prefix>_hospital).
//
// The browser never sends SQL. It names a view and a filter, or a procedure and its
// arguments; both names are checked against what the MySQL account is actually granted.
import mysql from 'mysql2/promise'

export class ApiError extends Error {
  constructor(message, { status = 400, code, hint } = {}) {
    super(message)
    this.status = status
    this.code = code
    this.hint = hint
  }
}

const IDENT = /^[a-z_][a-z0-9_]*$/
const MYSQL_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/
// Columns computed with EXISTS(...) come back as integers; these are booleans in the UI.
const COMPUTED_BOOLEANS = new Set(['has_availability'])

/** "2026-10-27 04:30:00.000" (UTC) → "2026-10-27T04:30:00.000Z" */
function toIso(s) {
  const [date, time] = s.split(' ')
  const [hms, frac = ''] = time.split('.')
  return `${date}T${hms}.${(frac + '000').slice(0, 3)}Z`
}
/** Any ISO timestamp → "2026-10-27 04:30:00.000" in UTC, the form DATETIME columns take. */
export const toMysqlDatetime = (iso) => new Date(iso).toISOString().replace('T', ' ').replace('Z', '')

function reviveDates(value) {
  if (typeof value === 'string') return MYSQL_DATETIME.test(value) ? toIso(value) : value
  if (Array.isArray(value)) return value.map(reviveDates)
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = reviveDates(value[k])
  }
  return value
}

function typeCast(field, next) {
  switch (field.type) {
    case 'TINY':
      if (field.length === 1) {
        const v = field.string()
        return v === null ? null : v === '1'
      }
      return next()
    case 'DATETIME':
    case 'TIMESTAMP': {
      const v = field.string()
      return v === null ? null : toIso(v)
    }
    case 'DATE':
    case 'TIME':
      return field.string()
    case 'JSON': {
      // 'utf-8' (not 'utf8'): mysql2 warns when the name matches a view column's own encoding.
      const v = field.string('utf-8')
      return v === null ? null : reviveDates(JSON.parse(v))
    }
    case 'NEWDECIMAL': {
      const v = field.string()
      return v === null ? null : Number(v)
    }
    case 'LONGLONG':
    case 'LONG': {
      const v = field.string()
      if (v === null) return null
      return COMPUTED_BOOLEANS.has(field.name) ? v === '1' : Number(v)
    }
    default:
      return next()
  }
}

function toParam(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string' && ISO_DATETIME.test(v)) return toMysqlDatetime(v)
  if (typeof v === 'object' && !Buffer.isBuffer(v)) return JSON.stringify(v)
  return v
}

/** Maps MySQL errors to messages that are safe and useful to show to the user. */
export function toApiError(e) {
  if (e instanceof ApiError) return e
  const state = e?.sqlState
  const msg = e?.sqlMessage ?? e?.message ?? 'Unexpected database error'
  if (state === '28000' && e.errno === 1644) return new ApiError(msg, { status: 401, code: state })
  if (state === '42501') return new ApiError(msg, { status: 403, code: state })
  if (state === 'P0002') return new ApiError(msg, { status: 404, code: state })
  if (state === '45001') return new ApiError(msg, { code: 'P0001', hint: 'SLOT_UNAVAILABLE' })
  if (state === '45000') return new ApiError(msg, { code: 'P0001' })
  switch (e?.errno) {
    case 1062: return new ApiError('That record already exists.', { code: '23505' })
    case 3819: return new ApiError('Some details are not valid. Please check them and try again.', { code: '23514' })
    case 1406: return new ApiError('Some details are too long.', { code: '22001' })
    case 1452: return new ApiError('A related record could not be found.', { code: '23503' })
    case 1451: return new ApiError('This record is still in use and cannot be removed.', { code: '23503' })
    case 1142: case 1143: case 1370:
      return new ApiError('You do not have permission to do that.', { status: 403, code: '42501' })
    case 1292: case 1366: return new ApiError('Some details are not in the expected format.', { code: '22007' })
  }
  console.error('[db]', e)
  return new ApiError('Unexpected database error', { status: 500 })
}

/** Strips characters with meaning in LIKE patterns or filter syntax (mirrors the client). */
const sanitizeSearch = (term) => String(term).replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 80)
const likeContains = (term) => `%${sanitizeSearch(term).replace(/_/g, '\\_')}%`

// Direct table writes from the UI are translated into the procedure that owns that table.
const WRITES = {
  profiles: { update: (values) => ['update_my_profile', [values]] },
  doctors: { insert: (values) => ['save_doctor', [null, values]], update: (values, id) => ['save_doctor', [id, values]] },
  departments: { insert: (values) => ['save_department', [null, values]], update: (values, id) => ['save_department', [id, values]] },
  medicines: { insert: (values) => ['save_medicine', [null, values]], update: (values, id) => ['save_medicine', [id, values]] },
  observation_records: { insert: (values) => ['save_observation', [null, values]], update: (values, id) => ['save_observation', [id, values]] },
  doctor_availability: { insert: (values) => ['add_availability', [values]], remove: (_v, id) => ['remove_availability', [id]] },
}

export function createDb({ host, port, user, password, prefix = 'a10' }) {
  const hospital = `${prefix}_hospital`
  const api = `${prefix}_api`
  const pool = mysql.createPool({
    host, port, user, password,
    timezone: 'Z', charset: 'UTF8MB4_0900_AI_CI', typeCast, supportBigNumbers: true,
    connectionLimit: 10, waitForConnections: true,
  })
  pool.on('connection', (conn) => {
    conn.query(`SET SESSION time_zone = '+00:00', SESSION group_concat_max_len = 1048576`)
  })

  let catalog = null
  /** Views (with columns) and procedures (with parameters) this MySQL account may use. */
  async function loadCatalog() {
    if (catalog) return catalog
    const [cols] = await pool.query(
      `SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY ORDINAL_POSITION`, [api])
    const relations = new Map()
    for (const { t, c } of cols) {
      if (!relations.has(t)) relations.set(t, new Set())
      relations.get(t).add(c)
    }
    const [routines] = await pool.query(
      `SELECT ROUTINE_NAME AS r FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'`, [hospital])
    const [params] = await pool.query(
      `SELECT SPECIFIC_NAME AS r, PARAMETER_NAME AS p, DATA_TYPE AS t FROM information_schema.PARAMETERS
       WHERE SPECIFIC_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE' AND PARAMETER_MODE = 'IN' ORDER BY SPECIFIC_NAME, ORDINAL_POSITION`, [hospital])
    const procedures = new Map(routines.map(({ r }) => [r, []]))
    for (const { r, p, t } of params) procedures.get(r)?.push({ name: p, type: t })
    catalog = { relations, procedures }
    return catalog
  }

  /** Runs fn on a connection that carries the caller's session token. */
  async function withSession(token, fn) {
    const conn = await pool.getConnection()
    try {
      await conn.query('SET @app_session_token = ?', [token || null])
      return await fn(conn)
    } finally {
      try {
        await conn.query('SET @app_session_token = NULL, @stock_movement_reason = NULL, @stock_movement_order = NULL')
        conn.release()
      } catch {
        conn.destroy()
      }
    }
  }

  async function columnsOf(relation) {
    const { relations } = await loadCatalog()
    if (!IDENT.test(relation) || !relations.has(relation)) throw new ApiError(`Unknown relation: ${relation}`, { status: 404 })
    return relations.get(relation)
  }
  const checkCol = (cols, c) => {
    if (!IDENT.test(c) || !cols.has(c)) throw new ApiError(`Unknown column: ${c}`)
    return `\`${c}\``
  }

  function buildWhere(cols, filters = [], search, params) {
    const parts = []
    for (const f of filters) {
      const col = checkCol(cols, f.col)
      switch (f.op) {
        case 'eq': parts.push(`${col} = ?`); params.push(toParam(f.value)); break
        case 'neq': parts.push(`NOT (${col} <=> ?)`); params.push(toParam(f.value)); break
        case 'gt': parts.push(`${col} > ?`); params.push(toParam(f.value)); break
        case 'gte': parts.push(`${col} >= ?`); params.push(toParam(f.value)); break
        case 'lt': parts.push(`${col} < ?`); params.push(toParam(f.value)); break
        case 'lte': parts.push(`${col} <= ?`); params.push(toParam(f.value)); break
        case 'in': {
          const list = Array.isArray(f.value) ? f.value.map((v) => toParam(v)) : []
          if (!list.length) parts.push('FALSE')
          else { parts.push(`${col} IN (?)`); params.push(list) }
          break
        }
        case 'ilike': parts.push(`CAST(${col} AS CHAR) LIKE ?`); params.push(likeContains(f.value)); break
        case 'is':
          parts.push(f.value === null ? `${col} IS NULL` : f.value === true ? `${col} IS TRUE` : `${col} IS FALSE`)
          break
        default: throw new ApiError(`Unsupported filter: ${f.op}`)
      }
    }
    if (search?.term && sanitizeSearch(search.term)) {
      const term = likeContains(search.term)
      parts.push('(' + search.cols.map((c) => { params.push(term); return `CAST(${checkCol(cols, c)} AS CHAR) LIKE ?` }).join(' OR ') + ')')
    }
    return parts.length ? ` WHERE ${parts.join(' AND ')}` : ''
  }

  async function select(token, relation, q = {}) {
    const cols = await columnsOf(relation)
    const list = !q.columns || q.columns === '*' ? '*' : q.columns.split(',').map((c) => checkCol(cols, c.trim())).join(', ')
    const params = []
    const from = ` FROM \`${api}\`.\`${relation}\``
    const where = buildWhere(cols, q.filters, q.search, params)
    let sql = `SELECT ${list}${q.count ? ', COUNT(*) OVER () AS __total' : ''}${from}${where}`
    if (q.order?.length) {
      sql += ' ORDER BY ' + q.order.map((o) => { const c = checkCol(cols, o.col); return `${c} IS NULL, ${c} ${o.asc === false ? 'DESC' : 'ASC'}` }).join(', ')
    }
    const limit = q.limit === undefined ? null : Math.max(0, Math.floor(Number(q.limit)))
    const offset = Math.max(0, Math.floor(Number(q.offset) || 0))
    if (limit !== null || offset) sql += ` LIMIT ${limit ?? '18446744073709551615'}${offset ? ` OFFSET ${offset}` : ''}`
    return withSession(token, async (conn) => {
      try {
        const [rows] = await conn.query(sql, params)
        let count = null
        if (q.count) {
          count = rows[0]?.__total ?? 0
          if (!rows.length && offset) {
            const [again] = await conn.query(`SELECT COUNT(*) AS n${from}${where}`, params)
            count = again[0].n
          }
          for (const r of rows) delete r.__total
        }
        return { rows, count }
      } catch (e) {
        throw toApiError(e)
      }
    })
  }

  /** CALLs a stored procedure inside a transaction; returns the rows of its final SELECT. */
  async function callRows(token, name, positional) {
    return withSession(token, async (conn) => {
      await conn.beginTransaction()
      try {
        const [results] = await conn.query(`CALL \`${hospital}\`.\`${name}\`(${positional.map(() => '?').join(', ')})`, positional)
        await conn.commit()
        const sets = Array.isArray(results) ? results.filter(Array.isArray) : []
        return sets.length ? sets[sets.length - 1] : []
      } catch (e) {
        await conn.rollback().catch(() => {})
        throw toApiError(e)
      }
    })
  }

  async function procedure(name) {
    const { procedures } = await loadCatalog()
    if (!IDENT.test(name) || !procedures.has(name)) throw new ApiError(`Unknown function: ${name}`, { status: 404 })
    return procedures.get(name)
  }

  /** Named arguments ({ p_doctor_id: … }) → positional values in declaration order. */
  async function positionalArgs(name, args = {}) {
    const params = await procedure(name)
    for (const k of Object.keys(args)) {
      if (!params.some((p) => p.name === k)) throw new ApiError(`Unknown argument ${k} for ${name}`)
    }
    return params.map((p) => toParam(args[p.name]))
  }

  const singleResult = (rows) => {
    if (!rows.length) return null
    const keys = Object.keys(rows[0])
    if (keys.length === 1 && keys[0] === 'result') {
      const v = rows[0].result
      if (typeof v === 'string' && /^[[{]/.test(v)) return reviveDates(JSON.parse(v))
      return v
    }
    return rows[0]
  }

  return {
    pool,
    loadCatalog,
    select,
    withSession,
    async rpc(token, name, args) {
      return singleResult(await callRows(token, name, await positionalArgs(name, args)))
    },
    async rpcRows(token, name, args) {
      return callRows(token, name, await positionalArgs(name, args))
    },
    /** Positional call used by the server itself (auth, storage). */
    async call(token, name, positional) {
      await procedure(name)
      return callRows(token, name, positional.map((v) => (Buffer.isBuffer(v) ? v : toParam(v))))
    },
    async write(token, op, table, values = {}, filters = []) {
      const route = WRITES[table]?.[op]
      if (!route) throw new ApiError(`Writes to ${table} (${op}) are not supported.`, { status: 403, code: '42501' })
      let id = null
      if (op !== 'insert') {
        const f = filters.length === 1 ? filters[0] : null
        if (!f || f.col !== 'id' || f.op !== 'eq') throw new ApiError('Updates and deletes must target a single id.')
        id = String(f.value)
      }
      const [name, positional] = route(values, id)
      await procedure(name)
      const rows = await callRows(token, name, positional.map((v) => toParam(v)))
      return op === 'remove' ? [] : rows
    },
    async end() {
      await pool.end()
    },
  }
}
