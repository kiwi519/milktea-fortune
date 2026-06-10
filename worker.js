/**
 * Cloudflare Worker: milktea-fortune-ai
 * 统一处理所有 AI 生成请求（运势文案、能量解读、推荐理由）
 * 使用 DeepSeek API（流式输出，避免超时）
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions';

export default {
  async fetch(request, env) {
    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const type = body.type || 'insight';
    let prompt = '';
    let needJson = false; // fortune 类型需要收集完整 JSON

    if (type === 'insight') {
      const {
        zodiac, element, shengxiao,
        moonPhase, moonEmoji, solarTerm,
        maxDim, maxScore, minDim, minScore,
        allDims, isBirthday, nearBirthday, date,
      } = body;

      const dimsDesc = (allDims || []).map(d => `${d.label}${d.score}分`).join('、');
      const birthdayHint = isBirthday
        ? '今天是ta的生日，能量场在年度峰值。'
        : nearBirthday === '生日就在这几天'
        ? '生日就在这几天，个人能量场正在积累。'
        : nearBirthday === '生日能量余韵'
        ? '生日刚过不久，能量场还有余韵。'
        : '';

      prompt = `你是一个懂玄学又接地气的能量解读师，语气像朋友聊天，不装神弄鬼，偶尔带点玄学腔但不过分。

今天是 ${date}，帮我为以下这个人写「今日能量解读」：
- 星座：${zodiac}（${element}象星座）
- 生肖：${shengxiao}
- 今日月相：${moonEmoji}${moonPhase}
${solarTerm ? `- 今日节气：${solarTerm}` : ''}
- 今日六维度得分：${dimsDesc}
- 能量最强维度：${maxDim}（${maxScore}分）
- 能量最弱维度：${minDim}（${minScore}分）
${birthdayHint ? `- 特殊提示：${birthdayHint}` : ''}

要求：
1. 200字以内，分3段，每段1-2句
2. 第一段：结合月相${solarTerm ? '和节气' : ''}说今天整体能量场的状态
3. 第二段：结合星座元素特质和生肖，说今天这个人的能量底色
4. 第三段：点出最强维度（给具体行动建议）和最弱维度（给保守提示），如有生日加持则在结尾加一句
5. 语气口语化，像朋友随口说，不要用"您"，不要用感叹号堆砌，不要说废话
6. 直接输出正文，不要标题，不要序号`;

    } else if (type === 'fortune') {
      needJson = true;
      const { zodiac, score, maxDim, date } = body;
      prompt = `你是一个懂玄学的文案师。今天是${date}，${zodiac}今日运势${score}分，最强维度是${maxDim}。
请写一句今日运势标题（8字以内，有点玄学感但不空洞）和一句奶茶金句（15字以内，把奶茶和今天的状态结合起来，口语化）。
格式：{"title":"...","quote":"..."}，只输出JSON，不要其他内容。`;

    } else if (type === 'reason') {
      const { drinkName, drinkDesc, tags, zodiac, mood, maxDim, maxScore, luckyColor, date } = body;
      prompt = `你是一个懂奶茶又懂玄学的文案师，语气像朋友推荐，口语化，不装。
今天是${date}，帮我写一段奶茶推荐理由：
- 推荐饮品：${drinkName}（${drinkDesc || ''}）
- 饮品标签：${(tags||[]).join('、')}
- 用户星座：${zodiac}，今日心情：${mood}
- 今日最强维度：${maxDim}（${maxScore}分），幸运色：${luckyColor}
要求：3句话，先说饮品本身的特点，再说和今天运势/心情的呼应，最后一句俏皮勾单。不超过80字。直接输出正文。`;

    } else {
      return new Response(JSON.stringify({ error: 'Unknown type: ' + type }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── 调用 DeepSeek API（流式）──
    try {
      const dsRes = await fetch(DEEPSEEK_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是一个懂玄学又接地气的能量解读师，用中文回答，语气口语化，简洁有力。' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 400,
          stream: true,
        }),
      });

      if (!dsRes.ok) {
        const errText = await dsRes.text();
        return new Response(JSON.stringify({ error: 'DeepSeek API error', detail: errText }), {
          status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // fortune 类型：收集完整内容再解析 JSON
      if (needJson) {
        const reader = dsRes.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') break;
            try {
              const parsed = JSON.parse(raw);
              fullText += parsed.choices?.[0]?.delta?.content || '';
            } catch {}
          }
        }

        try {
          const jsonMatch = fullText.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : fullText);
          return new Response(JSON.stringify(parsed), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        } catch {
          return new Response(JSON.stringify({ title: fullText.slice(0, 10), quote: fullText }), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
      }

      // insight / reason：把 DeepSeek SSE 流转换后透传给前端
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      (async () => {
        const reader = dsRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              await writer.write(encoder.encode('data: [DONE]\n\n'));
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (raw === '[DONE]') {
                await writer.write(encoder.encode('data: [DONE]\n\n'));
                break;
              }
              try {
                const parsed = JSON.parse(raw);
                const token = parsed.choices?.[0]?.delta?.content || '';
                if (token) {
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
                }
              } catch {}
            }
          }
        } catch (e) {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Fetch failed', detail: String(err) }), {
        status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};
