import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import devLog from '@/lib/devLogger';

/**
 * Detects if the current hostname is a storefront subdomain (e.g. shop.ryusbrand.com)
 * or a verified custom domain, and rewrites the URL path to /storefront/{slug}/...
 * so the existing React Router setup picks it up transparently.
 *
 * - {slug}.ryusbrand.com  -> slug is the first hostname label
 * - custom domain         -> resolved from employee_storefront_settings
 * - main app domains      -> no-op
 */
const MAIN_HOSTS = new Set([
  'ryus.lovable.app',
  'pos.ryusbrand.com',
  'localhost',
  '127.0.0.1',
]);

const BASE_DOMAIN = 'ryusbrand.com';

const StorefrontHostGate = ({ children }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname;

    if (path.startsWith('/storefront/') || path.startsWith('/dashboard')) {
      setReady(true);
      return;
    }

    if (
      MAIN_HOSTS.has(host) ||
      host.endsWith('.lovable.app') ||
      host.endsWith('.lovable.dev') ||
      host.endsWith('.lovableproject.com')
    ) {
      setReady(true);
      return;
    }

    const rewriteTo = (slug) => {
      if (!slug) return;
      const rest = path === '/' ? '' : path;
      const target = `/storefront/${slug}${rest}${window.location.search}${window.location.hash}`;
      devLog.log('🏪 StorefrontHostGate rewrite:', host, '->', target);
      window.history.replaceState({}, '', target);
      setReady(true);
    };

    // Apex/www of ryusbrand.com → root storefront (متجر المدير العام)
    if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) {
      (async () => {
        try {
          const { data } = await supabase
            .from('employee_storefront_settings')
            .select('slug')
            .eq('is_root_storefront', true)
            .eq('is_active', true)
            .maybeSingle();
          if (data?.slug) {
            rewriteTo(data.slug);
          } else {
            setReady(true);
          }
        } catch (e) {
          devLog.warn('Root storefront lookup failed:', e?.message);
          setReady(true);
        }
      })();
      return;
    }

    // Subdomain of ryusbrand.com (but NOT the apex or pos.)
    if (host.endsWith(`.${BASE_DOMAIN}`) && host !== BASE_DOMAIN) {
      const sub = host.slice(0, -1 * (BASE_DOMAIN.length + 1));
      if (sub && !sub.includes('.') && sub !== 'pos' && sub !== 'www') {
        rewriteTo(sub);
        return;
      }
    }

    // Custom domain lookup (case-insensitive)
    (async () => {
      try {
        const { data } = await supabase
          .from('employee_storefront_settings')
          .select('slug, custom_domain_verified')
          .ilike('custom_domain', host)
          .eq('is_active', true)
          .maybeSingle();
        if (data?.slug && data?.custom_domain_verified) {
          rewriteTo(data.slug);
        } else {
          setReady(true);
        }
      } catch (e) {
        devLog.warn('StorefrontHostGate lookup failed:', e?.message);
        setReady(true);
      }
    })();
  }, []);

  if (!ready) return null;
  return children;
};

export default StorefrontHostGate;
