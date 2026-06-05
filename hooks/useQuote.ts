import { useState, useEffect, useRef } from 'react';
import { ordersApi, type QuoteResponse } from '@/lib/api';
import { useCart } from '@/context/CartContext';

interface UseQuoteOptions {
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
}

interface UseQuoteResult {
  quote: QuoteResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function useQuote({ deliveryLatitude, deliveryLongitude }: UseQuoteOptions = {}): UseQuoteResult {
  const { items, restaurantApiId, couponCode } = useCart();
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!restaurantApiId || items.length === 0) {
      setQuote(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        // Only include lat/lng if they are actual numbers — omitting them avoids
        // server-side Zod validation errors when coordinates are not yet available.
        const body: Parameters<typeof ordersApi.quote>[0] = {
          restaurantId: restaurantApiId,
          items: items.map((ci) => ({
            menuItemId: parseInt(ci.menuItem.id, 10),
            quantity: ci.quantity,
          })),
          ...(couponCode ? { couponCode } : {}),
          ...(deliveryLatitude != null ? { deliveryLatitude } : {}),
          ...(deliveryLongitude != null ? { deliveryLongitude } : {}),
        };
        const result = await ordersApi.quote(body);
        setQuote(result);
        setError(null);
      } catch (err: any) {
        const msg = err?.message?.replace(/^\d+:\s*/, '') || 'Failed to fetch quote';
        console.warn('[useQuote] quote failed:', msg, err?.status);
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [restaurantApiId, items, couponCode, deliveryLatitude, deliveryLongitude]);

  return { quote, isLoading, error };
}
