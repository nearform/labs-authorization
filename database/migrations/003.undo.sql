
ALTER TABLE users
  ALTER COLUMN name TYPE VARCHAR(50);

ALTER TABLE organization_policies
  ALTER COLUMN org_id TYPE VARCHAR(20);
