import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  index,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const tstz = (name: string) => timestamp(name, { withTimezone: true });

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name_en: text('name_en').notNull(),
  name_ur: text('name_ur').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  category_id: integer('category_id').references(() => categories.id),
  name_en: text('name_en').notNull(),
  name_ur: text('name_ur').notNull().default(''),
  brand: text('brand'),
  description_en: text('description_en'),
  description_ur: text('description_ur'),
  image_url: text('image_url'),
  created_at: tstz('created_at').notNull().defaultNow(),
  updated_at: tstz('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const variants = pgTable('variants', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull().references(() => products.id),
  item_code: text('item_code').notNull().unique(),
  size: text('size'),
  /** When sold_by_weight is true, price_paisa is per kg */
  price_paisa: integer('price_paisa').notNull(),
  sold_by_weight: boolean('sold_by_weight').notNull().default(false),
  is_active: boolean('is_active').notNull().default(true),
  last_synced_at: tstz('last_synced_at'),
  created_at: tstz('created_at').notNull().defaultNow(),
  updated_at: tstz('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const stock = pgTable('stock', {
  id: serial('id').primaryKey(),
  variant_id: integer('variant_id').notNull().references(() => variants.id),
  location_id: integer('location_id').notNull().default(1),
  on_hand: integer('on_hand').notNull().default(0),
  reserved: integer('reserved').notNull().default(0),
  safety_buffer: integer('safety_buffer').notNull().default(2),
  updated_at: tstz('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique('stock_variant_location_uq').on(t.variant_id, t.location_id),
  check('stock_reserved_gte_0', sql`${t.reserved} >= 0`),
]);

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  created_at: tstz('created_at').notNull().defaultNow(),
});

export const delivery_zones = pgTable('delivery_zones', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  fee_paisa: integer('fee_paisa').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  customer_id: integer('customer_id').notNull().references(() => customers.id),
  delivery_zone_id: integer('delivery_zone_id').references(() => delivery_zones.id),
  label: text('label'),
  address_text: text('address_text').notNull(),
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lng: numeric('lng', { precision: 9, scale: 6 }),
  phone: text('phone').notNull(),
});

export const riders = pgTable('riders', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  active: boolean('active').notNull().default(true),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  customer_id: integer('customer_id').notNull().references(() => customers.id),
  address_id: integer('address_id').notNull().references(() => addresses.id),
  rider_id: integer('rider_id').references(() => riders.id),
  status: text('status').notNull(),
  oos_preference: text('oos_preference').notNull(),
  address_text: text('address_text').notNull(),
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lng: numeric('lng', { precision: 9, scale: 6 }),
  phone: text('phone').notNull(),
  subtotal_paisa: integer('subtotal_paisa').notNull().default(0),
  delivery_fee_paisa: integer('delivery_fee_paisa').notNull().default(0),
  total_paisa: integer('total_paisa').notNull().default(0),
  created_at: tstz('created_at').notNull().defaultNow(),
  updated_at: tstz('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index('orders_status_idx').on(t.status),
  index('orders_customer_id_idx').on(t.customer_id),
  check('orders_status_check', sql`${t.status} IN ('pending', 'confirmed', 'picking', 'out_for_delivery', 'delivered', 'cash_collected', 'cancelled')`),
  check('orders_oos_preference_check', sql`${t.oos_preference} IN ('substitute', 'remove', 'call')`),
]);

export const order_items = pgTable('order_items', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').notNull().references(() => orders.id),
  variant_id: integer('variant_id').notNull().references(() => variants.id),
  product_name: text('product_name').notNull(),
  ordered_qty: integer('ordered_qty').notNull().default(0),
  picked_qty: integer('picked_qty'),
  ordered_weight_g: integer('ordered_weight_g'),
  picked_weight_g: integer('picked_weight_g'),
  unit_price_paisa: integer('unit_price_paisa').notNull(),
  substituted_by_variant_id: integer('substituted_by_variant_id').references(() => variants.id),
}, (t) => [
  index('order_items_order_id_idx').on(t.order_id),
]);

export const order_events = pgTable('order_events', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').notNull().references(() => orders.id),
  from_status: text('from_status'),
  to_status: text('to_status').notNull(),
  actor: text('actor'),
  created_at: tstz('created_at').notNull().defaultNow(),
}, (t) => [
  index('order_events_order_id_idx').on(t.order_id),
]);

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').notNull().references(() => orders.id),
  method: text('method').notNull().default('cod'),
  amount_paisa: integer('amount_paisa').notNull(),
  status: text('status').notNull().default('pending'),
  collected_by: text('collected_by'),
  collected_at: tstz('collected_at'),
}, (t) => [
  check('payments_method_check', sql`${t.method} IN ('cod')`),
  check('payments_status_check', sql`${t.status} IN ('pending', 'collected')`),
]);
