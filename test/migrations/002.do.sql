CREATE TABLE migration_002_t1 (
	testcol1 INT,
	testcol2 VARCHAR(30),
	testcol3 BIT
);	

INSERT INTO migration_002_t1 (testcol1, testcol2, testcol3) VALUES (2, '002', B'1');