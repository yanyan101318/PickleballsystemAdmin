CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  data jsonb,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS admin (
  uid character varying(255) NOT NULL,
  email character varying(255) NOT NULL,
  password_hash character varying(255) NOT NULL,
  full_name character varying(255),
  phone character varying(50),
  role character varying(50) DEFAULT 'admin'::character varying,
  photo_url text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (uid)
);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text,
  message text,
  type text DEFAULT 'info'::text,
  is_active boolean DEFAULT true,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  data jsonb,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  court_id uuid,
  court_name text,
  date text,
  time_slot text,
  duration numeric,
  players integer,
  equipment jsonb DEFAULT '[]'::jsonb,
  notes text,
  player_name text,
  user_id text,
  status text DEFAULT 'Pending'::text,
  promo_code text,
  created_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  data jsonb,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  contact_number text,
  customer_payment_status text,
  amount_paid numeric,
  email text,
  booking_date text,
  start_time text,
  end_time text,
  total_amount numeric,
  remaining_balance numeric,
  payment_method text,
  payment_plan character varying(50),
  hourly_rate numeric,
  cash_received numeric,
  change numeric,
  receipt_url text,
  latest_receipt_id numeric,
  last_printed_by text,
  extended_at timestamp with time zone,
  last_printed_at timestamp with time zone,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS borrow_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  borrower_name text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb,
  borrowed_at timestamp with time zone NOT NULL,
  expected_return_at timestamp with time zone,
  actual_return_at timestamp with time zone,
  status text DEFAULT 'borrowed'::text,
  hours_initial numeric,
  estimated_rental_charge numeric,
  extension_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  rental_charge numeric,
  overdue_charge numeric,
  late_hours numeric,
  total_charge numeric,
  data jsonb,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  contact_number text,
  reminder_sent boolean DEFAULT false,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS chats (
  id character varying(255) NOT NULL,
  user_id character varying(255),
  user_name character varying(255),
  email character varying(255),
  last_message text,
  last_message_at timestamp with time zone,
  unread_by_admin boolean DEFAULT false,
  unread_by_customer boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS courts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT ''::text,
  price_per_hour numeric NOT NULL DEFAULT 0,
  amenities jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  data jsonb,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  active_start_time text,
  active_end_time text,
  base_status text,
  override_status character varying(50),
  override_expires_at timestamp with time zone,
  qr_code_image text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS customer_orders (
  id integer NOT NULL DEFAULT nextval('customer_orders_id_seq'::regclass),
  data jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS customers (
  id integer NOT NULL DEFAULT nextval('customers_id_seq'::regclass),
  data jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  contact_number text,
  full_name text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text DEFAULT ''::text,
  notes text DEFAULT ''::text,
  total_qty integer DEFAULT 0,
  available_qty integer DEFAULT 0,
  price_per_hour numeric DEFAULT 0,
  overdue_fine_per_hour numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  data jsonb,
  deleted_at timestamp with time zone,
  type text,
  price numeric,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid,
  match_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  data jsonb,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS membership_requests (
  id integer NOT NULL DEFAULT nextval('membership_requests_id_seq'::regclass),
  data jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS message_reports (
  id character varying(255) NOT NULL,
  message_id character varying(255),
  reporter_id character varying(255),
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS messages (
  id character varying(255) NOT NULL,
  topic text NOT NULL,
  chat_id character varying(255),
  extension text NOT NULL,
  payload jsonb,
  sender_id character varying(255),
  event text,
  sender_name character varying(255),
  text text,
  private boolean DEFAULT false,
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  is_edited boolean DEFAULT false,
  inserted_at timestamp without time zone NOT NULL DEFAULT now(),
  is_deleted boolean DEFAULT false,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  binary_payload bytea,
  is_pinned boolean DEFAULT false,
  skip_broadcast boolean NOT NULL DEFAULT false,
  reactions jsonb DEFAULT '{}'::jsonb,
  image text,
  group_id character varying(255),
  PRIMARY KEY (id, inserted_at, id, id, inserted_at, id)
);

CREATE TABLE IF NOT EXISTS paddle_match_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  court_id text,
  court_name text,
  game_type text,
  players jsonb DEFAULT '[]'::jsonb,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  assign_source text,
  random_filter text,
  created_at timestamp with time zone DEFAULT now(),
  data jsonb,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS paddle_stack (
  id text NOT NULL DEFAULT 'state'::text,
  queue jsonb DEFAULT '[]'::jsonb,
  courts jsonb DEFAULT '[]'::jsonb,
  session_note text DEFAULT ''::text,
  stack_mode text DEFAULT 'mix'::text,
  updated_at timestamp with time zone DEFAULT now(),
  data jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS paddle_stack_state (
  id character varying(50) NOT NULL,
  data jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid,
  user_id text,
  name text,
  court_id uuid,
  court_name text,
  date text,
  time_slot text,
  amount numeric,
  method text,
  payment_status text DEFAULT 'Pending'::text,
  payment_image_url text,
  promo_code text,
  discount numeric,
  created_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  data jsonb,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  rejection_reason text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS receipts (
  id integer NOT NULL DEFAULT nextval('receipts_id_seq'::regclass),
  data jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS sales_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text DEFAULT 'pos'::text,
  items jsonb DEFAULT '[]'::jsonb,
  total numeric,
  payment_method text,
  cash_received numeric,
  change_amount numeric,
  created_at timestamp with time zone DEFAULT now(),
  data jsonb,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS sms_logs (
  id integer NOT NULL DEFAULT nextval('sms_logs_id_seq'::regclass),
  data jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  booking_id text,
  phone_number text,
  phone_raw text,
  message text,
  status text,
  api_response text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS stores (
  id integer NOT NULL DEFAULT nextval('stores_id_seq'::regclass),
  data jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  tournament_id text NOT NULL,
  match_id text NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (tournament_id, match_id)
);

CREATE TABLE IF NOT EXISTS tournaments (
  id text NOT NULL,
  name text,
  format text,
  tournament_format text,
  scoring_mode text,
  champion jsonb,
  created_at bigint,
  data jsonb,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS users (
  id text NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid,
  full_name text,
  id uuid NOT NULL,
  aud character varying(255),
  email text NOT NULL,
  password text,
  role character varying(255),
  phone text,
  email character varying(255),
  encrypted_password character varying(255),
  role text NOT NULL DEFAULT 'admin'::text,
  is_verified boolean NOT NULL DEFAULT false,
  email_confirmed_at timestamp with time zone,
  verification_token text,
  invited_at timestamp with time zone,
  confirmation_token character varying(255),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  confirmation_sent_at timestamp with time zone,
  firebase_uid text,
  data jsonb,
  recovery_token character varying(255),
  recovery_sent_at timestamp with time zone,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  email_change_token_new character varying(255),
  email_change character varying(255),
  password_hash character varying(255),
  email_change_sent_at timestamp with time zone,
  avatar text,
  contact_number text,
  last_sign_in_at timestamp with time zone,
  display_name text,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  phone text DEFAULT NULL::character varying,
  phone_confirmed_at timestamp with time zone,
  phone_change text DEFAULT ''::character varying,
  phone_change_token character varying(255) DEFAULT ''::character varying,
  phone_change_sent_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  email_change_token_current character varying(255) DEFAULT ''::character varying,
  email_change_confirm_status smallint DEFAULT 0,
  banned_until timestamp with time zone,
  reauthentication_token character varying(255) DEFAULT ''::character varying,
  reauthentication_sent_at timestamp with time zone,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  is_anonymous boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id, id, id, id)
);

CREATE TABLE IF NOT EXISTS v2_divisions (
  id character varying(255) NOT NULL,
  tournament_id character varying(255),
  name character varying(255),
  gender character varying(50),
  skill_level character varying(50),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS v2_matches (
  id character varying(255) NOT NULL,
  division_id character varying(255),
  stage character varying(50),
  bracket_group integer,
  match_round integer,
  match_order integer,
  team_a_id character varying(255),
  team_b_id character varying(255),
  court character varying(50),
  status character varying(50) DEFAULT 'Pending'::character varying,
  otp character varying(10),
  score_a integer DEFAULT 0,
  score_b integer DEFAULT 0,
  winner_id character varying(255),
  next_match_id character varying(255),
  next_loser_match_id character varying(255),
  match_type character varying(100),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS v2_teams (
  id character varying(255) NOT NULL,
  division_id character varying(255),
  team_name character varying(255),
  player1 character varying(255),
  player2 character varying(255),
  club_name character varying(255),
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  point_diff integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS v2_tournaments (
  id character varying(255) NOT NULL,
  name character varying(255),
  date date,
  time character varying(50),
  status character varying(50) DEFAULT 'Active'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS vendor_payouts (
  id integer NOT NULL DEFAULT nextval('vendor_payouts_id_seq'::regclass),
  data jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS vendor_tokens (
  id integer NOT NULL DEFAULT nextval('vendor_tokens_id_seq'::regclass),
  data jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

