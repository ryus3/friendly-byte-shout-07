// Verify a custom domain by checking DNS CNAME via Google Public DNS-over-HTTPS
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const CNAME_TARGETS = ['ryus.lovable.app', 'pos.ryusbrand.com'];
const A_TARGET = '185.158.133.1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { domain } = await req.json();
    if (!domain || typeof domain !== 'string') {
      return new Response(JSON.stringify({ verified: false, reason: 'domain مطلوب' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Check CNAME
    const cnameRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(clean)}&type=CNAME`);
    const cname = await cnameRes.json();
    const cnames = (cname?.Answer || []).map((a: any) => String(a.data || '').toLowerCase().replace(/\.$/, ''));
    const cnameOk = cnames.some(c => CNAME_TARGETS.includes(c));

    // Check A
    const aRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(clean)}&type=A`);
    const a = await aRes.json();
    const aIps = (a?.Answer || []).map((x: any) => String(x.data || ''));
    const aOk = aIps.includes(A_TARGET);

    if (cnameOk || aOk) {
      return new Response(JSON.stringify({ verified: true, method: cnameOk ? 'CNAME' : 'A' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      verified: false,
      reason: 'لم يتم العثور على سجل CNAME أو A الصحيح. تأكد من إضافة السجل وانتظر انتشار DNS.',
      found: { cname: cnames, a: aIps },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ verified: false, reason: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
