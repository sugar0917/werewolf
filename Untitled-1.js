// 完整狼人殺遊戲：前端 + 簡易後端框架（多人房間 + 身份分配 + 遊戲流程完整）

// 📁 專案結構建議：
// - client/  (React 前端)
// - server/  (Node.js + socket.io 後端)

// === server/index.js ===
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const roles = ["狼人", "預言家", "女巫", "獵人", "村民", "村民"];
let rooms = {};

io.on("connection", (socket) => {
  socket.on("join_room", ({ roomId, username }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = { players: [], votes: {}, phase: "waiting", chat: [] };
    rooms[roomId].players.push({ id: socket.id, name: username, alive: true });
    io.to(roomId).emit("room_update", rooms[roomId]);
  });

  socket.on("start_game", ({ roomId }) => {
    const room = rooms[roomId];
    const assignedRoles = [...roles].slice(0, room.players.length);
    assignedRoles.sort(() => Math.random() - 0.5);
    room.players.forEach((p, i) => {
      io.to(p.id).emit("role_assigned", assignedRoles[i]);
    });
    room.phase = "night";
    io.to(roomId).emit("game_started", room.phase);
  });

  socket.on("toggle_phase", (roomId) => {
    const room = rooms[roomId];
    room.phase = room.phase === "night" ? "day" : "night";
    room.votes = {};
    io.to(roomId).emit("phase_changed", room.phase);
  });

  socket.on("submit_vote", ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room.votes[targetId]) room.votes[targetId] = 0;
    room.votes[targetId]++;
    io.to(roomId).emit("vote_update", room.votes);

    // 若所有玩家都已投票
    const totalVotes = Object.values(room.votes).reduce((a, b) => a + b, 0);
    const aliveCount = room.players.filter(p => p.alive).length;
    if (totalVotes >= aliveCount) {
      let maxVotes = 0, eliminatedId = null;
      for (const [id, count] of Object.entries(room.votes)) {
        if (count > maxVotes) {
          maxVotes = count;
          eliminatedId = id;
        }
      }
      const eliminated = room.players.find(p => p.id === eliminatedId);
      if (eliminated) eliminated.alive = false;
      io.to(roomId).emit("player_eliminated", eliminated);

      // 檢查遊戲是否結束
      const alive = room.players.filter(p => p.alive);
      const wolves = alive.filter(p => p.role === "狼人").length;
      const villagers = alive.length - wolves;
      if (wolves === 0 || wolves >= villagers) {
        io.to(roomId).emit("game_over", wolves === 0 ? "村民勝利" : "狼人勝利");
      }
    }
  });

  socket.on("send_chat", ({ roomId, username, message }) => {
    const entry = { username, message };
    rooms[roomId].chat.push(entry);
    io.to(roomId).emit("chat_update", rooms[roomId].chat);
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
      io.to(roomId).emit("room_update", rooms[roomId]);
    }
  });
});

server.listen(4000, () => console.log("Server running on http://localhost:4000"));

// === client/src/App.jsx ===
import { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:4000");

export default function App() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  const [role, setRole] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [phase, setPhase] = useState("waiting");
  const [votes, setVotes] = useState({});
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState("");

  const joinRoom = () => {
    socket.emit("join_room", { roomId, username });
    setJoined(true);
  };

  const sendChat = () => {
    socket.emit("send_chat", { roomId, username, message });
    setMessage("");
  };

  useEffect(() => {
    socket.on("room_update", room => setPlayers(room.players));
    socket.on("role_assigned", setRole);
    socket.on("game_started", p => { setGameStarted(true); setPhase(p); });
    socket.on("phase_changed", setPhase);
    socket.on("vote_update", setVotes);
    socket.on("chat_update", setChat);
    socket.on("player_eliminated", (p) => alert(`${p.name} 被淘汰了！`));
    socket.on("game_over", result => alert(`遊戲結束：${result}`));
    return () => socket.disconnect();
  }, []);

  return (
    <div className="p-4 text-center">
      {!joined ? (
        <div className="space-y-2">
          <input placeholder="你的名字" onChange={e => setUsername(e.target.value)} className="border px-2" />
          <input placeholder="房間代碼" onChange={e => setRoomId(e.target.value)} className="border px-2" />
          <button onClick={joinRoom} className="bg-blue-500 text-white px-4 py-1">加入</button>
        </div>
      ) : (
        <div>
          <h2 className="text-xl mb-2">房間：{roomId} | 階段：{phase}</h2>
          <ul className="mb-2">
            {players.map(p => <li key={p.id}>{p.name} {p.alive === false && "(已淘汰)"}</li>)}
          </ul>
          {!gameStarted && (
            <button onClick={() => socket.emit("start_game", { roomId })} className="bg-green-500 text-white px-4 py-1">開始遊戲</button>
          )}
          {role && <p className="mt-2 text-lg font-bold">你的身份是：{role}</p>}

          {gameStarted && (
            <div className="mt-4 space-y-2">
              <button onClick={() => socket.emit("toggle_phase", roomId)} className="bg-yellow-500 text-white px-3">切換日/夜</button>
              <div>
                <h3>投票：</h3>
                {players.filter(p => p.alive !== false).map(p => (
                  <button key={p.id} onClick={() => socket.emit("submit_vote", { roomId, targetId: p.id })} className="mx-1 border px-2">
                    {p.name} ({votes[p.id] || 0}票)
                  </button>
                ))}
              </div>
              <div>
                <h3>聊天區：</h3>
                <div className="border h-32 overflow-y-scroll mb-2 bg-gray-100">
                  {chat.map((c, i) => <div key={i}><strong>{c.username}:</strong> {c.message}</div>)}
                </div>
                <input value={message} onChange={e => setMessage(e.target.value)} className="border px-2" />
                <button onClick={sendChat} className="bg-blue-500 text-white px-2">送出</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 
