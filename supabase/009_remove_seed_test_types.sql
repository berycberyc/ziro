-- Migration: remove the pre-seeded test types (НИШ/БИЛ/РФМШ)
-- so all test types are created by admin through the UI instead.
-- This also removes any session_test_types links to them (cascade).
-- Run this in Supabase SQL Editor

delete from test_types where code in ('NISH', 'BIL', 'RFMSH');
