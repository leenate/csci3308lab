-- Only using one namespace/schema (synonymous in postgresql) due to lack of need for more complex schema structure.

-- Clean db

DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.user_to_user CASCADE;
DROP TABLE IF EXISTS public.books CASCADE;
DROP TABLE IF EXISTS public.user_to_book CASCADE;

-- Create tables and constraints

CREATE TABLE IF NOT EXISTS users (
  user_id INT GENERATED ALWAYS AS IDENTITY,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(100) NOT NULL,
  PRIMARY KEY(user_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  review_id INT GENERATED ALWAYS AS IDENTITY,
  reviewcontents VARCHAR(500) NOT NULL,
  user_id INT NOT NULL,
  CONSTRAINT fk_user_review
    FOREIGN KEY(user_id)
      REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS user_to_user (
  user_one INT NOT NULL,
  user_two INT NOT NULL,
  PRIMARY KEY(user_one,user_two),
  CONSTRAINT fk_userone
    FOREIGN KEY(user_one)
      REFERENCES users(user_id),
  CONSTRAINT fk_usertwo
    FOREIGN KEY(user_two)
      REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS books (
  ISBN BIGINT PRIMARY KEY,
  name VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS user_to_book (
  user_id INT,
  book_ISBN BIGINT, 
  PRIMARY KEY(user_id,book_ISBN),
  CONSTRAINT fk_user_reftable
    FOREIGN KEY(user_id)
      REFERENCES users(user_id),
  CONSTRAINT fk_book_reftable
    FOREIGN KEY(book_ISBN)
      REFERENCES books(ISBN)
);

-- To see tables
-- \dt
-- To see constraints 
-- SELECT conname, conrelid::regclass, confrelid::regclass FROM pg_constraint WHERE conrelid::regclass::text NOT LIKE 'pg_%';
-- To see triggers
-- SELECT tg.oid "Trigger oid", tgname "Trigger Name", conname "Constraint Name", conrelid::regclass "Parent", confrelid::regclass "Child" FROM pg_constraint "con" JOIN pg_trigger "tg" ON tg.tgconstraint = con.oid WHERE conrelid::regclass::text NOT LIKE 'pg_%';