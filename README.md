# 線上狼人殺遊戲

這是一個使用 React 和 Socket.IO 開發的線上狼人殺遊戲。

## 功能特點

- 即時多人遊戲
- 語音聊天功能
- 角色分配系統
- 投票系統
- 獵人技能
- 女巫技能
- 預言家技能

## 技術棧

- 前端：React
- 後端：Node.js + Express
- 即時通訊：Socket.IO
- 語音通訊：WebRTC

## 本地開發

1. 安裝依賴：
```bash
npm install
cd client
npm install
cd ..
```

2. 啟動開發伺服器：
```bash
npm run dev
```

3. 開啟瀏覽器訪問：
```
http://localhost:3000
```

## 部署

1. 建置前端：
```bash
cd client
npm run build
cd ..
```

2. 啟動伺服器：
```bash
npm start
```

## 遊戲規則

1. 遊戲開始時，系統會隨機分配角色
2. 夜晚階段：
   - 狼人可以選擇擊殺目標
   - 預言家可以查驗玩家身份
   - 女巫可以使用解藥或毒藥
3. 白天階段：
   - 玩家可以發言討論
   - 進行投票放逐
4. 特殊角色技能：
   - 獵人：死亡時可以帶走一名玩家
   - 女巫：可以使用解藥救人，或使用毒藥毒死一名玩家
   - 預言家：可以查驗玩家身份

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 授權

MIT License 