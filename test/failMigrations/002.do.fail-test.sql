-- NOTE without BEGIN/END you could end up with partial implemented migration, which is bad
-- Postgres and SQL Server implicitly wrap 1 multi-statement execution in a transaction by default
-- MySQL however does not, and you are left with partial migration implemented
BEGIN
    INSERT INTO widgets (name) VALUES ('widget one');
    INSERT INTO widgets (name) VALUES ('widget two');
    This isn't sql and its gonna break
    INSERT INTO widgets (name) VALUES ('widget three');
END