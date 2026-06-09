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
      const {
        type, birthday, drinkName, mood, zodiac, shengxiao, score,
        dims, maxDim, minDim, luckyColor, luckyDir, title,
        drinkBrand, drinkType, drinkTags, topDim,
        moonPhase, moonEmoji, todayTerm, elementLine, shengxiaoLine, birthdayLine
      } = body;

      const today = new Date().toLocaleDateString("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });

      const systemPrompt = "你是一个说话很直、不卖弄的占星助手。不讲虚的，每句话都讲一件具体的事——今天该做什么、躲什么、注意什么。用口语化的中文，像朋友聊天。";

      let prompt = "";

      if (type === "fortune") {
        const dimsStr = dims
          ? Object.entries(dims).map(([k, v]) => `${k}:${v}分`).join("、")
          : "";
        const highDims = dims
          ? Object.entries(dims).filter(([, v]) => v >= 75).map(([k]) => k).join("、")
          : "";
        const lowDims = dims
          ? Object.entries(dims).filter(([, v]) => v <= 65).map(([k]) => k).join("、")
          : "";

        prompt = `今天是${today}。用户是${zodiac || "未知星座"}座，今日运势总分${score || "未知"}分，各维度：${dimsStr || "未知"}。幸运色${luckyColor || ""}，幸运方位${luckyDir || ""}。

请生成今日运势文案，要求严格执行：
- 禁止空话套话，比如"缓缓步入美好的一天""能量在悄悄积累"这类句子一律不要
- 分数高的维度（${highDims || "工作"}）：直接说今天适合用这个优势做什么具体的事
- 分数低的维度（${lowDims || "健康"}）：直接说今天要注意什么、别干什么
- 幸运色${luckyColor}和方位${luckyDir}融入具体建议，比如"穿${luckyColor}系的出门""往${luckyDir}方向走走"
- 语气像朋友聊天，不用"亲爱的"开头
- 80-120字，自然段落，不要分点列举`;

      } else if (type === "energy") {
        const contextStr = [
          zodiac ? `${zodiac}座` : null,
          score ? `今日总分${score}分` : null,
          maxDim ? `最强：${maxDim}` : null,
          minDim ? `最弱：${minDim}` : null,
          moonPhase ? `${moonPhase}${moonEmoji || ""}` : null,
          todayTerm ? `${todayTerm}节气` : null,
        ].filter(Boolean).join("，");

        prompt = `今天是${today}。用户${contextStr}。

请生成今日能量解读，要求严格执行：
- 禁止空话，每句话对应一件具体的事
- 最强维度是${maxDim}，说清楚今天可以用它干什么（举一个具体场景）
- 最弱维度是${minDim}，说清楚今天为什么要躲开它、或者怎么应对
- 如果今天是${moonPhase}，用一句话说这个月相对今天有什么具体影响（不要说"能量达到峰值"这种废话）
- ${todayTerm ? `今天是${todayTerm}节气，顺带一句具体的节气提示` : ""}
- 给出 1-2 个今天可以实际操作的建议
- 语气轻松直接，80-120字，自然段落`;

      } else if (type === "drink_reason") {
        const drinkInfo = [drinkName || "", drinkBrand || "", drinkType || ""]
          .filter(Boolean).join(" · ");
        const tags = (drinkTags || []).slice(0, 3).join("、");

        prompt = `用户是${zodiac || ""}座，心情${mood || ""}，今天运势最强的面是${topDim || ""}，幸运色${luckyColor || ""}。今天推荐的奶茶：${drinkInfo}，口感特点：${tags}。

用 2-3 句话解释为什么这杯奶茶适合今天，要求严格执行：
- 结合这杯奶茶的具体口感（${tags}）和用户今天的状态做匹配，说具体
- 禁止说"命中注定""宇宙安排"这种过度玄学套话
- 读完让人想立刻去买
- 可以加一句轻松的收尾，不要强行煽情
- 50-80字，口语化`;

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
          temperature: 0.85,
          max_tokens: 400,
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
