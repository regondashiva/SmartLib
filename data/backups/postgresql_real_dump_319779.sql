-- ============================================================================
-- SmartLib Real PostgreSQL SQL Dump (DDL + Relational DML)
-- Server Version : PostgreSQL 18.6 (ac70818) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit
-- Source Schema  : smartlib_pg_src_319779
-- Created At     : 2026-11-09T18:52:11.802Z
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS "{{TARGET_SCHEMA}}";
CREATE TABLE "{{TARGET_SCHEMA}}"."publishers" (
        "id" VARCHAR(64) PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL UNIQUE
      );
CREATE TABLE "{{TARGET_SCHEMA}}"."categories" (
        "id" VARCHAR(64) PRIMARY KEY,
        "name" VARCHAR(100) NOT NULL UNIQUE,
        "code" VARCHAR(20)
      );
CREATE TABLE "{{TARGET_SCHEMA}}"."books" (
        "id" VARCHAR(64) PRIMARY KEY,
        "title" VARCHAR(500) NOT NULL,
        "isbn13" VARCHAR(20) UNIQUE,
        "publisher_id" VARCHAR(64) REFERENCES "{{TARGET_SCHEMA}}"."publishers"("id") ON DELETE SET NULL,
        "category_id" VARCHAR(64) REFERENCES "{{TARGET_SCHEMA}}"."categories"("id") ON DELETE SET NULL,
        "call_number" VARCHAR(100) NOT NULL
      );
CREATE TABLE "{{TARGET_SCHEMA}}"."rfid_tags" (
        "id" VARCHAR(64) PRIMARY KEY,
        "epc" VARCHAR(64) NOT NULL UNIQUE,
        "eas_armed" BOOLEAN NOT NULL DEFAULT TRUE,
        "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
      );
CREATE TABLE "{{TARGET_SCHEMA}}"."book_items" (
        "id" VARCHAR(64) PRIMARY KEY,
        "book_id" VARCHAR(64) NOT NULL REFERENCES "{{TARGET_SCHEMA}}"."books"("id") ON DELETE RESTRICT,
        "accession_number" VARCHAR(50) NOT NULL UNIQUE,
        "barcode" VARCHAR(50) UNIQUE,
        "rfid_tag_id" VARCHAR(64) UNIQUE REFERENCES "{{TARGET_SCHEMA}}"."rfid_tags"("id") ON DELETE SET NULL,
        "status" VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
        "shelf_location" VARCHAR(100) NOT NULL
      );
CREATE TABLE "{{TARGET_SCHEMA}}"."members" (
        "id" VARCHAR(64) PRIMARY KEY,
        "card_number" VARCHAR(50) NOT NULL UNIQUE,
        "full_name" VARCHAR(200) NOT NULL,
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
      );
CREATE TABLE "{{TARGET_SCHEMA}}"."circulations" (
        "id" VARCHAR(64) PRIMARY KEY,
        "book_item_id" VARCHAR(64) NOT NULL REFERENCES "{{TARGET_SCHEMA}}"."book_items"("id") ON DELETE RESTRICT,
        "member_id" VARCHAR(64) NOT NULL REFERENCES "{{TARGET_SCHEMA}}"."members"("id") ON DELETE RESTRICT,
        "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        "due_date" TIMESTAMP NOT NULL
      );
CREATE TABLE "{{TARGET_SCHEMA}}"."fines" (
        "id" VARCHAR(64) PRIMARY KEY,
        "circulation_id" VARCHAR(64) NOT NULL REFERENCES "{{TARGET_SCHEMA}}"."circulations"("id") ON DELETE CASCADE,
        "member_id" VARCHAR(64) NOT NULL REFERENCES "{{TARGET_SCHEMA}}"."members"("id") ON DELETE RESTRICT,
        "amount" NUMERIC(10,2) NOT NULL,
        "status" VARCHAR(32) NOT NULL DEFAULT 'UNPAID'
      );
INSERT INTO "{{TARGET_SCHEMA}}"."publishers" ("id", "name") VALUES ('pub-1', 'MIT Press'), ('pub-2', 'O''Reilly Media');
INSERT INTO "{{TARGET_SCHEMA}}"."categories" ("id", "name", "code") VALUES ('cat-1', 'Computer Science', '004'), ('cat-2', 'Distributed Systems', '005.2');
INSERT INTO "{{TARGET_SCHEMA}}"."books" ("id", "title", "isbn13", "publisher_id", "category_id", "call_number") VALUES
        ('book-1', 'Structure and Interpretation of Computer Programs', '9780262510875', 'pub-1', 'cat-1', '005.133 ABEL'),
        ('book-2', 'Designing Data-Intensive Applications', '9781449373320', 'pub-2', 'cat-2', '005.74 KLEP');
INSERT INTO "{{TARGET_SCHEMA}}"."rfid_tags" ("id", "epc", "eas_armed", "status") VALUES
        ('tag-1', '3034257BF400B5B000000001', FALSE, 'ACTIVE'),
        ('tag-2', '3034257BF400B5B000000002', TRUE, 'ACTIVE');
INSERT INTO "{{TARGET_SCHEMA}}"."book_items" ("id", "book_id", "accession_number", "barcode", "rfid_tag_id", "status", "shelf_location") VALUES
        ('item-1', 'book-1', 'ACC-5B-00001', 'BC-ACC-5B-00001', 'tag-1', 'ISSUED', 'STACK-A/SHELF-01'),
        ('item-2', 'book-2', 'ACC-5B-00002', 'BC-ACC-5B-00002', 'tag-2', 'AVAILABLE', 'STACK-A/SHELF-02');
INSERT INTO "{{TARGET_SCHEMA}}"."members" ("id", "card_number", "full_name", "email", "status") VALUES
        ('mem-1', 'MEM-5B-001', 'Dr. Kavita Raman', 'kavita.raman@smartlib.edu', 'ACTIVE'),
        ('mem-2', 'MEM-5B-002', 'Rohan Deshmukh', 'rohan.d@smartlib.edu', 'ACTIVE');
INSERT INTO "{{TARGET_SCHEMA}}"."circulations" ("id", "book_item_id", "member_id", "status", "due_date") VALUES
        ('circ-1', 'item-1', 'mem-1', 'ACTIVE', '2026-11-24 12:00:00');
INSERT INTO "{{TARGET_SCHEMA}}"."fines" ("id", "circulation_id", "member_id", "amount", "status") VALUES
        ('fine-1', 'circ-1', 'mem-1', 15.00, 'UNPAID');
