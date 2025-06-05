import { pgTable, serial, text, integer, timestamp, uuid, jsonb, boolean, primaryKey } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters"

export const chats = pgTable('chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  messages: jsonb('messages').$type<any[]>(), // 存储消息数组
  urlId: text('url_id').notNull(),
  description: text('description'),
  timestamp: timestamp('timestamp').defaultNow(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
});

// 如果需要其他相关表，也可以在这里定义
export const previews = pgTable('previews', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').references(() => chats.id),
  baseUrl: text('base_url').notNull(),
  port: text('port'),
  ready: boolean('ready').default(false),
  isLoading: boolean('is_loading').default(true),
  loadingProgress: integer('loading_progress').default(0),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
})
 
export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    {
      compoundKey: primaryKey({
        columns: [account.provider, account.providerAccountId],
      }),
    },
  ]
)
 
export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})
 
export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    {
      compositePk: primaryKey({
        columns: [verificationToken.identifier, verificationToken.token],
      }),
    },
  ]
)
 
export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => [
    {
      compositePK: primaryKey({
        columns: [authenticator.userId, authenticator.credentialID],
      }),
    },
  ]
)


export const credits = pgTable(
  "credits",
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credits: integer("credits").notNull().default(0),
    usage: integer("usage").notNull().default(0),
    modelName: text("modelName"),
    provider: text("provider"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  }
)


export const deploy = pgTable('deploy', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id),
  chatId: uuid('chat_id').references(() => chats.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  siteName: text("sit_name"),
  siteId: text("site_id"),
  status: text("status"),
  url: text("url"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})
