import Image from 'next/image';
import { getBestSellers } from '@/lib/db/queries';

function formatPrice(paisa: number): string {
  return 'Rs ' + Math.round(paisa / 100).toLocaleString('en-PK');
}

const CATEGORIES = [
  { name: 'Dairy & Eggs', emoji: '🥛' },
  { name: 'Atta Rice & Daal', emoji: '🌾' },
  { name: 'Spices & Masala', emoji: '🌶️' },
  { name: 'Snacks', emoji: '🍿' },
  { name: 'Drinks', emoji: '🧃' },
  { name: 'Household', emoji: '🧹' },
];

export default async function Home() {
  const bestSellers = await getBestSellers(8);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-brand px-4 pt-4 pb-3 space-y-3">
        {/* Row 1: Wordmark + Urdu toggle */}
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold tracking-tight text-white">
            prime<span className="text-accent">mart</span>
          </span>
          <button
            className="font-urdu text-sm text-white border border-white/40 rounded-full px-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Switch to Urdu"
          >
            اردو
          </button>
        </div>

        {/* Row 2: Delivery address */}
        <div className="flex items-center gap-1 text-sm text-white/80">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
            <path fillRule="evenodd" d="M8 1.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM2 6a6 6 0 1 1 10.174 4.31c-.203.196-.43.37-.66.52L8 14.5l-3.514-3.67a6.003 6.003 0 0 1-.66-.52A5.99 5.99 0 0 1 2 6Z" clipRule="evenodd" />
          </svg>
          <span>Deliver to <strong className="text-white font-medium">[AREA]</strong></span>
        </div>

        {/* Row 3: Search bar */}
        <div className="flex items-center gap-2 bg-white/15 rounded-full px-4 h-11 text-white/70 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <span>Search groceries…</span>
        </div>
      </header>

      <main className="pb-24">
        {/* Offer banner */}
        <div className="mx-4 mt-4 bg-accent rounded-card p-4">
          <p className="text-brand-dark font-semibold">[OFFER]</p>
        </div>

        {/* Categories */}
        <section className="mt-5 px-4">
          <h2 className="text-base font-semibold text-ink mb-3">Categories</h2>
          <div className="grid grid-cols-3 gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                className="bg-white rounded-card p-3 text-center flex flex-col items-center gap-1 min-h-[72px] justify-center active:bg-line transition-colors"
              >
                <span className="text-2xl leading-none">{cat.emoji}</span>
                <span className="text-xs text-ink leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Best Sellers */}
        <section className="mt-6 px-4">
          <h2 className="text-base font-semibold text-ink mb-3">Best Sellers</h2>
          <div className="grid grid-cols-2 gap-3">
            {bestSellers.map((product) => (
              <div key={product.id} className="bg-white rounded-card overflow-hidden relative">
                <div className="w-full h-40 bg-white flex items-center justify-center">
                  <Image
                    src={product.imageUrl!}
                    alt={product.name}
                    width={180}
                    height={160}
                    className="w-full h-40 object-contain"
                    unoptimized
                  />
                </div>
                <div className="p-3 pb-12">
                  <p className="text-sm text-ink leading-snug line-clamp-2">{product.name}</p>
                  <p className="text-sm font-semibold text-accent-text mt-1">
                    {formatPrice(product.pricePaisa)}
                  </p>
                </div>
                <button
                  className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-brand text-white text-xl flex items-center justify-center leading-none"
                  aria-label={`Add ${product.name} to cart`}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-line grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {/* Home */}
        <button className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-brand">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] font-medium">Home</span>
        </button>

        {/* Categories */}
        <button className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-muted">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] font-medium">Categories</span>
        </button>

        {/* Cart */}
        <button className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-muted">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M1 1.75A.75.75 0 0 1 1.75 1h1.628a1.75 1.75 0 0 1 1.734 1.51L5.18 3a65.25 65.25 0 0 1 13.36 1.412.75.75 0 0 1 .58.875 48.645 48.645 0 0 1-1.618 6.2.75.75 0 0 1-.712.513H6a2.503 2.503 0 0 0-2.292 1.5H17.25a.75.75 0 0 1 0 1.5H2.76a.75.75 0 0 1-.748-.807 4.002 4.002 0 0 1 2.716-3.486L3.626 2.716a.25.25 0 0 0-.248-.216H1.75A.75.75 0 0 1 1 1.75ZM6 17.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM15.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
          </svg>
          <span className="text-[10px] font-medium">Cart</span>
        </button>

        {/* Account */}
        <button className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-muted">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A6.483 6.483 0 0 0 10 16.5a6.483 6.483 0 0 0 4.793-2.11A5.99 5.99 0 0 0 10 12Z" clipRule="evenodd" />
          </svg>
          <span className="text-[10px] font-medium">Account</span>
        </button>
      </nav>
    </div>
  );
}
