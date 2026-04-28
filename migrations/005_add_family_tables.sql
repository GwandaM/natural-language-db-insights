-- Migration: 005_add_family_tables
-- Author:   Claude
-- Date:     2026-04-28
--
-- Summary:
--   Introduces the family investing model.
--   Adds `family` and `family_member` tables so that individual clients can
--   be grouped into household units. This enables household-level AUM views,
--   life-stage planning across generations, and intergenerational wealth insights.
--
-- Rollback:
--   Forward-only. Drop family_member and family to undo.

BEGIN;

/* ==================================================================
   FAMILY
   ================================================================== */
CREATE TABLE IF NOT EXISTS family (
  family_id         SERIAL PRIMARY KEY,
  advisor_id        INT NOT NULL REFERENCES advisor(advisor_id) ON DELETE CASCADE,
  family_name       VARCHAR(150) NOT NULL,
  family_goal       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_advisor ON family(advisor_id);

/* ==================================================================
   FAMILY MEMBER
   ================================================================== */
CREATE TYPE IF NOT EXISTS family_relationship AS ENUM (
  'primary', 'spouse', 'child', 'parent', 'sibling', 'other'
);

CREATE TABLE IF NOT EXISTS family_member (
  family_member_id  SERIAL PRIMARY KEY,
  family_id         INT NOT NULL REFERENCES family(family_id) ON DELETE CASCADE,
  client_id         INT NOT NULL REFERENCES client(client_id) ON DELETE CASCADE,
  relationship      family_relationship NOT NULL DEFAULT 'primary',
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (family_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_family_member_family  ON family_member(family_id);
CREATE INDEX IF NOT EXISTS idx_family_member_client  ON family_member(client_id);

/* ==================================================================
   SEED DEMO FAMILY GROUPINGS
   Groups clients by shared last name within the same advisor book.
   Creates one family per unique (advisor_id, last_name) pair that has
   at least 2 clients, plus singleton families for clients with unique names.
   ================================================================== */

-- Step 1: Create families for groups that share a last name
INSERT INTO family (advisor_id, family_name, family_goal)
SELECT
  c.advisor_id,
  c.last_name || ' Family',
  CASE
    WHEN COUNT(*) >= 3 THEN 'Multi-generational wealth preservation and education funding'
    WHEN MAX(EXTRACT(YEAR FROM AGE(c.date_of_birth))) > 55 THEN 'Retirement sustainability and estate planning'
    ELSE 'Wealth accumulation and long-term family financial security'
  END
FROM client c
WHERE c.last_name IS NOT NULL
GROUP BY c.advisor_id, c.last_name
HAVING COUNT(*) >= 2
ON CONFLICT DO NOTHING;

-- Step 2: For advisors with no multi-member families, create individual families
-- for clients not yet in a family (those with unique last names)
INSERT INTO family (advisor_id, family_name, family_goal)
SELECT DISTINCT
  c.advisor_id,
  c.first_name || ' ' || c.last_name || ' Household',
  'Individual wealth building and retirement planning'
FROM client c
WHERE c.last_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM family f
    WHERE f.advisor_id = c.advisor_id
      AND f.family_name = c.last_name || ' Family'
  )
ON CONFLICT DO NOTHING;

-- Step 3: Link multi-member families — oldest member is primary
WITH family_lookup AS (
  SELECT f.family_id, f.advisor_id, f.family_name,
         REGEXP_REPLACE(f.family_name, ' Family$', '') AS last_name_part
  FROM family f
  WHERE f.family_name LIKE '% Family'
),
ranked_members AS (
  SELECT
    fl.family_id,
    c.client_id,
    c.date_of_birth,
    ROW_NUMBER() OVER (
      PARTITION BY fl.family_id
      ORDER BY c.date_of_birth ASC NULLS LAST
    ) AS age_rank
  FROM family_lookup fl
  JOIN client c ON c.advisor_id = fl.advisor_id
                AND c.last_name = fl.last_name_part
)
INSERT INTO family_member (family_id, client_id, relationship, is_primary)
SELECT
  rm.family_id,
  rm.client_id,
  CASE rm.age_rank
    WHEN 1 THEN 'primary'::family_relationship
    WHEN 2 THEN 'spouse'::family_relationship
    ELSE        'child'::family_relationship
  END,
  rm.age_rank = 1
FROM ranked_members rm
ON CONFLICT (family_id, client_id) DO NOTHING;

-- Step 4: Link singleton household families
WITH singleton_lookup AS (
  SELECT
    f.family_id,
    f.advisor_id,
    REGEXP_REPLACE(f.family_name, ' Household$', '') AS full_name_part
  FROM family f
  WHERE f.family_name LIKE '% Household'
)
INSERT INTO family_member (family_id, client_id, relationship, is_primary)
SELECT
  sl.family_id,
  c.client_id,
  'primary'::family_relationship,
  TRUE
FROM singleton_lookup sl
JOIN client c ON c.advisor_id = sl.advisor_id
             AND (c.first_name || ' ' || c.last_name) = sl.full_name_part
WHERE NOT EXISTS (
  SELECT 1 FROM family_member fm WHERE fm.client_id = c.client_id
)
ON CONFLICT (family_id, client_id) DO NOTHING;

COMMIT;
