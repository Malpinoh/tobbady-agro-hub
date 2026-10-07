-- ===== ROLES & PERMISSIONS =====
CREATE TYPE public.app_role AS ENUM ('ceo','secretary','farm_manager','accountant','sales_officer','storekeeper','farm_worker','administrator');
CREATE TYPE public.tracking_method AS ENUM ('individual','batch');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  module text NOT NULL,
  description text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id AND rp.permission_key = _perm
  )
$$;

CREATE POLICY "Own profile or admin/ceo read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "Read own roles or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'ceo'));
CREATE POLICY "Admin manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

CREATE POLICY "Staff read permissions" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages permissions" ON public.permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "Staff read role perms" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages role perms" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- New user: profile + role (first user becomes administrator, others farm_worker)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.email);
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'administrator') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'administrator');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'farm_worker');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ===== ACTIVITY LOG =====
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit readers" ON public.activity_logs FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'audit.view'));
CREATE POLICY "Staff log own actions" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (
    auth.uid(), lower(TG_OP), TG_TABLE_NAME,
    COALESCE((to_jsonb(NEW)->>'id'), (to_jsonb(OLD)->>'id')),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

-- ===== CORE TABLES =====
CREATE TABLE public.farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, location text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.farm_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name text NOT NULL, section_type text, capacity integer,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.livestock_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  tracking_method public.tracking_method NOT NULL,
  unit_label text NOT NULL DEFAULT 'head',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.breeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_type_id uuid NOT NULL REFERENCES public.livestock_types(id) ON DELETE CASCADE,
  name text NOT NULL, description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (livestock_type_id, name)
);
CREATE TABLE public.animals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_number text NOT NULL UNIQUE,
  livestock_type_id uuid NOT NULL REFERENCES public.livestock_types(id),
  breed_id uuid REFERENCES public.breeds(id),
  farm_section_id uuid REFERENCES public.farm_sections(id),
  sex text, date_of_birth date, acquired_on date,
  acquisition_cost numeric(14,2), estimated_value numeric(14,2),
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.animal_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code text NOT NULL UNIQUE,
  livestock_type_id uuid NOT NULL REFERENCES public.livestock_types(id),
  breed_id uuid REFERENCES public.breeds(id),
  farm_section_id uuid REFERENCES public.farm_sections(id),
  initial_quantity integer NOT NULL DEFAULT 0,
  current_quantity integer NOT NULL DEFAULT 0,
  started_on date, acquisition_cost numeric(14,2), estimated_unit_value numeric(14,2),
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, phone text, email text, address text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, phone text, email text, address text, category text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL, position text, phone text, email text,
  hired_on date, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, amount numeric(14,2) NOT NULL, received_on date NOT NULL DEFAULT current_date,
  description text, reference text, recorded_by uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, amount numeric(14,2) NOT NULL, spent_on date NOT NULL DEFAULT current_date,
  supplier_id uuid REFERENCES public.suppliers(id),
  description text, reference text, recorded_by uuid, approved_by uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id),
  sale_date date NOT NULL DEFAULT current_date,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  status text NOT NULL DEFAULT 'draft',
  sold_by uuid, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  livestock_type_id uuid REFERENCES public.livestock_types(id),
  animal_id uuid REFERENCES public.animals(id),
  batch_id uuid REFERENCES public.animal_batches(id),
  description text,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, sku text UNIQUE, category text, unit text NOT NULL DEFAULT 'unit',
  quantity_on_hand numeric(14,2) NOT NULL DEFAULT 0,
  reorder_level numeric(14,2) NOT NULL DEFAULT 0,
  unit_cost numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  quantity numeric(14,2) NOT NULL,
  unit_cost numeric(14,2),
  supplier_id uuid REFERENCES public.suppliers(id),
  reference text, notes text, performed_by uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  target_role public.app_role,
  title text NOT NULL, body text,
  severity text NOT NULL DEFAULT 'info',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, category text, file_path text,
  related_table text, related_id text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grants + RLS: staff read; module permission to write
