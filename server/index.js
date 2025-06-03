// === server/index.js ===
// 本檔案為完整對應 client/src/App.js 的後端程式碼
// 包含角色分配、夜晚行動同步、白天投票、平票處理、視覺狀態通知等功能

// === 完整後端程式碼放置於此 ===
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
// CORS for HTTP routes (REST API, if any)
app.use(cors({
  origin: "https://werewolf-client.onrender.com", // 改為你 Render 前端網址
  methods: ["GET", "POST"],
  credentials: true
}));

const server = http.createServer(app);

// CORS for WebSocket (Socket.IO)
const io = new Server(server, {
  cors: {
    origin: "https://werewolf-client.onrender.com", // 這裡也要改
    methods: ["GET", "POST"],
    credentials: true
  }
});

let rooms = {};
let gameStarted = {};
let gamePhases = {};
let playerRoles = {};
let nightActions = {};
let prophetActions = {};
let witchStates = {};
let pendingDeath = {};
let nightDone = {};
let dayVotes = {};
let voteRound = {};
let lastNightDeaths = {};
let hunterTarget = {};
let hunterTriggered = {};
let deathByWitch = {};
let speakingOrder = {};
let currentSpeaker = {};
let speakingTimer = {};

const getRolesByPlayerCount = (count) => {
  if (count < 6) return [];
  if (count === 6) return ["狼人", "狼人", "預言家", "女巫", "獵人", "村民"];
  if (count === 7) return ["狼人", "狼人", "預言家", "女巫", "獵人", "村民", "村民"];
  if (count === 8) return ["狼人", "狼人", "預言家", "女巫", "獵人", "村民", "村民", "村民"];
  return [];
};

const broadcastPlayerStates = (roomId) => {
  const states = Object.entries(playerRoles)
    .filter(([_, p]) => p.roomId === roomId)
    .map(([id, p]) => ({ id, username: p.username, alive: p.alive }));
  io.to(roomId).emit("player_states", states);
};

const isAllNightActionsComplete = (roomId) => {
  const alive = (role) => Object.entries(playerRoles).some(
    ([_, p]) => p.roomId === roomId && p.role === role && p.alive
  );
  const done = nightDone[roomId] || {};
  return (!alive("狼人") || done.werewolf)
    && (!alive("女巫") || done.witch)
    && (!alive("預言家") || done.prophet);
};

