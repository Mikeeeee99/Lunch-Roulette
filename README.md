# Lunch Roulette AI V2.0

一个帮助上海办公室用户从附近真实餐厅中快速决定每日午餐的随机转盘 Web App。

## V2 功能

- 首页点击后直接请求浏览器定位，并兼容 iPhone Safari 权限弹窗与拒绝恢复
- 高德地图、用户位置、范围圆和餐厅标记
- 5 / 10 / 15 分钟近似步行范围
- 30 / 40 / 50 元内或不限预算
- 高德附近餐饮 POI 与人均消费
- 定位后后台预加载，选择距离和预算后用一个主按钮进入餐厅排除页
- 午餐优先过滤，排除咖啡、茶饮、甜品和糕饼等非正餐门店
- 发现页地图默认折叠，需要时再展开
- 最近两个有记录的午餐日自动排除
- 手动排除今天不想吃的餐厅
- 最多 30 家等概率进入转盘，不足时全部进入；密集转盘和下方清单使用一致的餐厅简称，完整名称保留为悬停提示
- 30 色转盘避免相邻色块重复，餐厅简称沿扇区方向排列并自动翻转保持可读
- 自适应大转盘居中展示，点击圆心“开始转动”；候选清单在转盘下方完整展开，不使用内部滚动条
- 每次转动完成后弹出结果、地图高亮、“换一家”和最终确认
- 使用浏览器 localStorage 保存午餐历史

V2 不包含用户系统、数据库、AI 推荐、评分、路线规划、地图拖动搜索或多城市支持。

## 技术

- React 19 / JavaScript / JSX
- Tailwind CSS 4
- Vinext / Vite
- Cloudflare Worker
- 高德地图 JS API 2.0（地图展示）
- 高德 Web 服务 API V3（坐标转换、地址解析和周边搜索）
- localStorage

## 高德凭证

需要在高德开放平台创建一个应用并申请：

1. Web端（JS API）Key，用于浏览器地图展示。
2. Web服务 API Key，用于 Cloudflare Worker 转换坐标、解析地址和搜索附近餐厅。
3. Web端 Key 对应的 `securityJsCode`。

变量名称见 `.env.example`：

```text
NEXT_PUBLIC_AMAP_JS_KEY
AMAP_JS_SECURITY_CODE
AMAP_WEB_SERVICE_KEY
```

- `NEXT_PUBLIC_AMAP_JS_KEY` 会提供给浏览器，应在高德控制台限制允许域名。
- `AMAP_JS_SECURITY_CODE` 和 `AMAP_WEB_SERVICE_KEY` 是敏感值，部署时必须在 Cloudflare 中设置为 Secret。
- 不要把真实凭证写入源码、README、`.env.example` 或 Git。
- 当前设计用于非商业测试，并依赖高德账号包含的免费额度；额度及授权要求以高德控制台为准。

### Cloudflare 运行时配置

项目在 API 请求期间通过 Worker 运行时读取三项变量。部署时进入：

```text
Workers & Pages → lunch-roulette → Settings → Runtime variables and secrets
```

配置类型：

```text
NEXT_PUBLIC_AMAP_JS_KEY  Text
AMAP_JS_SECURITY_CODE    Secret
AMAP_WEB_SERVICE_KEY     Secret
```

不要只填写 Build 区域的 `Variables and secrets`；构建变量不会提供给运行中的 Worker。添加或修改运行时变量后必须点击 `Deploy`，并在 `Deployments` 中确认包含新配置的版本承接 100% 流量。

## 本地运行

需要 Node.js 22.13 或更高版本。

1. 复制 `.env.example` 为 `.env` 或 `.dev.vars`。
2. 填写三项高德凭证。
3. 安装依赖并启动：

```bash
npm install
npm run dev
```

本地变量文件已经被 `.gitignore` 排除。缺少凭证时页面仍能打开，但会明确提示地图服务尚未配置，不能搜索真实餐厅。

### iPhone Safari 定位

- 定位请求只会在用户点击“寻找附近午餐”或“重新定位”时发起，不会在页面加载后自动索取权限。
- 正式网站必须使用 HTTPS；HTTP 页面无法使用浏览器定位。
- 如果 Safari 没有再次弹出权限框，可能是此前已选择“不允许”。请在 Safari 地址栏的页面菜单 → 网站设置 → 位置中改为“询问”或“允许”，然后点击“我已开启权限，重新定位”。
- 如仍失败，请检查 iPhone 设置 → 隐私与安全性 → 定位服务中 Safari 网站的权限。

## 验证

```bash
npm run lint
npm test
```

`npm test` 会先构建 Cloudflare 兼容产物，再运行业务规则、服务端接口和服务端渲染测试。

## 数据与隐私

- 浏览器获取的原始 GPS 坐标通过 POST 发送给同域 Worker，由 Worker 使用 Web 服务 Key 转换为高德坐标并解析地址。
- 精确位置只用于当前页面会话，不写入 localStorage。
- 附近餐厅结果只缓存在当前页面内存中。
- 相同位置与距离优先复用页面缓存；调整预算不会重复请求高德。
- 前端通过 POST 把高德坐标发送给同域 Worker，坐标不会出现在页面 URL。
- 午餐历史继续使用 `lunch-roulette-history-v1`，V1 旧记录可以继续读取。
- 不记录或展示餐厅评分；价格缺失时显示“价格未知”。
