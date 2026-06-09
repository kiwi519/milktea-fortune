# 🚀 部署 AI 功能：Cloudflare Worker 指南

## 前提条件

1. **Cloudflare 账号**（免费即可）
   - 注册：https://dash.cloudflare.com/sign-up
   - 已有账号直接登录

2. **Moonshot API Key**（已有）
   - `sk-Ir7CUfQTTG6VCbwytVUDp0yywpBw3z8EtkVESGWqnEtiHA6M`

## 方法一：通过 Cloudflare Dashboard 部署（推荐，最简单）

### 步骤 1：创建 Worker
1. 打开 https://dash.cloudflare.com
2. 点击左侧 **Workers & Pages** → **Create** → **Create Worker**
3. 给 Worker 起个名字，比如 `milktea-fortune`
4. 点击 **Deploy**

### 步骤 2：粘贴 Worker 代码
1. 在 Worker 编辑器中，清空默认代码
2. 打开 `worker.js` 文件（在项目根目录），复制全部内容
3. 粘贴到编辑器中
4. 点击 **Save and deploy**

### 步骤 3：设置环境变量
1. 在 Worker 页面的左侧，找到 **Settings** → **Variables**
2. 点击 **Add variable**
3. **变量名**: `MOONSHOT_API_KEY`
4. **值**: `sk-Ir7CUfQTTG6VCbwytVUDp0yywpBw3z8EtkVESGWqnEtiHA6M`
5. 勾选 **Encrypt**（加密存储）
6. 点击 **Save**

### 步骤 4：获取 Worker URL
1. 回到 Worker 页面顶部，你会看到一个 URL，类似：
   `https://milktea-fortune.yourname.workers.dev`
2. 记住这个 URL

### 步骤 5：更新网页
1. 打开 `milktea-fortune.html`
2. 找到第 846 行：
   ```javascript
   const AI_WORKER_URL = '';
   ```
3. 填入你的 Worker URL：
   ```javascript
   const AI_WORKER_URL = 'https://milktea-fortune.yourname.workers.dev';
   ```

### 步骤 6：推送更新到 GitHub
```bash
git add milktea-fortune.html
git commit -m "填入 AI Worker URL"
git push origin main
```

## 方法二：通过 Wrangler CLI 部署

### 安装 Wrangler
```bash
npm install -g wrangler
```

### 登录 Cloudflare
```bash
wrangler login
```

### 创建 Worker 配置文件
在项目根目录创建 `wrangler.toml`：
```toml
name = "milktea-fortune"
main = "worker.js"
compatibility_date = "2024-05-01"
```

### 设置环境变量
```bash
wrangler secret put MOONSHOT_API_KEY
# 然后输入你的 API Key
```

### 部署
```bash
wrangler deploy
```

## Worker 功能说明

部署后的 Worker 会处理三种请求类型：

| 类型 | 说明 |
|------|------|
| `fortune` | 生成今日运势文案 |
| `energy` | 生成今日能量解读 |
| `drink_reason` | 生成奶茶推荐理由 |

前端会在用户走完流程后自动调用 Worker，获取 AI 生成的内容。如果 Worker 不可用，会自动回退到本地生成的内容（不影响正常使用）。

## 测试 Worker

部署完成后，可以用 curl 测试：
```bash
curl -X POST https://milktea-fortune.yourname.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"type":"fortune","birthday":"1990-01-15","zodiac":"摩羯座","shengxiao":"马","score":85}'
```

应该返回类似：
```json
{"result":"今天是2024年... 你的星座特质..."}
```
