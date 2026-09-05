CREATE TABLE public.passports (
  id UUID PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passports TO anon, authenticated;
GRANT ALL ON public.passports TO service_role;
ALTER TABLE public.passports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "App can read passports" ON public.passports FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "App can insert passports" ON public.passports FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "App can update passports" ON public.passports FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "App can delete passports" ON public.passports FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.app_state (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_state TO anon, authenticated;
GRANT ALL ON public.app_state TO service_role;
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "App can read state" ON public.app_state FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "App can insert state" ON public.app_state FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "App can update state" ON public.app_state FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "App can delete state" ON public.app_state FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_passports_updated_at BEFORE UPDATE ON public.passports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_app_state_updated_at BEFORE UPDATE ON public.app_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();