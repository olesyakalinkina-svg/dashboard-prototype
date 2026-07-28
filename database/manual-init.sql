-- Full database initialization (order matters)
\echo 'Creating schema...'
\i 01_schema.sql

\echo 'Loading reference data...'
\i 02_seed.sql

\echo 'Loading fact data...'
\i 03_seed_facts.sql

\echo 'Creating BI views...'
\i 04_views.sql

\echo 'Done. Hockey club BI database is ready.'