const checkNightComplete = (roomId) => {
  console.log(`[Room ${roomId}] 檢查夜晚是否完成...`);
  if (!isAllNightActionsComplete(roomId)) {
      console.log(`[Room ${roomId}] 夜晚行動未全部完成`);
      return;
  }

  console.log(`[Room ${roomId}] 夜晚行動完成，處理結果`);
  const results = [];
  const deathId = pendingDeath[roomId];
  if (deathId && playerRoles[deathId]) {
    playerRoles[deathId].alive = false;
    results.push(deathId);
    console.log(`[Room ${roomId}] 夜晚死亡玩家: ${playerRoles[deathId]?.username || deathId}`);
    if (playerRoles[deathId].role === "獵人" && !deathByWitch[deathId] && !hunterTriggered[deathId]) {
      hunterTriggered[deathId] = true;
      console.log(`[Room ${roomId}] 死亡玩家是獵人，觸發技能標記`);
    }
  }

  const poisoned = Object.entries(playerRoles)
    .filter(([_, p]) => p.roomId === roomId && !p.alive)
    .map(([id]) => id);
  poisoned.forEach(id => {
    if (!results.includes(id)) results.push(id);
  });
  console.log(`[Room ${roomId}] 實際死亡玩家 (包含中毒): ${results.map(id => playerRoles[id]?.username || id).join(', ')}`);

  lastNightDeaths[roomId] = results; // 記錄夜晚死亡玩家，用於獵人判斷
  results.forEach(id => io.to(roomId).emit("night_result", id));
  const summary = results.length === 0 ? ["平安夜"] : results.map(id => playerRoles[id]?.username || "未知");
  io.to(roomId).emit("night_summary", summary); // 通知夜晚結果

  const gameEnds = checkGameEnd(roomId); // 檢查遊戲是否結束
  console.log(`[Room ${roomId}] 檢查遊戲是否結束: ${gameEnds}`);

  if (gameEnds) {
    console.log(`[Room ${roomId}] 遊戲結束，不清空夜晚狀態`);
    // 遊戲結束時，不清空夜晚狀態，讓前端顯示結果
    // nightActions[roomId] = {};
    // prophetActions[roomId] = {};
    // witchStates[roomId] = { canUseSave: true, canUsePoison: true };
    // pendingDeath[roomId] = null;
    // nightDone[roomId] = { werewolf: false, witch: false, prophet: false };
    return;
  }

  // 遊戲未結束，判斷下一階段
  console.log(`[Room ${roomId}] 遊戲未結束，判斷下一階段`);
  const hunterDied = results.find(id => playerRoles[id]?.role === "獵人" && hunterTriggered[id]); // 檢查是否有觸發技能的獵人死亡
  console.log(`[Room ${roomId}] 是否有觸發技能的獵人死亡: ${hunterDied ? playerRoles[hunterDied]?.username || hunterDied : '否'}`);

  // 清空夜晚狀態 (在判斷完獵人階段後)
  nightActions[roomId] = {};
  prophetActions[roomId] = {};
  // witchStates[roomId] = { canUseSave: true, canUsePoison: true }; // 女巫狀態保留到白天或遊戲結束
  pendingDeath[roomId] = null;
  nightDone[roomId] = { werewolf: false, witch: false, prophet: false };

  // 加入 3 秒延遲
  setTimeout(() => {
    if (hunterDied) {
      console.log(`[Room ${roomId}] 進入獵人階段`);
      gamePhases[roomId] = "hunter";
      io.to(roomId).emit("phase_changed", "hunter");
      // 通知獵人發動技能
      io.to(hunterDied).emit("hunter_trigger", {
        players: Object.entries(playerRoles)
          .filter(([id, p]) => p.roomId === roomId && p.alive) // 獵人只能帶走活人
          .map(([id, p]) => ({ id, username: p.username }))
      });
    } else {
      console.log(`[Room ${roomId}] 進入白天階段`);
      gamePhases[roomId] = "day";
      io.to(roomId).emit("phase_changed", "day");
      broadcastPlayerStates(roomId); // 通知玩家狀態變化
      dayVotes[roomId] = {}; // 重置白天投票狀態
      voteRound[roomId] = 1; // 重置投票輪數
      // 女巫狀態保留
    }
  }, 3000);
};

const checkGameEnd = (roomId) => {
  const players = Object.entries(playerRoles).filter(([_, p]) => p.roomId === roomId);
  const alivePlayers = players.filter(([_, p]) => p.alive);
  const aliveWolves = alivePlayers.filter(([_, p]) => p.role === "狼人");
  const aliveGood = alivePlayers.filter(([_, p]) => p.role !== "狼人"); // 好人包含所有非狼人角色

  console.log(`[Room ${roomId}] 檢查遊戲結束 - 存活玩家: ${alivePlayers.length}, 存活狼人: ${aliveWolves.length}, 存活好人: ${aliveGood.length}`);

  if (aliveWolves.length === 0 && alivePlayers.length > 0) { // 狼人全滅，且還有活人
    console.log(`[Room ${roomId}] 遊戲結束 - 好人獲勝`);
    io.to(roomId).emit("game_end", { winner: "好人" });
    gameStarted[roomId] = false;
    return true;
  }
  // 狼人數量大於等於好人數量 (狼人獲勝)
  if (aliveWolves.length >= aliveGood.length && aliveWolves.length > 0) { // 確保至少有一隻狼
    console.log(`[Room ${roomId}] 遊戲結束 - 狼人獲勝`);
    io.to(roomId).emit("game_end", { winner: "狼人" });
    gameStarted[roomId] = false;
    return true;
  }
   // 所有人都死亡 (理論上不太會發生，除非毒死最後一個... 視為狼人獲勝)
   if (alivePlayers.length === 0) {
        console.log(`[Room ${roomId}] 遊戲結束 - 所有玩家死亡，狼人獲勝`);
        io.to(roomId).emit("game_end", { winner: "狼人" });
        gameStarted[roomId] = false;
        return true;
   }

  return false;
};

const validateInput = (input) => {
  return input && input.trim().length > 0 && input.length <= 20;
};

