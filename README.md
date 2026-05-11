# misaka-web

> misaka.io VPS 库存监控 + 任务自动下单 + Telegram 通知 · 单人/多人共用

[![Build](https://github.com/kelenetwork/misaka-web/actions/workflows/build.yml/badge.svg)](https://github.com/kelenetwork/misaka-web/actions/workflows/build.yml)
[![PR Check](https://github.com/kelenetwork/misaka-web/actions/workflows/pr-check.yml/badge.svg)](https://github.com/kelenetwork/misaka-web/actions/workflows/pr-check.yml)

线上：<https://vps.misaka.si>

---

## ✨ 它做什么

1. **30 秒一次轮询 misaka.io** 所有区域 + 机型，库存写入本地 SQLite。
2. **用户在 Web 端建任务**：「HKG12 / s3n-2c3g / 限价 $30 / 数量 1」。
3. **任务命中库存** 自动用真实账号 `POST /api/mc2/instances/` 下单，得到 `order_id + invoice_id + 付款链接`。
4. **Telegram bot 推送** 下单成功 / 失败 / 任务自动暂停 / 账号熔断。
5. 用户/管理员都可以多账号、多任务、多 Telegram 绑定。

---

## 🧱 技术栈

| 层 | 选型 |
|---|---|
| Web | Next.js 15 App Router + custom Node server |
| UI | Tailwind 4 + 自研 cyber-console 暗主题 |
| 鉴权 | [better-auth](https://better-auth.com) (credential + 自定义 setup token) |
| ORM | Drizzle ORM + better-sqlite3 (WAL) |
| 任务 / Worker | 单进程 Node 内的 `setTimeout` 循环 + EventEmitter |
| Telegram bot | grammY (long-poll) |
| 加密 | AES-256-GCM (`@noble/ciphers`) |
| 部署 | Docker Hub `kelework/misaka-web` + GitHub Actions → SSH 远程 `docker compose up` |
| 暴露 | Cloudflare Tunnel (`vps.misaka.si`) |

---

## 🗂 项目结构

```
misaka-web/
├── app/
│   ├── (admin)/admin/        管理员页：dashboard / applications / users
│   ├── (app)/                登录后主区：inventory / tasks / orders / activity / accounts / telegram
│   ├── (auth)/               login / apply / setup
│   ├── api/                  REST 路由（auth / accounts / tasks / orders / setup / inventory/stream / health …）
│   ├── error.tsx             500 错误边界
│   ├── global-error.tsx      根 layout 崩溃时的兜底
│   └── not-found.tsx         404
├── components/
│   ├── shell/                AppShell / MobileShell / Sidebar / Topbar / HealthBanner
│   ├── ui/                   Card / Button / StatusBadge / SectionHead / AuthShell / EmptyState
│   ├── accounts/             AccountsList / AddAccountForm
│   ├── admin/                ApplicationRow / CreateUserDialog
│   ├── forms/                TaskForm （新建/编辑任务）
│   ├── inventory/_components 库存矩阵客户端组件
│   ├── tasks/                DeleteTaskButton
│   ├── telegram/             TelegramBindClient / TelegramUnbindButton
│   └── activity/             ActivityFilters
├── lib/
│   ├── auth.ts               better-auth 配置（30 天 session + 1 天滑动续期）
│   ├── crypto.ts             AES-256-GCM 工具
│   ├── db/                   Drizzle schema + migrations + client
│   ├── misaka/               MisakaClient（真实 misaka.io API） + inventory poller
│   ├── workers/              inventory-poller / task-runner / health 心跳
│   ├── telegram/             bot.ts (setMyCommands + 通知模板) / commands.ts (/start /tasks /orders ...)
│   └── ...
├── scripts/
│   ├── seed-admin.ts                创建初始管理员
│   └── rotate-encryption-key.ts     ENCRYPTION_KEY 轮换
├── tests/                    Vitest 单测（misaka-client / task-runner / api-guard / rate-limit / crypto）
├── server/index.ts           Next custom server（先起 HTTP 再起 worker）
├── Dockerfile                多阶段构建（deps / build / runtime）
├── docker-compose.yml        生产部署模板
└── .github/workflows/
    ├── build.yml             push main → docker build → docker hub → SSH 远程 deploy
    └── pr-check.yml          PR → tsc + vitest + next build
```

---

## 🔐 多用户 / 权限模型

### 角色
- `admin`：管理员，所有页面 + admin 后台 + 创建用户
- `user`：普通用户，只能管自己的 misaka 账号 / task / order / Telegram 绑定

### 注册路径

**A. 申请 → 审批 → 自助设密码**（推荐给陌生用户）

```
/apply (填用户名 + 邮箱 + 理由)
    ↓
admin 在 /admin/applications 审批
    ↓
系统生成 48h 有效的 setup_token
    ↓
admin 复制 /setup?token=xxx 链接给申请人
    ↓
申请人打开链接 → 设密码 → better-auth signUpEmail 创建账号 + 自动 sign-in
```

**B. admin 直接拉人**

```
/admin/users → 「新建用户」 → 填用户名 + 邮箱 + 初始密码 + 角色
    ↓
账号立刻 active，可直接登录
```

> 旧的「随机临时密码」流程已经 retired，杜绝 admin 手抄密码私聊给用户的不安全做法。

---

## 📡 数据流

```
misaka.io
   │
   │ (公开 API GET /api/mc2/regions + /plans 每 30s)
   ▼
┌──────────────────────────────────┐
│  inventory-poller                │  ← 写 inventory_snapshots
│  ↓ emit "available"/"change"     │  ← 写 worker_health 心跳
│  inventoryEvents (EventEmitter)  │
│   │                              │
│   ├─► task-runner (订阅)         │  ← 命中 task 调用真实 createInstance，
│   │     ↓                        │     失败累计 + 指数退避 + 5 次熔断
│   │   Web orders / audit_logs    │
│   │     ↓                        │
│   │   Telegram bot 推送          │
│   │                              │
│   └─► /api/inventory/stream      │  ← 前端 EventSource 订阅，1.5s throttle
│         ↓                        │     调 router.refresh() 实时刷新
│       InventoryMatrix UI         │
└──────────────────────────────────┘
```

### 失败 / 熔断策略

| 触发 | 行为 |
|---|---|
| createInstance 抛错 | `failureCount += 1`，`nextRetryAt = now + min(2^n × 60s, 1h)` |
| 连续失败 5 次 | task `enabled = false`，写 audit + Telegram 告警 |
| misaka 账号 3 次 403 | 账号 `status = "rate_limited"`，30 分钟冷却 |
| inventory poller / telegram bot 失败 | worker_health 累计 `consecutiveFailures` |
| worker `ageSec > 300 || consecutiveFailures >= 3` | 顶部 HealthBanner 红条 |

---

## 🧪 本地开发

```bash
# 1. clone
git clone https://github.com/kelenetwork/misaka-web && cd misaka-web

# 2. 准备 env
cp .env.example .env
# 必填：
#   ENCRYPTION_KEY=<openssl rand -hex 32>
#   BETTER_AUTH_SECRET=<openssl rand -hex 32>
#   BETTER_AUTH_URL=http://localhost:3000
#   DATABASE_URL=file:./data/misaka.db
#   TELEGRAM_BOT_TOKEN=<可选；空则 bot 不启动>
#   TELEGRAM_OWNER_ID=<可选；用于异常告警>

# 3. 装依赖
npm install

# 4. 跑 migration（首次启动 docker-entrypoint.sh 也会自动跑）
npx drizzle-kit migrate

# 5. 创建初始 admin
npx tsx scripts/seed-admin.ts

# 6. 启动
npm run dev   # tsx server/index.ts，含 inventory poller + telegram bot
```

> ⚠️ **同时只能有一个进程长轮询 bot token**。本地开发跑 bot 时记得停掉远程容器，否则 grammy 会抛 `GrammyError 409 Conflict`，bot 静默失败，notifyOrderSuccess 不发。

### 命令

| 命令 | 用途 |
|---|---|
| `npm run dev` / `npm start` | 启动 server（dev 和 prod 都用 tsx 同一入口） |
| `npx tsc --noEmit` | 类型检查 |
| `npm test` | 运行 vitest 全部测试 |
| `npm run build` | next build（生产） |
| `npx drizzle-kit generate` | 改完 `lib/db/schema.ts` 后生成 migration |

---

## 🚀 部署

### 自动部署（推荐）

push 到 `main` 即触发 `.github/workflows/build.yml`：

1. 构建 docker image，推 `kelework/misaka-web:latest`
2. SSH 远程跑 `docker compose pull && docker compose up -d`
3. 容器启动时自动 apply pending migrations

需要的 GitHub Secrets：
- `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`
- `DEPLOY_SSH_HOST` / `DEPLOY_SSH_PORT` / `DEPLOY_SSH_USER` / `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`（远程 docker-compose 所在目录）

### 手动部署到新机器

```bash
# 远程机
mkdir -p /opt/misaka-web && cd /opt/misaka-web
cat > docker-compose.yml << 'EOF'
services:
  misaka-web:
    image: kelework/misaka-web:latest
    container_name: misaka-web
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/data
    ports:
      - "127.0.0.1:3000:3000"
EOF
cp <你的 .env> .env
docker compose up -d
```

然后 Cloudflare Tunnel 反代到 `127.0.0.1:3000`，绑域名（参考 `cf-tunnel` 技能）。

---

## 🤖 Telegram Bot

### 命令

```
/start <绑定码>     绑定 Web 账号（绑定码在 Web /telegram 页生成，5 分钟有效）
/status             检查 bot 是否在线
/tasks              查看我的下单任务
/orders             查看最近 5 笔订单
/balance            查看 misaka.io 账号余额（实时调 misaka API）
/pause <任务>       暂停指定任务（任务名或 ID 前缀模糊匹配）
/resume <任务>      启用指定任务
/unbind             解除当前 Telegram 绑定
/help               命令帮助
```

启动时自动调 `setMyCommands` 注册到 Telegram 输入框的 `/` 菜单。冷启动失败有 3 次重试。

### 通知

所有通知用 HTML parse_mode + emoji 标题 + 表格化键值排版。下单成功示例：

```
🎉 下单成功

任务    我的港机
区域    HKG12
机型    s3n-2c3g

订单    #37908
发票    #121935

💳 点击付款  ·  未付款发票将自动过期
```

---

## 🔧 运维

### 重要路径
- 数据库：`/app/data/misaka.db` (容器内) → `./data/misaka.db` (宿主)
- 备份：每次 schema migration 前手动 `cp data/misaka.db data/misaka.db.bak-$(date +%s)`
- 日志：`docker logs misaka-web`（无单独日志文件）

### 健康检查
- `GET /api/health` 返 `{workers: [...], overall: "healthy"|"degraded"|"down"}`，不需要 auth，可挂监控
- 前端 `HealthBanner` 每 30s 轮询，degraded/down 显示顶条警告

### 加密 key 轮换

```bash
docker compose stop misaka-web
NEW_KEY=$(openssl rand -hex 32)
docker compose run --rm \
  -e OLD_ENCRYPTION_KEY="$(grep ENCRYPTION_KEY .env | cut -d= -f2)" \
  -e NEW_ENCRYPTION_KEY="$NEW_KEY" \
  misaka-web \
  node_modules/.bin/tsx scripts/rotate-encryption-key.ts
# 成功后把 .env 里 ENCRYPTION_KEY 改成 $NEW_KEY，再起容器
docker compose up -d
```

脚本会自动备份 sqlite 到 `*.bak-rotate-<ts>`，事务内重加密所有 `misaka_accounts.passwordEncrypted` + `sessionCacheEncrypted`，任一失败回滚。

### 磁盘运维

小 VPS（≤10G）每 30 分钟自动 docker prune（参考 `/root/bin/docker-prune.sh`），不然 `next build` 中间产物 + 旧镜像层会很快撑爆 `/tmp`。

---

## 🤝 贡献

1. 从 main 切分支：`git checkout -b feat/xxx`
2. 写代码 + 必须跑 `npx tsc --noEmit` 干净 + `npm test` 全过
3. 推分支开 PR
4. CI（`pr-check.yml`）会自动跑 tsc + test + next build
5. CI 绿后合并到 main，自动 build + deploy

> Commit message 用中文描述变更主体，结构化分点更易 review。

---

## 🐛 已知限制

- **misaka.io 真实 API 协议** 是逆向出来的，misaka 改接口我们就要修（`lib/misaka/client.ts` 的 endpoint 路径硬编码）。
- **inventory poller** 是单进程，水平扩展需要外部锁（暂未需要）。
- **task-runner 竞态**：同一个 task 多次并发触发会导致 misaka 那边产生多余 order（虽然本地 DB 严格 ≤ targetCount，因为 sqlite 事务保护）。生产环境一般 task 命中库存只触发一次，问题不大。
- **Telegram bot 单点**：long-poll 进程同时只能跑一个实例，dev 跑时停 prod。如果要 dev+prod 同时跑，用不同 bot token。
- **付款** 不自动。下单后 invoice issued，需要用户手动点付款链接 → Stripe → misaka 收款 → 调 `POST /mc2/instances/from_orders/` 实例化。

---

## 📜 License

私有项目，不开源。

---

## 🙏 鸣谢

- [misaka.io](https://www.misaka.io) — 网络/路由真的牛
- [better-auth](https://better-auth.com) — 认证终于不痛苦了
- [Drizzle ORM](https://orm.drizzle.team) — 写 TS schema 太爽
- [grammY](https://grammy.dev) — Telegram bot 框架天花板
