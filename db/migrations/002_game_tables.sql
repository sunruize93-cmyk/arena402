-- ============================================================
-- arena402 — 002_game_tables.sql
-- Game tables per FRONTEND_GUIDE §6 / GAME_DESIGN §9.
-- Run in Supabase SQL Editor. Idempotent (IF NOT EXISTS).
-- ============================================================

-- 游戏局
create table if not exists games (
  id            uuid primary key default gen_random_uuid(),
  status        text not null default 'waiting' check (status in ('waiting','playing','finished')),
  total_rounds  int  not null default 8,
  current_round int  not null default 0,
  created_at    timestamptz not null default now()
);

-- 玩家（游戏内）
create table if not exists game_players (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  agent_id      uuid not null,
  starting_cash numeric not null default 100,
  current_cash  numeric not null default 100,
  failed_count  int not null default 0,
  unique (game_id, agent_id)
);

-- 持仓（每回合快照可另存;此表为当前态）
create table if not exists holdings (
  id       uuid primary key default gen_random_uuid(),
  game_id  uuid not null references games(id) on delete cascade,
  agent_id uuid not null,
  good     text not null,
  qty      int  not null default 0,
  unique (game_id, agent_id, good)
);

-- 回合
create table if not exists rounds (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references games(id) on delete cascade,
  round_no   int  not null,
  phase      text not null default 'idle' check (phase in ('idle','decide','pairing','negotiate','settle')),
  started_at timestamptz,
  ended_at   timestamptz,
  unique (game_id, round_no)
);

-- 池子（FCFS 配对依据: entered_at）
create table if not exists pools (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references rounds(id) on delete cascade,
  good       text not null,
  direction  text not null check (direction in ('buy','sell')),
  agent_id   uuid not null,
  entered_at timestamptz not null default now()
);

-- 配对
create table if not exists pairings (
  id        uuid primary key default gen_random_uuid(),
  round_id  uuid not null references rounds(id) on delete cascade,
  good      text not null,
  buyer_id  uuid not null,
  seller_id uuid not null,
  result    text not null default 'pending' check (result in ('pending','negotiating','done'))
);

-- 协商
create table if not exists negotiations (
  id          uuid primary key default gen_random_uuid(),
  pairing_id  uuid not null references pairings(id) on delete cascade,
  result      text check (result in ('dealt','broke','timeout')),
  final_price numeric,
  turns_used  int not null default 0
);

-- 协商消息（博弈日志核心）
create table if not exists neg_messages (
  id             uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references negotiations(id) on delete cascade,
  turn           int  not null,
  from_role      text not null check (from_role in ('buyer','seller')),
  type           text not null check (type in ('propose','accept','reject')),
  price          numeric,
  message        text check (char_length(message) <= 100),
  created_at     timestamptz not null default now()
);

-- 结算（x402 链上）
create table if not exists settlements (
  id             uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references negotiations(id) on delete cascade,
  x402_tx_hash   text,
  amount         numeric not null,
  status         text not null default 'pending' check (status in ('pending','confirmed','failed'))
);

-- 事件
create table if not exists game_events (
  id              uuid primary key default gen_random_uuid(),
  round_id        uuid not null references rounds(id) on delete cascade,
  type            text not null check (type in ('deterministic','probabilistic')),
  description     text not null,
  params          jsonb,
  revealed_result text
);

-- 结算价表（终场）
create table if not exists settle_prices (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  good        text not null,
  final_price numeric not null,
  unique (game_id, good)
);

-- 排名
create table if not exists game_rankings (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references games(id) on delete cascade,
  agent_id   uuid not null,
  net_worth  numeric not null,
  rank       int not null,
  side_ranks jsonb,
  unique (game_id, agent_id)
);

-- ---- indexes for realtime filters + FCFS ordering ----
create index if not exists idx_rounds_game        on rounds(game_id);
create index if not exists idx_pools_round_fcfs   on pools(round_id, good, direction, entered_at);
create index if not exists idx_pairings_round     on pairings(round_id);
create index if not exists idx_negmsg_negotiation on neg_messages(negotiation_id, turn);
create index if not exists idx_players_game       on game_players(game_id);
create index if not exists idx_holdings_game      on holdings(game_id, agent_id);

-- ---- RLS: public read (anon), writes via service role only ----
do $$
declare t text;
begin
  foreach t in array array['games','game_players','holdings','rounds','pools','pairings',
                           'negotiations','neg_messages','settlements','game_events',
                           'settle_prices','game_rankings']
  loop
    execute format('alter table %I enable row level security', t);
    begin
      execute format('create policy "public read %s" on %I for select using (true)', t, t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---- realtime publication ----
do $$
declare t text;
begin
  foreach t in array array['games','rounds','pools','pairings','negotiations',
                           'neg_messages','settlements','game_events','game_rankings']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
