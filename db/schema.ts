import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  points: integer('points').notNull().default(0),
  power: integer('power').notNull().default(0),
  vitality: integer('vitality').notNull().default(0),
  unlocks: text('unlocks').notNull().default('[]'),
  best: integer('best').notNull().default(0),
  squad: integer('squad').notNull().default(0),
});
export const rooms = sqliteTable(
  'rooms',
  {
    code: text('code').primaryKey(),
    host: text('host').notNull(),
    name: text('name').notNull(),
    map: text('map').notNull(),
    seed: text('seed').notNull().default(''),
    days: integer('days').notNull().default(0),
    status: text('status').notNull().default('lobby'),
    snapshot: text('snapshot'),
    updated: integer('updated').notNull(),
  },
  (t) => [index('idx_rooms_status_updated').on(t.status, t.updated)],
);
export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey(),
    room: text('room').notNull(),
    weapon: text('weapon').notNull(),
    input: text('input').notNull().default('{}'),
    updated: integer('updated').notNull(),
  },
  (t) => [index('idx_members_room_updated').on(t.room, t.updated)],
);
export const rewards = sqliteTable(
  'rewards',
  {
    id: text('id').primaryKey(),
    profile: text('profile').notNull(),
    points: integer('points').notNull(),
    wave: integer('wave').notNull(),
    claimed: integer('claimed').notNull().default(0),
  },
  (t) => [index('idx_rewards_profile_claimed').on(t.profile, t.claimed)],
);
export const seeds = sqliteTable(
  'seeds',
  {
    id: text('id').primaryKey(),
    profile: text('profile').notNull(),
    seed: text('seed').notNull(),
    map: text('map').notNull(),
    name: text('name').notNull().default(''),
    best: integer('best').notNull().default(0),
    created: integer('created').notNull(),
  },
  (t) => [index('idx_seeds_profile_created').on(t.profile, t.created)],
);