io.on("connection", (socket) => {
  socket.on("get_room_list", () => {
    const roomList = Object.entries(rooms).map(([id, players]) => ({
      id,
      name: id,
      players: players,
      maxPlayers: 8 // 設定最大玩家數
    }));
    socket.emit("room_list", roomList);
  });

  socket.on("create_room", ({ roomName, username }) => {
    if (!validateInput(roomName) || !validateInput(username)) {
      socket.emit("error_message", "房間名稱和暱稱不能為空，且長度不能超過20個字元");
      return;
    }

    // 檢查房間名稱是否已存在
    if (rooms[roomName]) {
      socket.emit("error_message", "此房間名稱已被使用");
      return;
    }

    // 創建新房間
    rooms[roomName] = [];
    socket.join(roomName);
    rooms[roomName].push({ id: socket.id, username });
    
    // 通知所有客戶端更新房間列表
    io.emit("room_list", Object.entries(rooms).map(([id, players]) => ({
      id,
      name: id,
      players: players,
      maxPlayers: 8
    })));

    // 通知房間內的所有玩家
    io.to(roomName).emit("room_users", rooms[roomName]);
    const roles = getRolesByPlayerCount(rooms[roomName].length);
    io.to(roomName).emit("room_roles_preview", roles);
  });

  socket.on("join_room", ({ roomId, username }) => {
    if (!validateInput(roomId) || !validateInput(username)) {
      socket.emit("error_message", "房號和暱稱不能為空，且長度不能超過20個字元");
      return;
    }

    // 檢查房間是否存在
    if (!rooms[roomId]) {
      socket.emit("error_message", "房間不存在");
      return;
    }

    // 檢查房間是否已滿
    if (rooms[roomId].length >= 8) {
      socket.emit("error_message", "房間已滿");
      return;
    }

    // 檢查是否已經在房間中
    const existingPlayer = Object.values(playerRoles).find(
      p => p.roomId === roomId && p.username === username
    );
    if (existingPlayer) {
      socket.emit("error_message", "此暱稱已被使用");
      return;
    }

    socket.join(roomId);
    rooms[roomId].push({ id: socket.id, username });
    
    // 通知所有客戶端更新房間列表
    io.emit("room_list", Object.entries(rooms).map(([id, players]) => ({
      id,
      name: id,
      players: players,
      maxPlayers: 8
    })));

    // 通知房間內的所有玩家
    io.to(roomId).emit("room_users", rooms[roomId]);
    const roles = getRolesByPlayerCount(rooms[roomId].length);
    io.to(roomId).emit("room_roles_preview", roles);
  });

  socket.on("start_game", (roomId) => {
    console.log(`[Room ${roomId}] 收到開始遊戲請求`, {
      roomExists: !!rooms[roomId],
      gameStarted: gameStarted[roomId],
      players: rooms[roomId]?.length || 0
    });

    if (!rooms[roomId] || gameStarted[roomId]) {
      socket.emit("error_message", "房間不存在或遊戲已開始");
      return;
    }
    // 隨機打亂房間內玩家順序
    rooms[roomId] = rooms[roomId].sort(() => Math.random() - 0.5);

    const players = [...rooms[roomId]];
    const roles = getRolesByPlayerCount(players.length);
    console.log(`[Room ${roomId}] 玩家數量和角色數量`, {
      playerCount: players.length,
      roleCount: roles.length
    });

    if (roles.length !== players.length) {
      socket.emit("error_message", "人數與角色數不符");
      return;
    }
    gameStarted[roomId] = true;
    const shuffledRoles = roles.sort(() => Math.random() - 0.5);
    players.forEach((player, i) => {
      playerRoles[player.id] = {
        roomId,
        username: player.username,
        role: shuffledRoles[i],
        alive: true
      };
    });
    players.forEach(player => {
      io.to(player.id).emit("your_role", playerRoles[player.id].role);
    });
    gamePhases[roomId] = "night";
    io.to(roomId).emit("phase_changed", "night");
    io.to(roomId).emit("game_started");
    nightActions[roomId] = {};
    prophetActions[roomId] = {};
    witchStates[roomId] = { canUseSave: true, canUsePoison: true };
    pendingDeath[roomId] = null;
    nightDone[roomId] = { werewolf: false, witch: false, prophet: false };
    lastNightDeaths[roomId] = [];
    broadcastPlayerStates(roomId);
    console.log(`[Room ${roomId}] 遊戲開始`);

    const wolves = players.filter(p => playerRoles[p.id].role === "狼人" && playerRoles[p.id].alive);
    wolves.forEach(wolf => {
      const teammates = wolves.filter(w => w.id !== wolf.id && playerRoles[w.id].alive).map(w => ({ id: w.id, username: w.username }));
      const targets = players.filter(p => playerRoles[p.id].alive).map(p => ({ id: p.id, username: p.username }));
      io.to(wolf.id).emit("night_werewolf_info", { teammates, targets });
    });

    speakingOrder[roomId] = [];
    currentSpeaker[roomId] = null;
    speakingTimer[roomId] = null;
  });

  socket.on("werewolf_kill", ({ roomId, targetId }) => {
    if (!nightActions[roomId]) nightActions[roomId] = {};
    if (!playerRoles[socket.id]?.alive) return;
    nightActions[roomId][socket.id] = targetId;
    const aliveWolves = Object.entries(playerRoles)
      .filter(([_, p]) => p.roomId === roomId && p.role === "狼人" && p.alive);
    if (Object.keys(nightActions[roomId]).length >= aliveWolves.length) {
      const countMap = {};
      Object.values(nightActions[roomId]).forEach(id => {
        countMap[id] = (countMap[id] || 0) + 1;
      });
      const max = Math.max(...Object.values(countMap));
      const candidates = Object.entries(countMap).filter(([_, v]) => v === max).map(([id]) => id);
      const finalTarget = candidates[Math.floor(Math.random() * candidates.length)];
      pendingDeath[roomId] = finalTarget;
      nightDone[roomId].werewolf = true;

      const witch = Object.entries(playerRoles).find(([_, p]) => p.roomId === roomId && p.role === "女巫" && p.alive);
      if (witch) {
        io.to(witch[0]).emit("witch_night_action", {
          targetId: finalTarget,
          targetName: playerRoles[finalTarget]?.username || "未知",
          canUseSave: witchStates[roomId].canUseSave,
          canUsePoison: witchStates[roomId].canUsePoison,
          players: Object.entries(playerRoles)
            .filter(([id, p]) => p.roomId === roomId && p.alive && id !== witch[0])
            .map(([id, p]) => ({ id, username: p.username }))
        });
      } else {
        nightDone[roomId].witch = true;
        checkNightComplete(roomId);
      }
    }
    console.log(`[Room ${roomId}] 狼人投票擊殺目標: ${playerRoles[targetId]?.username || targetId}`);
  });

  socket.on("witch_decision", ({ roomId, save, poisonId }) => {
    if (!witchStates[roomId]) return;
    if (!playerRoles[socket.id]?.alive) return;
    const targetId = pendingDeath[roomId];
    if (save && witchStates[roomId].canUseSave) {
      pendingDeath[roomId] = null;
      witchStates[roomId].canUseSave = false;
    }
    if (poisonId && witchStates[roomId].canUsePoison) {
      if (playerRoles[poisonId]) {
        playerRoles[poisonId].alive = false;
        deathByWitch[poisonId] = true;
      }
      witchStates[roomId].canUsePoison = false;
    }
    nightDone[roomId].witch = true;
    checkNightComplete(roomId);
    console.log(`[Room ${roomId}] 女巫決定 - 救人: ${save}, 毒人: ${poisonId ? (playerRoles[poisonId]?.username || poisonId) : '無'}`);
  });

  socket.on("prophet_check", ({ roomId, targetId }) => {
    if (!prophetActions[roomId]) prophetActions[roomId] = {};
    if (!playerRoles[socket.id]?.alive) return;
    const targetPlayer = playerRoles[targetId];
    if (!targetPlayer || targetPlayer.roomId !== roomId) {
      socket.emit("error_message", "查無玩家");
      return;
    }
    const isWerewolf = targetPlayer.role === "狼人";
    socket.emit("prophet_result", { targetId, isWerewolf });
    prophetActions[roomId][socket.id] = true;
    nightDone[roomId].prophet = true;
    checkNightComplete(roomId);
    console.log(`[Room ${roomId}] 預言家查驗目標: ${playerRoles[targetId]?.username || targetId}`);
  });

  socket.on("day_vote", ({ roomId, targetId }) => {
    if (!dayVotes[roomId]) dayVotes[roomId] = {};
    if (!playerRoles[socket.id]?.alive) return;
    dayVotes[roomId][socket.id] = targetId;
    const alivePlayers = Object.entries(playerRoles)
      .filter(([_, p]) => p.roomId === roomId && p.alive).map(([id]) => id);
    const votes = dayVotes[roomId];
    if (Object.keys(votes).length >= alivePlayers.length) {
      const countMap = {};
      Object.values(votes).forEach(id => {
        if (id) countMap[id] = (countMap[id] || 0) + 1;
      });
      const max = Math.max(...Object.values(countMap));
      const candidates = Object.entries(countMap).filter(([_, v]) => v === max).map(([id]) => id);
      const voteList = Object.entries(votes).map(([from, to]) => ({ from, to }));

      if (voteRound[roomId] === 1 && candidates.length > 1) {
        const allVoters = Object.keys(votes);
        const secondRoundVoters = allVoters.filter(id => !candidates.includes(id));
        dayVotes[roomId] = {}; // reset votes
        voteRound[roomId] = 2;
        io.to(roomId).emit("vote_result", { eliminated: null, voteList, reason: "平票，重新投票" });
        io.to(roomId).emit("second_vote", { 
          candidates,
          excludedVoters: candidates,
          eligibleVoters: secondRoundVoters
        });
        return;
      }

      if (voteRound[roomId] === 2 && candidates.length > 1) {
        io.to(roomId).emit("vote_result", { eliminated: null, voteList, reason: "平票無人被放逐" });
        setTimeout(() => {
          gamePhases[roomId] = "night";
          io.to(roomId).emit("phase_changed", "night");
        }, 3000);
        return;
      }

      const finalOut = candidates[Math.floor(Math.random() * candidates.length)];
      if (playerRoles[finalOut]) {
        playerRoles[finalOut].alive = false;
        if (playerRoles[finalOut].role === "獵人" && !deathByWitch[finalOut] && !hunterTriggered[finalOut]) {
          hunterTriggered[finalOut] = true;
          io.to(roomId).emit("vote_result", { 
            eliminated: finalOut, 
            voteList,
            reason: `${playerRoles[finalOut].username} 被放逐，發動獵人技能`
          });
          broadcastPlayerStates(roomId);
          gamePhases[roomId] = "hunter";
          io.to(roomId).emit("phase_changed", "hunter");
          io.to(finalOut).emit("hunter_trigger", {
            players: Object.entries(playerRoles)
              .filter(([id, p]) => p.roomId === roomId && p.alive)
              .map(([id, p]) => ({ id, username: p.username }))
          });
          return;
        }
      }
      io.to(roomId).emit("vote_result", { eliminated: finalOut, voteList });
      broadcastPlayerStates(roomId);
      
      if (!checkGameEnd(roomId)) {
        setTimeout(() => {
          gamePhases[roomId] = "night";
          io.to(roomId).emit("phase_changed", "night");
        }, 3000);
      }
    }
    console.log(`[Room ${roomId}] 白天投票: ${playerRoles[socket.id]?.username || socket.id} -> ${targetId ? (playerRoles[targetId]?.username || targetId) : '棄票'}`);
  });

  socket.on("get_werewolf_votes", (roomId) => {
    socket.emit("werewolf_votes", {
      votes: nightActions[roomId] || {}
    });
  });

  socket.on("restart_game", (roomId) => {
    if (!rooms[roomId]) return;
    
    // 重置遊戲狀態
    gameStarted[roomId] = true;
    gamePhases[roomId] = "night";
    nightActions[roomId] = {};
    prophetActions[roomId] = {};
    witchStates[roomId] = { canUseSave: true, canUsePoison: true };
    pendingDeath[roomId] = null;
    nightDone[roomId] = { werewolf: false, witch: false, prophet: false };
    lastNightDeaths[roomId] = [];
    dayVotes[roomId] = {};
    voteRound[roomId] = 1;

    // 重置玩家狀態
    Object.entries(playerRoles).forEach(([id, player]) => {
      if (player.roomId === roomId) {
        player.alive = true;
      }
    });

    // 重新分配角色
    const players = [...rooms[roomId]];
    const roles = getRolesByPlayerCount(players.length);
    const shuffledRoles = roles.sort(() => Math.random() - 0.5);
    players.forEach((player, i) => {
      playerRoles[player.id] = {
        roomId,
        username: player.username,
        role: shuffledRoles[i],
        alive: true
      };
    });

    // 通知所有玩家
    players.forEach(player => {
      io.to(player.id).emit("your_role", playerRoles[player.id].role);
    });
    io.to(roomId).emit("phase_changed", "night");
    broadcastPlayerStates(roomId);
    io.to(roomId).emit("game_restarted");

    // 通知狼人隊友
    const wolves = players.filter(p => playerRoles[p.id].role === "狼人");
    wolves.forEach(wolf => {
      const teammates = wolves.filter(w => w.id !== wolf.id).map(w => ({ id: w.id, username: w.username }));
      const targets = players.filter(p => playerRoles[p.id].alive).map(p => ({ id: p.id, username: p.username }));
      io.to(wolf.id).emit("night_werewolf_info", { teammates, targets });
    });

    hunterTarget[roomId] = null;
    hunterTriggered = {};
    deathByWitch = {};
  });

  socket.on("hunter_shoot", ({ roomId, targetId }) => {
    if (playerRoles[socket.id].role !== "獵人") {
      socket.emit("error_message", "不是獵人角色，無法開槍");
      return;
    }
    if (!hunterTriggered[socket.id]) {
      socket.emit("error_message", "獵人技能未觸發");
      return;
    }
    
    const targetPlayer = playerRoles[targetId];
    if (!targetPlayer || !targetPlayer.alive || targetPlayer.roomId !== roomId) {
      socket.emit("error_message", "無效的目標");
      return;
    }

    targetPlayer.alive = false;
    hunterTarget[roomId] = targetId;
    hunterTriggered[socket.id] = false;

    broadcastPlayerStates(roomId);
    
    io.to(roomId).emit("hunter_result", {
      hunterId: socket.id,
      hunterName: playerRoles[socket.id].username,
      targetId: targetId,
      targetName: targetPlayer.username
    });

    if (checkGameEnd(roomId)) return;

    const isNightDeath = lastNightDeaths[roomId]?.includes(socket.id);
    
    if (isNightDeath) {
      setTimeout(() => {
        gamePhases[roomId] = "day";
        io.to(roomId).emit("phase_changed", "day");
        dayVotes[roomId] = {};
        voteRound[roomId] = 1;
        broadcastPlayerStates(roomId);
      }, 3000);
    } else {
      setTimeout(() => {
        gamePhases[roomId] = "night";
        io.to(roomId).emit("phase_changed", "night");
        nightActions[roomId] = {};
        prophetActions[roomId] = {};
        witchStates[roomId] = { canUseSave: true, canUsePoison: true };
        pendingDeath[roomId] = null;
        nightDone[roomId] = { werewolf: false, witch: false, prophet: false };
        broadcastPlayerStates(roomId);
      }, 3000);
    }
    console.log(`[Room ${roomId}] 獵人開槍目標: ${targetId ? (playerRoles[targetId]?.username || targetId) : '無'}`);
  });

  socket.on("disconnect", () => {
    console.log(`[Room ${Object.values(playerRoles).find(p => p.id === socket.id)?.roomId || '未知'}] 玩家斷開連接: ${socket.id}`);
    
    // 更新房間列表
    for (let roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(u => u.id !== socket.id);
      
      // 如果房間空了，刪除房間
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      } else {
        io.to(roomId).emit("room_users", rooms[roomId]);
        const roles = getRolesByPlayerCount(rooms[roomId].length);
        io.to(roomId).emit("room_roles_preview", roles);
      }
    }

    // 通知所有客戶端更新房間列表
    io.emit("room_list", Object.entries(rooms).map(([id, players]) => ({
      id,
      name: id,
      players: players,
      maxPlayers: 8
    })));

    delete playerRoles[socket.id];
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
    socket.emit("error_message", "發生錯誤，請重新整理頁面");
  });

  socket.on("phase_changed", (phase) => {
    const roomId = Object.values(playerRoles).find(p => p.id === socket.id)?.roomId;
    if (!roomId) return;

    console.log(`[Room ${roomId}] 收到 phase_changed 事件: ${phase}`);

    if (phase === "day") {
      // 停止所有發言
      stopSpeaking(roomId);
      // 通知所有玩家關閉狼人聊天
      io.to(roomId).emit("voice_chat", {
        type: "werewolf_chat",
        data: { enabled: false }
      });

      // 隨機選擇一個玩家開始發言
      const alivePlayers = Object.entries(playerRoles)
        .filter(([_, p]) => p.roomId === roomId && p.alive)
        .map(([id]) => id);

      if (alivePlayers.length > 0) {
        // 隨機打亂發言順序
        const shuffledPlayers = alivePlayers.sort(() => Math.random() - 0.5);
        speakingOrder[roomId] = shuffledPlayers;

        // 通知所有玩家發言順序
        io.to(roomId).emit("voice_chat", {
          type: "speaking_order",
          data: { order: speakingOrder[roomId] }
        });

        // 直接開始第一個玩家發言，移除延遲
        startSpeaking(roomId, speakingOrder[roomId][0]);

      } else {
        // 沒有存活玩家，直接進入投票或遊戲結束
        // 考慮遊戲結束條件... 如果遊戲未結束，進入投票
         if (!checkGameEnd(roomId)) {
             io.to(roomId).emit("phase_changed", "day_voting"); // 假設沒有存活玩家直接投票
         }
      }
    } else if (phase === "night") {
       // ... 夜晚階段邏輯 ...
       stopSpeaking(roomId); // 確保夜晚開始時停止任何白天的發言計時
        // 如果是狼人，啟用狼人聊天
      const wolves = Object.entries(playerRoles)
        .filter(([_, p]) => p.roomId === roomId && p.role === "狼人" && p.alive)
        .map(([id]) => id);

      wolves.forEach(wolfId => {
        io.to(wolfId).emit("voice_chat", {
          type: "werewolf_chat",
          data: { enabled: true }
        });
      });
    } else if (phase === "day_voting") {
        // 白天投票階段邏輯...
        stopSpeaking(roomId); // 確保發言階段結束時停止計時
    } else if (phase === "hunter") {
         // 獵人階段邏輯...
         stopSpeaking(roomId); // 確保發言階段結束時停止計時
    }
  });

  socket.on("stop_speaking", ({ roomId }) => {
    // 提前結束發言的邏輯已併入 stopSpeaking 輔助函數
    stopSpeaking(roomId);
  });

  socket.on("game_end", ({ roomId }) => {
    // ... 現有的代碼 ...
    stopSpeaking(roomId);
    delete speakingOrder[roomId];
    delete currentSpeaker[roomId];
    delete speakingTimer[roomId];
  });

  // 處理 WebRTC 信令
  socket.on("rtc_signal", ({ type, to, data }) => {
    // 檢查 to 是否存在於 socket.io 連線中
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit("rtc_signal", {
        type,
        from: socket.id,
        data
      });
    }
  });

  socket.on("werewolf_chat_message", ({ roomId, message }) => {
    // 檢查發送者是否為活著的狼人
    const player = playerRoles[socket.id];
    if (!player || player.roomId !== roomId || player.role !== "狼人" || !player.alive) return;
    // 找出同房間活著的狼人
    const wolves = Object.entries(playerRoles)
      .filter(([_, p]) => p.roomId === roomId && p.role === "狼人" && p.alive)
      .map(([id]) => id);
    // 廣播訊息給所有狼人
    wolves.forEach(wolfId => {
      io.to(wolfId).emit("werewolf_chat_message", {
        from: player.username,
        message
      });
    });
  });
});

