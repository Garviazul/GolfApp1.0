
-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Invites table
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invited_by uuid REFERENCES public.profiles(id) NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invites" ON public.invites FOR SELECT USING (auth.uid() = invited_by);
CREATE POLICY "Users can create invites" ON public.invites FOR INSERT WITH CHECK (auth.uid() = invited_by);
CREATE POLICY "Users can update own invites" ON public.invites FOR UPDATE USING (auth.uid() = invited_by);

-- Courses table
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own courses" ON public.courses FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can create own courses" ON public.courses FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own courses" ON public.courses FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own courses" ON public.courses FOR DELETE USING (auth.uid() = owner_id);

-- Course holes table
CREATE TABLE public.course_holes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  hole_number int NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  par int NOT NULL CHECK (par BETWEEN 3 AND 5),
  meters_total int NOT NULL CHECK (meters_total > 0),
  UNIQUE(course_id, hole_number)
);
ALTER TABLE public.course_holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view holes of own courses" ON public.course_holes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = course_holes.course_id AND courses.owner_id = auth.uid()));
CREATE POLICY "Users can insert holes of own courses" ON public.course_holes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = course_holes.course_id AND courses.owner_id = auth.uid()));
CREATE POLICY "Users can update holes of own courses" ON public.course_holes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = course_holes.course_id AND courses.owner_id = auth.uid()));
CREATE POLICY "Users can delete holes of own courses" ON public.course_holes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = course_holes.course_id AND courses.owner_id = auth.uid()));

-- Rounds table
CREATE TABLE public.rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) NOT NULL,
  played_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rounds" ON public.rounds FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can create own rounds" ON public.rounds FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own rounds" ON public.rounds FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own rounds" ON public.rounds FOR DELETE USING (auth.uid() = owner_id);

-- Round holes table (L2 tracking)
CREATE TABLE public.round_holes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
  hole_number int NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  hole_par int NOT NULL CHECK (hole_par BETWEEN 3 AND 5),
  hole_meters_total int NOT NULL,
  score int CHECK (score BETWEEN 1 AND 15),
  mental_commitment text CHECK (mental_commitment IN ('perfecto', 'dude_en_1', 'perdi_el_foco')),
  tee_club text CHECK (tee_club IN ('driver', 'madera', 'hierro')),
  tee_result text CHECK (tee_result IN ('calle', 'izquierda', 'derecha', 'penalidad')),
  approach_zone text CHECK (approach_zone IN ('<60', '60-90', '90-135', '135-180', '>180')),
  approach_target text CHECK (approach_target IN ('centro_green', 'bandera')),
  approach_error_side text CHECK (approach_error_side IN ('lado_bueno', 'lado_malo')),
  gir boolean,
  gir_proximity_bucket text CHECK (gir_proximity_bucket IN ('<3m', '3-5m', '5-10m', '>10m')),
  putts int CHECK (putts BETWEEN 0 AND 9),
  first_putt_bucket text CHECK (first_putt_bucket IN ('<3m', '3-5m', '5-10m', '>10m')),
  first_putt_overridden boolean NOT NULL DEFAULT false,
  scrambling_attempt boolean NOT NULL DEFAULT false,
  scrambling_success boolean,
  penalties int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(round_id, hole_number)
);
ALTER TABLE public.round_holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own round holes" ON public.round_holes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rounds WHERE rounds.id = round_holes.round_id AND rounds.owner_id = auth.uid()));
CREATE POLICY "Users can insert own round holes" ON public.round_holes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.rounds WHERE rounds.id = round_holes.round_id AND rounds.owner_id = auth.uid()));
CREATE POLICY "Users can update own round holes" ON public.round_holes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.rounds WHERE rounds.id = round_holes.round_id AND rounds.owner_id = auth.uid()));
CREATE POLICY "Users can delete own round holes" ON public.round_holes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.rounds WHERE rounds.id = round_holes.round_id AND rounds.owner_id = auth.uid()));
