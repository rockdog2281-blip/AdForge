const JSON_HEADERS = { 'Content-Type': 'application/json' };

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://rockdog2281-blip.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), ...JSON_HEADERS }
  });
}

async function openRouter(env, path, init = {}) {
  if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not configured on the Worker.');
  const response = await fetch(`https://openrouter.ai/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://rockdog2281-blip.github.io/AdForge/',
      'X-Title': 'AdForge',
      ...(init.headers || {})
    }
  });
  return response;
}

async function createAdPlan(env, body) {
  const prompt = `Create a high-converting short-form product advertisement. Return valid JSON only with these keys: headline, primaryCopy, cta, hashtags, hook, videoScript, videoPrompt. The videoPrompt must describe ONE realistic vertical 9:16 product-ad video shot, including subject, setting, camera movement, lighting, action, and commercial quality. Do not invent product claims that are not supplied. Product/service: ${body.product || ''}. Details: ${body.details || body.info || ''}. Platform: ${body.platform || 'TikTok'}. Goal: ${body.goal || 'Get more sales'}. Tone: ${body.tone || 'Bold & direct'}. Make the hook strong in the first 2 seconds and keep the video concept suitable for a 4-8 second AI-generated clip.`;
  const r = await openRouter(env, '/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: env.TEXT_MODEL || 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert direct-response TikTok Shop advertising strategist. Return valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || JSON.stringify(data));
  let content = data.choices?.[0]?.message?.content || '{}';
  content = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(content);
}

async function createVideo(env, plan, body) {
  const model = env.VIDEO_MODEL || 'bytedance/seedance-2.0-fast';
  const prompt = `${plan.videoPrompt || ''}\n\nProduct/service: ${body.product || ''}. Product details: ${body.details || body.info || ''}. Advertising hook: ${plan.hook || ''}. Make this a polished TikTok Shop-style commercial. Keep the product visually clear, realistic, centered, and commercially appealing. Do not add unsupported claims, logos, prices, or text that were not supplied.`;
  const r = await openRouter(env, '/videos', {
    method: 'POST',
    body: JSON.stringify({
      model,
      prompt,
      duration: 8,
      resolution: '720p',
      aspect_ratio: '9:16',
      generate_audio: false
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || JSON.stringify(data));
  return { ...data, plan };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/video/status') {
        const job = url.searchParams.get('job');
        if (!job) return json({ error: 'Missing job.' }, 400);
        const r = await openRouter(env, `/videos/${encodeURIComponent(job)}`);
        const data = await r.json();
        if (!r.ok) return json({ error: data }, 502);
        return json(data);
      }

      if (request.method !== 'POST') return new Response('AdForge API', { headers: corsHeaders() });
      const body = await request.json();

      if (url.pathname === '/video') {
        const plan = await createAdPlan(env, body);
        const job = await createVideo(env, plan, body);
        return json({ ...job, plan });
      }

      const plan = await createAdPlan(env, body);
      return json({ choices: [{ message: { content: JSON.stringify(plan) } }] });
    } catch (e) {
      return json({ error: String(e?.message || e) }, 500);
    }
  }
};
