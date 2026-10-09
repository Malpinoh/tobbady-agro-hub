
-- TOBADDY AGRO: flexible livestock locations

ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS farm_id uuid
    REFERENCES public.farms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_description text;

ALTER TABLE public.animal_batches
  ADD COLUMN IF NOT EXISTS farm_id uuid
    REFERENCES public.farms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_description text;

-- Preserve existing farm assignments from sections.
UPDATE public.animals AS a
SET farm_id = fs.farm_id
FROM public.farm_sections AS fs
WHERE a.farm_section_id = fs.id
  AND a.farm_id IS NULL;

UPDATE public.animal_batches AS b
SET farm_id = fs.farm_id
FROM public.farm_sections AS fs
WHERE b.farm_section_id = fs.id
  AND b.farm_id IS NULL;

-- Ensure a selected section belongs to the selected farm.
CREATE OR REPLACE FUNCTION public.sync_livestock_farm_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  section_farm_id uuid;
BEGIN
  IF NEW.farm_section_id IS NOT NULL THEN
    SELECT farm_id
      INTO section_farm_id
    FROM public.farm_sections
    WHERE id = NEW.farm_section_id;

    IF section_farm_id IS NULL THEN
      RAISE EXCEPTION 'Selected livestock section does not exist';
    END IF;

    IF NEW.farm_id IS NULL THEN
      NEW.farm_id := section_farm_id;
    ELSIF NEW.farm_id <> section_farm_id THEN
      RAISE EXCEPTION
        'Selected section must belong to the selected farm';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS animals_sync_farm_location
  ON public.animals;

CREATE TRIGGER animals_sync_farm_location
BEFORE INSERT OR UPDATE OF farm_id, farm_section_id
ON public.animals
FOR EACH ROW
EXECUTE FUNCTION public.sync_livestock_farm_location();

DROP TRIGGER IF EXISTS animal_batches_sync_farm_location
  ON public.animal_batches;

CREATE TRIGGER animal_batches_sync_farm_location
BEFORE INSERT OR UPDATE OF farm_id, farm_section_id
ON public.animal_batches
FOR EACH ROW
EXECUTE FUNCTION public.sync_livestock_farm_location();
