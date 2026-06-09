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
    // 处理预检请求
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
      const { type, birthday, drinkName, mood } = body;

      // 根据请求类型生成不同 prompt
      let prompt = "";
      const today = new Date().toLocaleDateString("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });

      if (type === "fortune") {
        prompt = `今天是${today}。用户生日是${birthday}。
请以温柔神秘的占星师口吻，为用户生成今日运势，包含：
1. 今日整体运势（2-3句，提到今天的能量走向）
2. 今日幸运色和幸运数字
3. 一句今日箴言（励志但不说教）
要求：语气温柔有趣，带一点神秘感，100字以内，不要分点列举，用自然段落。`;

      } else if (type === "energy") {
        prompt = `今天是${today}。用户生日是${birthday}，今天喝了一杯${drinkName}，当前心情是"${mood}"。
请以能量师口吻，为用户生成今日能量解读：
1. 分析今天的能量状态（结合星座/生日能量）
2. 这杯${drinkName}如何呼应了今天的能量
3. 给出一个小小的能量提升建议
要求：温柔浪漫，带点玄学感，80字以内，自然段落。`;

      } else if (type === "drink_reason") {
        prompt = `用户生日是${birthday}，今天宇宙为Ta推荐了一杯"${drinkName}"。
请以奶茶占卜师口吻，用2-3句话解释为什么今天的宇宙能量和这杯奶茶特别匹配。
要求：有趣浪漫，带点命中注定的感觉，50字以内。`;
      } else {
        return new Response(JSON.stringify({ error: "Unknown type" }), {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      // 调用 Moonshot API
      const response = await fetch(MOONSHOT_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.MOONSHOT_API_KEY}`,
        },
        body: JSON.stringify({
          model: "moonshot-v1-8k",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.9,
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Moonshot API error:", err);
        return new Response(JSON.stringify({ error: "AI service error" }), {
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
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
};
