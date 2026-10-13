-- Add sensible default breed options for the livestock types that were missing them.
-- Idempotent: preserves any breed records already configured by the farm.
INSERT INTO public.breeds (livestock_type_id, name, description)
SELECT lt.id, seed.name, seed.description
FROM (
  VALUES
    ('goat', 'West African Dwarf', 'Small indigenous goat breed common in humid West Africa.'),
    ('goat', 'Red Sokoto', 'Indigenous Nigerian goat also known as Maradi goat.'),
    ('goat', 'Sahel', 'Long-legged goat adapted to dry Sahelian conditions.'),
    ('goat', 'Kano Brown', 'Indigenous Nigerian goat type commonly associated with northern Nigeria.'),
    ('turkey', 'Broad Breasted White', 'Commercial white-feathered meat turkey variety.'),
    ('turkey', 'Broad Breasted Bronze', 'Commercial bronze-feathered meat turkey variety.'),
    ('turkey', 'Beltsville Small White', 'Small white turkey variety.'),
    ('turkey', 'Royal Palm', 'Distinctive ornamental turkey variety.')
) AS seed(type_slug, name, description)
JOIN public.livestock_types lt ON lt.slug = seed.type_slug
ON CONFLICT (livestock_type_id, name) DO NOTHING;
