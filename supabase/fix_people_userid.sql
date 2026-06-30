-- 1. Corrige as pessoas já inseridas (user_id estava NULL por causa do trigger)
UPDATE people
SET user_id = (SELECT id FROM auth.users WHERE email = 'rafaelfernandozaccaro@gmail.com')
WHERE user_id IS NULL;

-- 2. Corrige o trigger para não sobrescrever user_id quando já foi fornecido
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
