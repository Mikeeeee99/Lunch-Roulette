# Lunch Roulette AI V1.0

一个帮助办公室用户快速决定每日午餐的随机转盘 Web App。

## 当前功能

- 12 家本地 JSON 餐厅数据
- 手动多选排除今天不想吃的餐厅
- 自动排除最近两个有记录的午餐日
- 等概率随机选择
- 转盘减速动画与结果展示
- “换一家”和最终确认
- 使用浏览器 localStorage 保存午餐记录

V1.0 不包含用户系统、数据库、AI 推荐或地图服务。

## 技术

- React
- JavaScript
- Tailwind CSS
- Vinext / Vite
- 本地 JSON 与 localStorage

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开终端显示的本地地址。

## 验证

```bash
npm run build
node --test tests/*.test.mjs
```

餐厅数据位于 `data/restaurants.json`，可以直接修改或增加餐厅。