DO $$
DECLARE t text; perm text;
  tbls text[][] := ARRAY[
    ['farms','farm.manage'],['farm_sections','farm.manage'],
    ['livestock_types','settings.manage'],['breeds','livestock.manage'],
    ['animals','livestock.manage'],['animal_batches','livestock.manage'],
    ['customers','sales.manage'],['suppliers','procurement.manage'],
    ['employees','staff.manage'],['income','finance.manage'],['expenses','finance.manage'],
    ['sales','sales.manage'],['sale_items','sales.manage'],
    ['inventory_items','inventory.manage'],['inventory_transactions','inventory.manage'],
    ['documents','documents.manage']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(tbls,1) LOOP
    t := tbls[i][1]; perm := tbls[i][2];
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "staff_read" ON public.%I FOR SELECT TO authenticated USING (public.is_staff(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "perm_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), %L))', t, perm);
    EXECUTE format('CREATE POLICY "perm_update" ON public.%I FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), %L))', t, perm);
    EXECUTE format('CREATE POLICY "perm_delete" ON public.%I FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), %L))', t, perm);
    EXECUTE format('CREATE TRIGGER audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_row_change()', t, t);
  END LOOP;
END $$;

-- updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','farms','farm_sections','livestock_types','animals','animal_batches','customers','suppliers','employees','income','expenses','sales','inventory_items'] LOOP
    EXECUTE format('CREATE TRIGGER touch_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t, t);
  END LOOP;
END $$;

CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_row_change();
CREATE TRIGGER audit_role_permissions AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.log_row_change();

-- Notifications
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipient read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (target_role IS NOT NULL AND public.has_role(auth.uid(), target_role)));
CREATE POLICY "Recipient mark read" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR (target_role IS NOT NULL AND public.has_role(auth.uid(), target_role)));
CREATE POLICY "Admin creates" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'notifications.send'));
CREATE POLICY "Admin deletes" ON public.notifications FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'administrator'));

-- ===== SEED: livestock types =====
INSERT INTO public.livestock_types (name, slug, tracking_method, unit_label, sort_order) VALUES
 ('Cattle','cattle','individual','head',1),
 ('Goat','goat','individual','head',2),
 ('Ram / Sheep','sheep','individual','head',3),
 ('Turkey','turkey','batch','bird',4),
 ('Broiler','broiler','batch','bird',5),
 ('Noiler','noiler','batch','bird',6);

-- ===== SEED: permissions =====
INSERT INTO public.permissions (key, module, description) VALUES
 ('dashboard.view','dashboard','View business dashboard'),
 ('ceo.view','ceo','Access CEO Office'),
 ('secretary.view','secretary','Access Secretary Office'),
 ('farm.view','farm','View farm operations'),
 ('farm.manage','farm','Manage farms and sections'),
 ('livestock.view','livestock','View livestock'),
 ('livestock.manage','livestock','Manage animals and batches'),
 ('finance.view','finance','View finance'),
 ('finance.manage','finance','Record income and expenses'),
 ('finance.approve','finance','Approve expenses'),
 ('sales.view','sales','View sales and customers'),
 ('sales.manage','sales','Record sales and customers'),
 ('inventory.view','inventory','View inventory'),
 ('inventory.manage','inventory','Manage inventory'),
 ('procurement.view','procurement','View suppliers and procurement'),
 ('procurement.manage','procurement','Manage suppliers and procurement'),
 ('staff.view','staff','View staff'),
 ('staff.manage','staff','Manage staff records'),
 ('users.manage','staff','Manage users and roles'),
 ('reports.view','reports','View reports and analytics'),
 ('notifications.view','notifications','View notifications'),
 ('notifications.send','notifications','Send notifications'),
 ('documents.manage','documents','Manage documents'),
 ('settings.view','settings','View settings'),
 ('settings.manage','settings','Manage system configuration'),
 ('audit.view','audit','View activity logs');

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'administrator', key FROM public.permissions;

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'ceo', key FROM public.permissions WHERE key NOT IN ('users.manage','settings.manage');

INSERT INTO public.role_permissions (role, permission_key) VALUES
 ('secretary','dashboard.view'),('secretary','secretary.view'),('secretary','notifications.view'),('secretary','notifications.send'),('secretary','documents.manage'),('secretary','staff.view'),('secretary','settings.view'),
 ('farm_manager','dashboard.view'),('farm_manager','farm.view'),('farm_manager','farm.manage'),('farm_manager','livestock.view'),('farm_manager','livestock.manage'),('farm_manager','inventory.view'),('farm_manager','procurement.view'),('farm_manager','staff.view'),('farm_manager','reports.view'),('farm_manager','notifications.view'),('farm_manager','settings.view'),
 ('accountant','dashboard.view'),('accountant','finance.view'),('accountant','finance.manage'),('accountant','sales.view'),('accountant','procurement.view'),('accountant','reports.view'),('accountant','notifications.view'),('accountant','settings.view'),
 ('sales_officer','dashboard.view'),('sales_officer','sales.view'),('sales_officer','sales.manage'),('sales_officer','livestock.view'),('sales_officer','notifications.view'),('sales_officer','settings.view'),
 ('storekeeper','dashboard.view'),('storekeeper','inventory.view'),('storekeeper','inventory.manage'),('storekeeper','procurement.view'),('storekeeper','procurement.manage'),('storekeeper','notifications.view'),('storekeeper','settings.view'),
 ('farm_worker','farm.view'),('farm_worker','livestock.view'),('farm_worker','notifications.view'),('farm_worker','settings.view');