// 添加全域錯誤處理
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});

server.listen(4000, () => {
  console.log("伺服器啟動於 http://localhost:4000");
});

// 輔助函數：開始發言
function startSpeaking(roomId, speakerId) {
  console.log(`[Room ${roomId}] 嘗試開始發言 - 發言者: ${speakerId}, 發言順序: ${speakingOrder[roomId]?.join(', ') || '無'}`);
  if (!speakerId || !playerRoles[speakerId] || !playerRoles[speakerId].alive) {
      console.log(`[Room ${roomId}] 嘗試讓已死亡或無效玩家發言: ${speakerId}`);
      // 找到下一個存活玩家或結束發言
      const order = speakingOrder[roomId] || [];
      const currentIndex = order.indexOf(speakerId);
      const nextIndex = (currentIndex + 1);
      if (nextIndex < order.length) {
         startSpeaking(roomId, order[nextIndex]); // 嘗試讓下一個玩家發言
      } else {
         // 所有人都發言完畢
         io.to(roomId).emit("voice_chat", { type: "speaking_order", data: { order: [] } }); // 清空發言順序顯示
         io.to(roomId).emit("phase_changed", "day_voting"); // 進入白天投票階段
      }
      return;
  }
  currentSpeaker[roomId] = speakerId;

  // 通知所有玩家當前發言者和發言時間 (120秒)
  io.to(roomId).emit("voice_chat", {
    type: "start_speaking",
    data: { speakerId, time: 120 }
  });

  // 設置計時器
  speakingTimer[roomId] = setTimeout(() => {
    console.log(`[Room ${roomId}] ${playerRoles[speakerId]?.username || speakerId} 發言時間到`);
    stopSpeaking(roomId);
  }, 120000); // 120秒

  console.log(`[Room ${roomId}] ${playerRoles[speakerId]?.username || speakerId} 開始發言`);
}

