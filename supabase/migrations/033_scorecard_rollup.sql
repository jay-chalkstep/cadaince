-- Team Cascade & Hierarchy: Scorecard metric rollup support
-- Allows parent metrics to aggregate child metric values

-- Add rollup fields to metrics
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS parent_metric_id UUID REFERENCES metrics(id);
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS aggregation_type TEXT CHECK (
  aggregation_type IN ('sum', 'average', 'min', 'max', 'latest', 'manual')
);
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS is_rollup BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_metrics_team ON metrics(team_id);
CREATE INDEX IF NOT EXISTS idx_metrics_parent ON metrics(parent_metric_id);

-- Metric values history for rollup calculations and audit trail
CREATE TABLE metric_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id UUID REFERENCES metrics(id) NOT NULL,
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID REFERENCES profiles(id),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'integration', 'rollup')),
  notes TEXT
);

CREATE INDEX idx_metric_values_metric ON metric_values(metric_id, recorded_at DESC);

-- Rollup calculation function
CREATE OR REPLACE FUNCTION calculate_metric_rollup(p_metric_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_aggregation_type TEXT;
  v_result NUMERIC;
BEGIN
  SELECT aggregation_type INTO v_aggregation_type
  FROM metrics WHERE id = p_metric_id;

  IF v_aggregation_type IS NULL THEN
    RETURN NULL;
  END IF;

  CASE v_aggregation_type
    WHEN 'sum' THEN
      SELECT COALESCE(SUM(current_value), 0) INTO v_result
      FROM metrics WHERE parent_metric_id = p_metric_id;
    WHEN 'average' THEN
      SELECT COALESCE(AVG(current_value), 0) INTO v_result
      FROM metrics WHERE parent_metric_id = p_metric_id;
    WHEN 'min' THEN
      SELECT MIN(current_value) INTO v_result
      FROM metrics WHERE parent_metric_id = p_metric_id;
    WHEN 'max' THEN
      SELECT MAX(current_value) INTO v_result
      FROM metrics WHERE parent_metric_id = p_metric_id;
    WHEN 'latest' THEN
      SELECT current_value INTO v_result
      FROM metrics WHERE parent_metric_id = p_metric_id
      ORDER BY updated_at DESC LIMIT 1;
    WHEN 'manual' THEN
      -- No automatic calculation for manual
      RETURN NULL;
    ELSE
      RETURN NULL;
  END CASE;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger function to propagate metric updates to parent rollups
CREATE OR REPLACE FUNCTION propagate_metric_update()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_metric_id UUID;
  v_new_value NUMERIC;
BEGIN
  -- Find parent metric
  SELECT parent_metric_id INTO v_parent_metric_id
  FROM metrics WHERE id = NEW.id;

  -- If has parent, recalculate parent's rollup
  WHILE v_parent_metric_id IS NOT NULL LOOP
    v_new_value := calculate_metric_rollup(v_parent_metric_id);

    IF v_new_value IS NOT NULL THEN
      UPDATE metrics
      SET current_value = v_new_value, updated_at = NOW()
      WHERE id = v_parent_metric_id;

      -- Record in history
      INSERT INTO metric_values (metric_id, value, source)
      VALUES (v_parent_metric_id, v_new_value, 'rollup');
    END IF;

    -- Move up the chain
    SELECT parent_metric_id INTO v_parent_metric_id
    FROM metrics WHERE id = v_parent_metric_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for metric value propagation
DROP TRIGGER IF EXISTS metric_update_propagation ON metrics;
CREATE TRIGGER metric_update_propagation
AFTER UPDATE OF current_value ON metrics
FOR EACH ROW
WHEN (OLD.current_value IS DISTINCT FROM NEW.current_value)
EXECUTE FUNCTION propagate_metric_update();
