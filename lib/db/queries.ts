import { db } from './index';
import { products, variants } from './schema';
import { eq, and, isNotNull } from 'drizzle-orm';

export async function getBestSellers(limit = 8) {
  return db
    .select({
      id: products.id,
      name: products.name_en,
      imageUrl: products.image_url,
      pricePaisa: variants.price_paisa,
    })
    .from(products)
    .innerJoin(variants, eq(variants.product_id, products.id))
    .where(and(eq(variants.is_active, true), isNotNull(products.image_url)))
    .limit(limit);
}