// 輔助函數：停止發言
function stopSpeaking(roomId) {
  console.log(`[Room ${roomId}] 停止當前發言`);
  if (speakingTimer[roomId]) {
    clearTimeout(speakingTimer[roomId]);
    speakingTimer[roomId] = null;
  }

  const speakerId = currentSpeaker[roomId];
  if (speakerId) {
    io.to(roomId).emit("voice_chat", {
      type: "stop_speaking",
      data: { speakerId }
    });
    currentSpeaker[roomId] = null;

    // 找到發言順序和當前發言者的索引
    const order = speakingOrder[roomId] || [];
    const currentIndex = order.indexOf(speakerId);
    const nextIndex = (currentIndex + 1);

    // 如果還有下一個發言者（索引未超出順序範圍），開始下一位發言
    if (nextIndex < order.length) {
      const nextSpeaker = order[nextIndex];
       console.log(`[Room ${roomId}] 輪到下一位發言者: ${playerRoles[nextSpeaker]?.username || nextSpeaker}`);
      startSpeaking(roomId, nextSpeaker);
    } else {
      // 所有人都發言完畢，進入投票階段
      console.log(`[Room ${roomId}] 所有玩家發言完畢，進入投票階段`);
      speakingOrder[roomId] = []; // 清空發言順序
      io.to(roomId).emit("voice_chat", { type: "speaking_order", data: { order: [] } }); // 通知前端清空顯示
      io.to(roomId).emit("phase_changed", "day_voting"); // 進入白天投票階段
    }
  } else {
      console.log(`[Room ${roomId}] 無當前發言者需要停止`);
  }
}

const renderGameInfo = () => (
  <div style={{ 
    position: 'fixed', 
    top: 10, 
    left: 10, 
    backgroundColor: 'rgba(0,0,0,0.5)', // 半透明
    color: 'white', 
    padding: '8px 14px', 
    borderRadius: '8px',
    zIndex: 1000,
    fontSize: '15px', // 字體縮小
    pointerEvents: 'none', // 不會擋住點擊
    maxWidth: '220px'
  }}>
    <div><i className="fas fa-door-open" /> 房間ID: {roomId}</div>
    <div><i className="fas fa-user" /> 暱稱: {username}</div>
    {myRole && (
      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          {getRoleIcon(myRole)}
          <span>你的角色：{myRole}</span>
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8 }}>
          {myRole === "狼人" && "夜晚可以與隊友討論並選擇一名玩家擊殺"}
          {myRole === "預言家" && "夜晚可以查驗一名玩家的身份"}
          {myRole === "女巫" && "夜晚可以使用解藥救人，或使用毒藥毒死一名玩家"}
          {myRole === "獵人" && "死亡時可以帶走一名玩家"}
          {myRole === "村民" && "白天可以參與討論和投票"}
        </div>
      </div>
    )}
  </div>
);