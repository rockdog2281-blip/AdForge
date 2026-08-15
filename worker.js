export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': 'https://rockdog2281-blip.github.io',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (request.method === 'OPTIONS') return new Response(null, {headers:cors});
    if (request.method !== 'POST') return new Response('AdForge API', {headers:cors});
    try {
      const body = await request.json();
      const prompt = `Create advertising copy for this request. Return JSON with keys headline, primaryCopy, cta, hashtags, hook, videoScript. Product/service: ${body.product || ''}. Details: ${body.details || ''}. Platform: ${body.platform || 'Instagram'}. Goal: ${body.goal || 'Get more sales'}. Tone: ${body.tone || 'Bold & direct'}. Keep it persuasive, specific, and suitable for the selected platform.`;
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method:'POST',
        headers:{'Authorization':`Bearer ${env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':'https://rockdog2281-blip.github.io/AdForge/','X-Title':'AdForge'},
        body:JSON.stringify({model:'openai/gpt-4o-mini',messages:[{role:'system',content:'You are an expert direct-response advertising copywriter. Return valid JSON only.'},{role:'user',content:prompt}],temperature:.8})
      });
      const data=await r.json();
      if(!r.ok) return new Response(JSON.stringify({error:data}),{status:502,headers:{...cors,'Content-Type':'application/json'}});
      let content=data.choices?.[0]?.message?.content||'{}';
      content=content.replace(/^```json\s*/,'').replace(/\s*```$/,'');
      return new Response(content,{headers:{...cors,'Content-Type':'application/json'}});
    } catch(e) { return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...cors,'Content-Type':'application/json'}}); }
  }
};