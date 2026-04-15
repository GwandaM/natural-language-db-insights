import { Pool } from "pg";

const connectionString = process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NO_SSL;

// Disable SSL for local PostgreSQL (localhost / 127.0.0.1 / sslmode=disable in URL)
const isLocal =
  !connectionString ||
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1") ||
  connectionString.includes("sslmode=disable");

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 10,
});

type SqlResult<T = Record<string, unknown>> = {
  rows: T[];
  rowCount: number | null;
};

async function sqlTag<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<SqlResult<T>> {
  let text = "";
  const params: unknown[] = [];

  strings.forEach((str, i) => {
    text += str;
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  });

  const result = await pool.query<T>(text, params);
  return { rows: result.rows, rowCount: result.rowCount };
}

sqlTag.query = async function <T = Record<string, unknown>>(
  text: string,
  values?: unknown[],
): Promise<SqlResult<T>> {
  const result = await pool.query<T>(text, values);
  return { rows: result.rows, rowCount: result.rowCount };
};

export const sql = sqlTag;
