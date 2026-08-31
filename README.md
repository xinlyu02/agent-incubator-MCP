# Agent Incubator MCP

为 Joule Work Desktop 提供 F&S Agent Incubator 数据查询能力的 MCP（Model Context Protocol）服务器。用户在 Joule 里用自然语言提问，MCP 自动调用 Incubator API 返回结果。

**架构：** Joule Work → Incubator MCP → Agent Incubator API（afc-srv）

## 工具列表

| 工具 | 说明 |
|------|------|
| `search_ideas` | 按阶段、业务领域、关键词、负责人、客户搜索 idea，支持分页 |
| `get_idea_detail` | 查询单个 idea 的完整信息，包含问卷答案和客户推广记录 |
| `get_dashboard` | 查询总览 KPI：idea 总数、上线数量、各阶段分布 |

---

## 本地开发

### 前置条件
- Node.js 22+
- 本地 Agent Incubator 实例已启动（默认端口 4004）

### 初始化

```bash
npm install
cp .env.example .env
```

编辑 `.env`：
```
AUTH_MODE=mock
INCUBATOR_BASE_URL=http://localhost:4004
INCUBATOR_BASIC_AUTH=alice:
```

### 启动

```bash
npm run dev    # 在 3000 端口启动 MCP 服务器
npm test       # 运行单元测试 + 集成测试
```

### 在 Joule Work Desktop 里测试

1. 打开 Joule Work Desktop
2. Extensions → Connectors → Add Connector
3. URL 填 `http://localhost:3000/mcp`，Auth 选 None
4. 在 Joule 对话里提问，例如：*"帮我查一下 Agent Incubator 里的数据"*

### 用 PowerShell 直接测试

```powershell
# 列出所有工具
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/mcp" `
  -Headers @{"Authorization"="Bearer mock"; "Accept"="application/json, text/event-stream"} `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 查询总览数据
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/mcp" `
  -Headers @{"Authorization"="Bearer mock"; "Accept"="application/json, text/event-stream"} `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_dashboard","arguments":{}}}'

# 搜索 Live 阶段的 idea
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/mcp" `
  -Headers @{"Authorization"="Bearer mock"; "Accept"="application/json, text/event-stream"} `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_ideas","arguments":{"stage":"Live","limit":5}}}'
```

---

## 部署到 CF

### 前置条件
- 已安装 CF CLI 并登录
  ```bash
  cf login -a https://api.cf.eu12.hana.ondemand.com --origin alc4kxudf-platform
  ```
- 目标 space：`coe-gc-shared-hanacloud / DEV`

### 部署命令

```bash
npm run build
cf push
```

部署完成后地址：
```
https://agent-incubator-mcp.cfapps.eu12.hana.ondemand.com
```

验证是否正常：
```bash
curl https://agent-incubator-mcp.cfapps.eu12.hana.ondemand.com/health
# {"status":"ok","service":"incubator-mcp"}
```

### 认证说明

`manifest.yml` 使用 `AUTH_MODE=passthrough`——MCP 直接将 Joule 用户的 XSUAA token 转发给 `afc-srv`，无需单独绑定 XSUAA 服务实例（前提：MCP 和 Incubator 在同一个 BTP subaccount）。

---

## 配置 BTP Destination（Joule Work Desktop 连接 CF 版本必须）

部署完成后，在 **BTP Cockpit → Connectivity → Destinations** 新建：

| 字段 | 值 |
|------|----|
| Name | `agent-incubator-mcp` |
| URL | `https://agent-incubator-mcp.cfapps.eu12.hana.ondemand.com` |
| Authentication | `OAuth2JWTBearer`（或 `ForwardAuthToken`，视 Joule 配置而定） |
| Additional Property | `sap-joule-studio-mcp-server` = `true` |

然后在 Joule Work Desktop：
1. Extensions → Connectors → Add Connector
2. 选择 BTP Destination `agent-incubator-mcp`

---

## 环境变量说明

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 监听端口 |
| `AUTH_MODE` | `mock` | `mock` / `passthrough` / `xsuaa` |
| `INCUBATOR_BASE_URL` | `http://localhost:3001` | Agent Incubator API 地址 |
| `INCUBATOR_BASIC_AUTH` | — | 本地 CAP 开发服务器的 Basic Auth，格式 `alice:` |
| `XSUAA_URL` | — | 仅 `AUTH_MODE=xsuaa` 时需要 |
| `XSUAA_CLIENT_ID` | — | 仅 `AUTH_MODE=xsuaa` 时需要 |
| `XSUAA_CLIENT_SECRET` | — | 仅 `AUTH_MODE=xsuaa` 时需要 |

## 认证模式对比

| 模式 | 适用场景 |
|------|----------|
| `mock` | 本地开发，不需要真实认证 |
| `passthrough` | CF 部署，直接转发 Joule 的 XSUAA token（同一 BTP subaccount） |
| `xsuaa` | 跨 subaccount，需要用 XSUAA 凭据做 JWT bearer exchange |