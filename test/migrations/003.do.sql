-- Script is for PostgreSQL
-- 
-- Initial Build (Drops things and recreates...)

-- Account vs Client?
-- Account, since website will say "create an account"
-- Later, Users can be added to the Account
CREATE TABLE Account (
	accountId		SERIAL,
	name			VARCHAR(80),
	PRIMARY KEY 	(accountId)
);

CREATE TABLE Users (
	userId				SERIAL,
	email 				VARCHAR(100),
	firstName 			VARCHAR(100),
	lastName 			VARCHAR(100),
	passhash 			VARCHAR(36),
	isAdmin 			BIT,
	accountId			INT,
	PRIMARY KEY 		(userId),
	UNIQUE 				(email),
	FOREIGN KEY 		(accountId) REFERENCES Account (accountId)
);
