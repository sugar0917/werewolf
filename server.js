const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // 前端網址
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("使用者連線", socket.id);

  socket.on("join_room", ({ roomId, username }) => {
    socket.join(roomId);
    console.log(`${username} 加入房間 ${roomId}`);
    // 可在此推播給其他人該玩家加入
  });

  socket.on("disconnect", () => {
    console.log("使用者離線", socket.id);
  });
});

server.listen(4000, () => {
  console.log("伺服器已啟動於 http://localhost:4000");
});