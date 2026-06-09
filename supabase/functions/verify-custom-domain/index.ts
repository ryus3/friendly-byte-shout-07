// Verify a custom domain (Vercel-hosted) via Google Public DNS-over-HTTPS
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Vercel targets (Anycast IPs — legacy + current)
const A_TARGETS = [
  '76.76.21.21',                    // legacy
  '64.29.17.1', '64.29.17.65',      // current
  '216.198.79.1', '216.198.79.65',  // current
];
// Accept any IP in Vercel's current Anycast ranges
const A_PREFIX_MATCH = ['64.29.17.', '216.198.79.', '76.76.21.'];
const CNAME_EXACT = ['cname.vercel-dns.com'];
// Vercel also issues unique CNAMEs like xxxxxxxx.vercel-dns-NNN.com
const CNAME_SUFFIX_MATCH = ['.vercel-dns.com'];
const CNAME_REGEX_MATCH = [/\.vercel-dns-\d+\.com$/i];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { domain } = await req.json();
    if (!domain || typeof domain !== 'string') {
      return new Response(JSON.stringify({ verified: false, reason: 'domain مطلوب' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

    // CNAME lookup
    const cnameRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(clean)}&type=CNAME`);
    const cname = await cnameRes.json();
    const cnames = (cname?.Answer || []).map((a: any) => String(a.data || '').toLowerCase().replace(/\.$/, ''));
    const cnameOk = cnames.some(c =>
      CNAME_EXACT.includes(c) ||
      CNAME_SUFFIX_MATCH.some(suf => c.endsWith(suf)) ||
      CNAME_REGEX_MATCH.some(rx => rx.test(c))
    );

    // A lookup
    const aRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(clean)}&type=A`);
    const a = await aRes.json();
    const aIps = (a?.Answer || []).map((x: any) => String(x.data || ''));
    const aOk = aIps.some(ip =>
      A_TARGETS.includes(ip) ||
      A_PREFIX_MATCH.some(pfx => ip.startsWith(pfx))
    );

    if (cnameOk || aOk) {
      return new Response(JSON.stringify({ verified: true, method: cnameOk ? 'CNAME' : 'A' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      verified: false,
      reason: 'لم يتم العثور على سجل Vercel صحيح. تأكد من CNAME → cname.vercel-dns.com أو A → 76.76.21.21 / 64.29.17.x / 216.198.79.x، وانتظر انتشار DNS.',
      found: { cname: cnames, a: aIps },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ verified: false, reason: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

