import { useEffect, useState } from 'react';
import { supportContactApi, type ApiSupportContact } from '@/lib/api';

// Hardcoded fallback shown when the API is unreachable or returns no data.
const FALLBACK_CONTACT: ApiSupportContact = {
  phone: '9381828481',
  whatsapp: '',
  email: '',
};

// 5-minute in-memory cache shared across all hook instances.
let cache: { data: ApiSupportContact; expiresAt: number } | null = null;

export function useSupportContact() {
  const [data, setData] = useState<ApiSupportContact>(
    cache && cache.expiresAt > Date.now() ? cache.data : FALLBACK_CONTACT,
  );

  useEffect(() => {
    if (cache && cache.expiresAt > Date.now()) {
      setData(cache.data);
      return;
    }
    supportContactApi.get().then((contact) => {
      // Use API value if it has a phone number, otherwise keep fallback
      const resolved: ApiSupportContact = {
        phone: contact?.phone || FALLBACK_CONTACT.phone,
        whatsapp: contact?.whatsapp || FALLBACK_CONTACT.whatsapp,
        email: contact?.email || FALLBACK_CONTACT.email,
      };
      cache = { data: resolved, expiresAt: Date.now() + 5 * 60 * 1000 };
      setData(resolved);
    }).catch(() => {
      // API unavailable — fallback already set as initial state
    });
  }, []);

  return data;
}
