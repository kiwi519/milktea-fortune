// Cloudflare Worker - Moonshot AI 中转服务
// API Key 通过环境变量注入，不暴露在前端

const MOONSHOT_API = "https://api.moonshot.cn/v1/chat/completions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    try {
      const body = await request.json();
      const { type, birthday, drinkName, mood, zodiac, shengxiao, score, dims, maxDim, minDim, luckyColor, luckyDir, title, drinkBrand, drinkType, drinkTags, topDim, moonPhase, moonEmoji, todayTerm, elementLine, shengxiaoLine, birthdayLine } = body;

      const today = new Date().toLocaleDateString("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });

      let prompt = "";
      let systemPrompt = "你是奶茶占卜师，温柔、神秘、有趣。用自然流畅的中文回答，不要分点列举，用段落形式。";

      if (type === "fortune") {
        const dimsStr = dims ? Object.entries(dims).map(([k,v]) => `${k}:${v}分`).join('、') : '';
        prompt = `今天是${today}。用户是${zodiac || '未知星座'}座，属${shengxiao || '未知'}，今日运势总分${score || '未知'}分，各维度分数：${dimsStr || '未知'}。幸运色${luckyColor || ''}，幸运方位${luckyDir || ''}。今日运势标题：${title || ''}。

请为用户生成今日运势文案，要求：
1. 结合星座特质、今日分数和各维度表现，给出有洞察力的运势解读
2. 融入幸运色和幸运方位的暗示
3. 语气温柔有趣，带一点神秘感和诗意
4. 80-120字，自然段落，不要分点
5. 开头用一句吸引人的话引入`;

      } else if (type === "energy") {
        const dimsStr = dims ? Object.entries(dims).map(([k,v]) => `${k}:${v}分`).join('、') : '';
        const contextStr = [
          zodiac ? `星座：${zodiac}座` : null,
          shengxiao ? `属${shengxiao}` : null,
          score ? `今日总分${score}分` : null,
          maxDim ? `最强维度：${maxDim}` : null,
          minDim ? `最弱维度：${minDim}` : null,
          moonPhase ? `今日月相：${moonPhase} ${moonEmoji || ''}` : null,
          todayTerm ? `今日节气：${todayTerm}` : null,
        ].filter(Boolean).join('，');
        prompt = `今天是${today}。用户生日${birthday}，${contextStr}。

请为用户生成今日能量解读，要求：
1. 结合星座、月相/节气（如有的话）、各维度分数，分析今天的能量状态
2. 给出一个具体的、可操作的小建议
3. 语气温柔浪漫，带点玄学感，偶尔引用月相或节气
4. 80-120字，自然段落，不要分点
5. 结尾用一句温暖的话收尾`;

      } else if (type === "drink_reason") {
        const drinkInfo = [drinkName || '', drinkBrand || '', drinkType || '', (drinkTags || []).join('、')].filter(Boolean).join(' · ');
        prompt = `今天是${today}。用户生日${birthday}，${zodiac ? `星座${zodiac}座` : ''}，属${shengxiao || ''}。今日最高维度${topDim || ''}。当前心情：${mood || ''}。幸运色${luckyColor || ''}。

宇宙今天为这位用户推荐了一杯${drinkInfo}。

请用奶茶占卜师的口吻，解释为什么今天的宇宙能量和这杯奶茶特别匹配。要求：
1. 结合星座特质、心情、运势维度、幸运色等因素，给出有说服力的"命中注定"感
2. 要让人读完就想喝这杯
3. 80-120字，自然段落，不要分点
4. 结尾可以加一句俏皮话`;

      } else {
        return new Response(JSON.stringify({ error: "Unknown type: " + type }), {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      const response = await fetch(MOONSHOT_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.MOONSHOT_API_KEY}`,
        },
        body: JSON.stringify({
          model: "moonshot-v1-8k",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.9,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Moonshot API error:", err);
        return new Response(JSON.stringify({ error: "AI service error: " + response.status }), {
          status: 502,
          headers: CORS_HEADERS,
        });
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ result: text }), {
        headers: CORS_HEADERS,
      });

    } catch (e) {
      console.error("Worker error:", e);
      return new Response(JSON.stringify({ error: "Internal error: " + e.message }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
};
