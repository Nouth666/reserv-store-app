import { createClient } from "@libsql/client";

let client;

export function getDb() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      throw new Error(
        "TURSO_DATABASE_URL / TURSO_AUTH_TOKEN не заданы в переменных окружения сайта Netlify"
      );
    }
    client = createClient({ url, authToken });
  }
  return client;
}

function rowToObj(row, columns) {
  const obj = {};
  for (let i = 0; i < columns.length; i++) obj[columns[i]] = row[i];
  return obj;
}

export async function query(sql, args = []) {
  const rs = await getDb().execute({ sql, args });
  return rs.rows.map((r) => rowToObj(r, rs.columns));
}

export async function queryOne(sql, args = []) {
  const rows = await query(sql, args);
  return rows.length ? rows[0] : null;
}

export async function run(sql, args = []) {
  const rs = await getDb().execute({ sql, args });
  return {
    lastInsertRowid: rs.lastInsertRowid != null ? Number(rs.lastInsertRowid) : null,
    rowsAffected: rs.rowsAffected,
  };
}

export async function batch(statements) {
  // statements: [{sql, args}, ...] — выполняются одной пачкой (используем
  // для операций вида "удалить все варианты и вставить новые").
  return getDb().batch(
    statements.map((s) => ({ sql: s.sql, args: s.args || [] })),
    "write"
  );
}
