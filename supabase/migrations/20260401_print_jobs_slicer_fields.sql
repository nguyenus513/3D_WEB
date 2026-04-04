-- Migration: Add PrusaSlicer output fields to print_jobs
-- These fields store the precise slicer outputs so order records fully reflect
-- what the customer was quoted (material breakdown, print time, layer count, source).

ALTER TABLE print_jobs
    ADD COLUMN IF NOT EXISTS support_material_g  NUMERIC,
    ADD COLUMN IF NOT EXISTS print_time_minutes  NUMERIC,
    ADD COLUMN IF NOT EXISTS layer_count         INTEGER,
    ADD COLUMN IF NOT EXISTS slicer_source       TEXT;

COMMENT ON COLUMN print_jobs.support_material_g IS 'Support material in grams (FDM) or support resin in ml (SLA) from PrusaSlicer';
COMMENT ON COLUMN print_jobs.print_time_minutes IS 'PrusaSlicer estimated print time in minutes';
COMMENT ON COLUMN print_jobs.layer_count        IS 'Total number of layers from PrusaSlicer G-code / SL1 config';
COMMENT ON COLUMN print_jobs.slicer_source      IS 'Quote source: prusaslicer_exact | cache | sla_geometry_calc';
