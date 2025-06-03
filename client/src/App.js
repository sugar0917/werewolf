// === client/src/App.js ===
import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

// 添加 Font Awesome CDN
const fontAwesomeCDN = document.createElement('link');
fontAwesomeCDN.rel = 'stylesheet';
fontAwesomeCDN.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
document.head.appendChild(fontAwesomeCDN);

// 添加全局樣式
const globalStyles = `
  :root {
    --primary-color: #4a90e2;
    --secondary-color: #f5f5f5;
    --danger-color: #e74c3c;
    --success-color: #2ecc71;
    --warning-color: #f1c40f;
    --text-color: #333;
    --night-bg: #1a1a2e;
    --day-bg: #ffffff;
  }

  .game-container {
    min-height: 100vh;
    padding: 20px;
    transition: all 0.5s ease;
    font-family: 'Microsoft JhengHei', sans-serif;
  }

  .game-container.night {
    background-color: var(--night-bg);
    color: white;
    background-image: linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url('https://images.unsplash.com/photo-1534447677768-be436bb09401?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80');
    background-size: cover;
    background-position: center;
  }

  .game-container.day {
    background-color: var(--day-bg);
    color: var(--text-color);
    background-image: linear-gradient(rgba(255,255,255,0.9), rgba(255,255,255,0.9)), url('https://images.unsplash.com/photo-1501854140801-50d01698950b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80');
    background-size: cover;
    background-position: center;
  }

  .player-card {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 15px;
    margin: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all 0.3s ease;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .player-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }

  .player-card.dead {
    opacity: 0.5;
    background: rgba(0, 0, 0, 0.3);
  }

  .player-card.current-speaker {
    border: 2px solid var(--warning-color);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(241, 196, 15, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(241, 196, 15, 0); }
    100% { box-shadow: 0 0 0 0 rgba(241, 196, 15, 0); }
  }

  .role-icon {
    font-size: 24px;
    margin-right: 10px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
  }

  .action-button {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 25px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 16px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 5px;
  }

  .action-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  }

  .action-button.danger {
    background: var(--danger-color);
  }

  .action-button.success {
    background: var(--success-color);
  }

  .phase-indicator {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 25px;
    background: rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 10px;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .vote-results {
    background: rgba(255,255,255,0.1);
    border-radius: 15px;
    padding: 20px;
    margin-top: 20px;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .voice-controls {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(255,255,255,0.9);
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    backdrop-filter: blur(5px);
  }

  .join-form {
    max-width: 400px;
    margin: 50px auto;
    padding: 30px;
    background: rgba(255,255,255,0.1);
    border-radius: 15px;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .join-form input {
    width: 100%;
    padding: 12px;
    margin: 10px 0;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 25px;
    background: rgba(255,255,255,0.1);
    color: inherit;
    font-size: 16px;
  }

  .join-form input::placeholder {
    color: rgba(255,255,255,0.5);
  }

  .error-message {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--danger-color);
    color: white;
    padding: 12px 24px;
    border-radius: 25px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideDown 0.3s ease;
  }

  @keyframes slideDown {
    from { transform: translate(-50%, -100%); }
    to { transform: translate(-50%, 0); }
  }

  .game-end {
    text-align: center;
    padding: 50px;
    background: rgba(255,255,255,0.1);
    border-radius: 15px;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    margin: 50px auto;
    max-width: 600px;
  }

  .winner-announcement {
    font-size: 32px;
    font-weight: bold;
    margin: 20px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
  }

  .action-panel {
    background: rgba(255,255,255,0.1);
    border-radius: 15px;
    padding: 20px;
    margin: 20px 0;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .action-panel h3 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
  }

  .target-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .player-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 15px;
    margin: 20px 0;
  }

  .player-info {
    flex: 1;
  }

  .player-name {
    font-size: 18px;
    font-weight: bold;
  }

  .player-status {
    font-size: 14px;
    opacity: 0.8;
  }

  .eliminated {
    color: var(--danger-color);
    font-weight: bold;
    font-size: 18px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .form-section {
    margin-bottom: 30px;
  }

  .form-section h3 {
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .room-list {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 20px;
  }

  .room-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    margin-bottom: 10px;
    background: rgba(255,255,255,0.1);
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.2);
  }

  .room-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .room-name {
    font-size: 18px;
    font-weight: bold;
  }

  .room-players {
    font-size: 14px;
    opacity: 0.8;
  }

  .no-rooms {
    text-align: center;
    padding: 20px;
    background: rgba(255,255,255,0.1);
    border-radius: 10px;
    margin: 20px 0;
  }

  .button-group {
    display: flex;
    gap: 10px;
    margin-top: 15px;
  }

  .join-form {
    max-width: 500px;
    margin: 50px auto;
    padding: 30px;
    background: rgba(255,255,255,0.1);
    border-radius: 15px;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .join-form h2 {
    text-align: center;
    margin-bottom: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
`;

// 添加樣式到 document
const styleSheet = document.createElement("style");
styleSheet.textContent = globalStyles;
document.head.appendChild(styleSheet);

const socket = io("https://werewolf-server-lnan.onrender.com");

function App() {
  const [roomId, setRoomId] = useState("");
  const roomIdRef = useRef("");
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [users, setUsers] = useState([]);
  const [playersById, setPlayersById] = useState({});
  const [playerStates, setPlayerStates] = useState({});
  const [myRole, setMyRole] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState("waiting");
  const [mySocketId, setMySocketId] = useState("");

  const [isWerewolf, setIsWerewolf] = useState(false);
  const [isProphet, setIsProphet] = useState(false);
  const [isWitch, setIsWitch] = useState(false);

  const [werewolfTeammates, setWerewolfTeammates] = useState([]);
  const [werewolfTargets, setWerewolfTargets] = useState([]);
  const [werewolfVotes, setWerewolfVotes] = useState({});
  const [hasVoted, setHasVoted] = useState(false);
  const [nightResult, setNightResult] = useState([]);

  const [hasChecked, setHasChecked] = useState(false);
  const [checkedResult, setCheckedResult] = useState(null);

  const [witchAction, setWitchAction] = useState(null);
  const [witchSaveUsed, setWitchSaveUsed] = useState(false);
  const [witchPoisonUsed, setWitchPoisonUsed] = useState(false);

  const [voteResults, setVoteResults] = useState([]);
  const [voteEliminated, setVoteEliminated] = useState(null);
  const [secondVoteCandidates, setSecondVoteCandidates] = useState(null);
  const [excludedVoters, setExcludedVoters] = useState([]);
  const [eligibleVoters, setEligibleVoters] = useState([]);
  const [hasDayVoted, setHasDayVoted] = useState(false);

  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState(null);

  const [errorMessage, setErrorMessage] = useState(null);

  const [hunterTargets, setHunterTargets] = useState([]);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [speakingTime, setSpeakingTime] = useState(60);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [speakingOrder, setSpeakingOrder] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [audioStream, setAudioStream] = useState(null);
  const [peerConnections, setPeerConnections] = useState({});
  const [isWerewolfChat, setIsWerewolfChat] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isConnecting, setIsConnecting] = useState(false);

  const [roomList, setRoomList] = useState([]);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  // WebRTC 配置
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:global.relay.metered.ca:80',
        username: 'openai',
        credential: 'openai'
      }
    ]
  };

  const restartGame = () => {
    setGameEnded(false);
    setWinner(null);
    setGameStarted(false);
    setGamePhase("waiting");
    setMyRole(null);
    setIsWerewolf(false);
    setIsProphet(false);
    setIsWitch(false);
    setWerewolfTeammates([]);
    setWerewolfTargets([]);
    setWerewolfVotes({});
    setHasVoted(false);
    setNightResult([]);
    setHasChecked(false);
    setCheckedResult(null);
    setWitchAction(null);
    setWitchSaveUsed(false);
    setWitchPoisonUsed(false);
    setVoteResults([]);
    setVoteEliminated(null);
    setSecondVoteCandidates(null);
    setExcludedVoters([]);
    setEligibleVoters([]);
    setHasDayVoted(false);
    setHunterTargets([]);
    socket.emit("restart_game", roomId);
  };

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    socket.on("connect", () => setMySocketId(socket.id));
    socket.on("room_users", (userList) => {
      setUsers(userList);
      const map = {};
      userList.forEach(u => map[u.id] = u.username);
      setPlayersById(map);
    });
    socket.on("player_states", (states) => {
      const map = {};
      states.forEach(s => map[s.id] = s.alive);
      setPlayerStates(map);
    });
    socket.on("your_role", (role) => {
      setMyRole(role);
      setIsWerewolf(role === "狼人");
      setIsProphet(role === "預言家");
      setIsWitch(role === "女巫");
    });
    socket.on("game_started", () => {
      console.log("遊戲開始事件觸發");
      setGameStarted(true);
    });
    socket.on("phase_changed", (phase) => {
      console.log("階段變更", phase);
      setGamePhase(phase);
      if (phase === "night") {
        setHasChecked(false);
        setCheckedResult(null);
        setWitchAction(null);
        setVoteResults([]);
        setVoteEliminated(null);
        setSecondVoteCandidates(null);
        setExcludedVoters([]);
        setEligibleVoters([]);
        setHasDayVoted(false);
        setHunterTargets([]);
      }
      setHasVoted(false);
    });
    socket.on("night_werewolf_info", ({ teammates, targets }) => {
      setWerewolfTeammates(teammates);
      setWerewolfTargets(targets);
    });
    socket.on("werewolf_votes", ({ votes }) => {
      setWerewolfVotes(votes);
    });
    socket.on("night_result", () => {}); // 避免舊的事件干擾
    socket.on("night_summary", (summary) => {
      setNightResult(summary);
    });
    socket.on("prophet_result", ({ targetId, isWerewolf }) => {
      const name = playersById[targetId] || "未知玩家";
      setCheckedResult({ name, isWerewolf });
    });
    socket.on("witch_night_action", ({ targetId, targetName, canUseSave, canUsePoison, players }) => {
      setWitchAction({ targetId, targetName, canUseSave, canUsePoison, players });
    });
    socket.on("vote_result", ({ eliminated, voteList, reason }) => {
      setVoteResults(voteList.map(v => ({
        from: playersById[v.from] || v.from,
        to: v.to ? (playersById[v.to] || v.to) : "棄票"
      })));
      if (eliminated) setVoteEliminated(playersById[eliminated] || eliminated);
      if (reason) alert(reason);
    });
    socket.on("second_vote", ({ candidates, excludedVoters, eligibleVoters }) => {
      setSecondVoteCandidates(candidates);
      setExcludedVoters(excludedVoters);
      setEligibleVoters(eligibleVoters);
      setHasDayVoted(false);
    });
    socket.on("game_end", ({ winner }) => {
      setGameEnded(true);
      setWinner(winner);
    });
    socket.on("game_restarted", () => {
      setGameStarted(true);
      setGamePhase("night");
    });
    socket.on("error_message", (message) => {
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 3000);
    });
    socket.on("hunter_trigger", ({ players }) => {
      console.log("獵人技能觸發", { players });
      setHunterTargets(players);
    });
    socket.on("hunter_result", ({ hunterName, targetName }) => {
      console.log("獵人技能結果", { hunterName, targetName });
      setVoteResults(prev => ({
        ...prev,
        eliminated: null,
        reason: targetName ? 
          `${hunterName} 發動了獵人技能，帶走了 ${targetName}` :
          `${hunterName} 選擇不使用獵人技能`
      }));
    });
    socket.on("voice_chat", ({ type, data }) => {
      switch (type) {
        case "start_speaking":
          setCanSpeak(true);
          setSpeakingTime(data.time);
          setCurrentSpeaker(data.speakerId);
          if (localStream && data.speakerId === mySocketId) {
            localStream.getAudioTracks().forEach(track => { track.enabled = true; });
            setIsMuted(false);
          }
          setIsDeafened(false);
          break;
        case "stop_speaking":
          setCanSpeak(false);
          setCurrentSpeaker(null);
          if (localStream) {
            localStream.getAudioTracks().forEach(track => { track.enabled = false; });
            setIsMuted(true);
          }
          if (gamePhase === 'day_voting' || gamePhase === 'night') {
             setIsDeafened(true);
          }
          break;
        case "speaking_order":
          setSpeakingOrder(data.order);
          break;
        case "werewolf_chat":
          setIsWerewolfChat(data.enabled);
          if (myRole === "狼人") {
            if (data.enabled) {
              if (localStream) {
                localStream.getAudioTracks().forEach(track => { track.enabled = true; });
                setIsMuted(false);
              }
              setIsDeafened(false);
            } else {
              if (localStream) {
                localStream.getAudioTracks().forEach(track => { track.enabled = false; });
                setIsMuted(true);
              }
              if (mySocketId !== currentSpeaker && gamePhase === 'day') {
                setIsDeafened(true);
              }
            }
          }
          break;
        case "last_words":
          if (data.playerId === mySocketId) {
            setCanSpeak(true);
            setSpeakingTime(60);
            if (localStream) {
              localStream.getAudioTracks().forEach(track => { track.enabled = true; });
              setIsMuted(false);
            }
            setIsDeafened(false);
          } else {
             setIsDeafened(true);
          }
          break;
      }
    });
    socket.on("rtc_signal", async ({ type, from, data }) => {
      switch (type) {
        case "offer":
          await handleOffer(from, data);
          break;
        case "answer":
          await handleAnswer(from, data);
          break;
        case "ice-candidate":
          await handleIceCandidate(from, data);
          break;
      }
    });
    socket.on("room_list", (rooms) => {
      setRoomList(rooms);
    });
    socket.on("get_room_list", () => {
      socket.emit("get_room_list");
    });
    return () => {
      socket.off("phase_changed");
      socket.off("hunter_trigger");
      socket.off("hunter_result");
      socket.off("voice_chat");
      socket.off("rtc_signal");
      socket.off("room_list");
      socket.off();
    };
  }, [playersById]);

  useEffect(() => {
    let interval = null;
    if (gamePhase === "night" && isWerewolf && !hasVoted && playerStates[mySocketId]) {
      interval = setInterval(() => {
        socket.emit("get_werewolf_votes", roomIdRef.current);
      }, 500);
    }
    return () => clearInterval(interval);
  }, [gamePhase, isWerewolf, hasVoted, playerStates]);

  // 取得本地流
  useEffect(() => {
    if (joined) {
      // 嘗試關閉聲學回音消除 (AEC)
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false } })
        .then(stream => {
          setLocalStream(stream);
          stream.getAudioTracks().forEach(track => { track.enabled = false; });
        })
        .catch(err => {
          console.error("無法獲取麥克風權限:", err);
          alert("請允許使用麥克風以啟用語音功能");
        });
    }
  }, [joined]);

  // 取得本地流後自動發起連線
  useEffect(() => {
    if (joined && localStream) {
      const others = Object.keys(playersById).filter(id => id !== mySocketId);
      others.forEach(peerId => initiateConnection(peerId));
    }
    // eslint-disable-next-line
  }, [joined, localStream, playersById, mySocketId]);

  useEffect(() => {
    if (localStream) {
      Object.values(peerConnections).forEach(pc => {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      });
    }
    // eslint-disable-next-line
  }, [localStream]);

  useEffect(() => {
    let timer;
    if (canSpeak && speakingTime > 0) {
      timer = setInterval(() => {
        setSpeakingTime(prev => prev - 1);
      }, 1000);
    } else if (speakingTime === 0) {
      setCanSpeak(false);
      socket.emit("stop_speaking", { roomId });
    }
    return () => clearInterval(timer);
  }, [canSpeak, speakingTime, roomId]);

  const joinRoom = () => {
    if (roomId && username) {
      console.log("加入房間", { roomId, username });
      // 重置遊戲狀態
      setGameStarted(false);
      setGamePhase("waiting");
      setMyRole(null);
      setIsWerewolf(false);
      setIsProphet(false);
      setIsWitch(false);
      setWerewolfTeammates([]);
      setWerewolfTargets([]);
      setWerewolfVotes({});
      setHasVoted(false);
      setNightResult([]);
      setHasChecked(false);
      setCheckedResult(null);
      setWitchAction(null);
      setWitchSaveUsed(false);
      setWitchPoisonUsed(false);
      setVoteResults([]);
      setVoteEliminated(null);
      setSecondVoteCandidates(null);
      setExcludedVoters([]);
      setEligibleVoters([]);
      setHasDayVoted(false);
      setHunterTargets([]);
      setGameEnded(false);
      setWinner(null);

      socket.emit("join_room", { roomId, username });
      roomIdRef.current = roomId;
      setJoined(true);
    }
  };

  const startGame = () => {
    console.log("嘗試開始遊戲", { 
      roomId, 
      roomIdRef: roomIdRef.current,
      mySocketId, 
      users 
    });
    socket.emit("start_game", roomIdRef.current); // 使用 roomIdRef.current
  };

  const isHost = users.length > 0 && users[0].id === mySocketId;
  console.log("房主狀態", { isHost, mySocketId, users });

  const isAlive = playerStates[mySocketId] !== false;

  const submitDayVote = (targetId) => {
    if (!isAlive) return;
    socket.emit("day_vote", { roomId, targetId });
    setHasDayVoted(true);
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "狼人":
        return <i className="fas fa-wolf-pack-battalion" style={{ color: '#e74c3c' }} />;
      case "預言家":
        return <i className="fas fa-eye" style={{ color: '#3498db' }} />;
      case "女巫":
        return <i className="fas fa-flask" style={{ color: '#9b59b6' }} />;
      case "獵人":
        return <i className="fas fa-crosshairs" style={{ color: '#e67e22' }} />;
      case "村民":
        return <i className="fas fa-user" style={{ color: '#2ecc71' }} />;
      default:
        return <i className="fas fa-question" />;
    }
  };

  const renderPlayerCard = (u) => {
    const isDead = playerStates[u.id] === false;
    const isCurrentSpeaker = currentSpeaker === u.id;
    const isMe = u.id === mySocketId;
    const playerRole = myRole && isMe ? myRole : null;

    return (
      <div 
        key={u.id} 
        className={`player-card ${isDead ? 'dead' : ''} ${isCurrentSpeaker ? 'current-speaker' : ''}`}
      >
        {playerRole && getRoleIcon(playerRole)}
        <div className="player-info">
          <div className="player-name">
            {u.username}
            {isMe && "（你）"}
          </div>
          <div className="player-status">
            {isDead ? (
              <i className="fas fa-skull" />
            ) : (
              <i className="fas fa-heart" style={{ color: 'var(--success-color)' }} />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPhaseIndicator = () => {
    if (!gameStarted) return null;
    
    return (
      <div className="phase-indicator">
        {gamePhase === "night" ? (
          <>
            <i className="fas fa-moon" />
            <span>夜晚階段</span>
          </>
        ) : (
          <>
            <i className="fas fa-sun" />
            <span>白天階段</span>
          </>
        )}
      </div>
    );
  };

  const renderActionButtons = () => {
    if (!gameStarted || !isAlive) return null;

    if (gamePhase === "night") {
      if (isWerewolf && !hasVoted) {
        return (
          <div className="action-panel">
            <h3><i className="fas fa-wolf-pack-battalion" /> 狼人行動</h3>
            {werewolfTeammates.length > 0 && (
              <div className="teammates-info" style={{ marginBottom: '15px' }}>
                <h4><i className="fas fa-users" /> 你的隊友：</h4>
                <ul>
                  {werewolfTeammates.map(teammate => (
                    <li key={teammate.id}>
                      <i className="fas fa-user" /> {teammate.username}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="target-list">
              {werewolfTargets.filter(t => playerStates[t.id] !== false).map(target => (
                <button
                  key={target.id}
                  className="action-button danger"
                  onClick={() => {
                    socket.emit("werewolf_kill", { roomId, targetId: target.id });
                    setHasVoted(true);
                  }}
                >
                  <i className="fas fa-skull" /> 擊殺 {target.username}
                </button>
              ))}
            </div>
          </div>
        );
      }

      if (isWitch && witchAction) {
        return (
          <div className="action-panel">
            <h3><i className="fas fa-flask" /> 女巫行動</h3>
            <p>今晚被殺的是：{witchAction.targetName}</p>
            <div className="witch-actions">
              {witchAction.canUseSave && !witchSaveUsed && (
                <button
                  className="action-button success"
                  onClick={() => {
                    socket.emit("witch_decision", { roomId, save: true });
                    setWitchSaveUsed(true);
                    setWitchAction(null);
                  }}
                >
                  <i className="fas fa-heart" /> 使用解藥
                </button>
              )}
              {witchAction.canUsePoison && !witchPoisonUsed && (
                <div className="poison-options">
                  <p>選擇毒殺一人：</p>
                  {witchAction.players.filter(p => playerStates[p.id] !== false).map(p => (
                    <button
                      key={p.id}
                      className="action-button danger"
                      onClick={() => {
                        socket.emit("witch_decision", { roomId, poisonId: p.id });
                        setWitchPoisonUsed(true);
                        setWitchAction(null);
                      }}
                    >
                      <i className="fas fa-skull" /> 毒殺 {p.username}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="action-button"
                onClick={() => {
                  socket.emit("witch_decision", { roomId, save: false });
                  setWitchAction(null);
                }}
              >
                <i className="fas fa-times" /> 不使用任何道具
              </button>
            </div>
          </div>
        );
      }

      if (isProphet && !hasChecked) {
        return (
          <div className="action-panel">
            <h3><i className="fas fa-eye" /> 預言家查驗</h3>
            <div className="target-list">
              {users.filter(u => playerStates[u.id] !== false).map(target => (
                <button
                  key={target.id}
                  className="action-button"
                  onClick={() => {
                    socket.emit("prophet_check", { roomId, targetId: target.id });
                    setHasChecked(true);
                  }}
                >
                  <i className="fas fa-search" /> 查驗 {target.username}
                </button>
              ))}
            </div>
          </div>
        );
      }

      // 顯示查驗結果
      if (isProphet && hasChecked && checkedResult) {
        return (
          <div className="action-panel">
            <h3><i className="fas fa-eye" /> 查驗結果</h3>
            <p>
              {checkedResult.name} 是
              {checkedResult.isWerewolf ? (
                <span style={{ color: 'var(--danger-color)' }}> 狼人</span>
              ) : (
                <span style={{ color: 'var(--success-color)' }}> 好人</span>
              )}
            </p>
          </div>
        );
      }

      // 顯示等待其他玩家行動的提示
      return (
        <div className="action-panel">
          <h3><i className="fas fa-clock" /> 等待其他玩家行動</h3>
          <p>請等待其他玩家完成他們的夜晚行動...</p>
        </div>
      );
    }

    if (gamePhase === "day" && !hasDayVoted) {
      return (
        <div className="action-panel">
          <h3><i className="fas fa-vote-yea" /> 投票放逐</h3>
          <div className="target-list">
            {users
              .filter(u => playerStates[u.id] !== false && (!secondVoteCandidates || secondVoteCandidates.includes(u.id)))
              .map(target => (
                <button
                  key={target.id}
                  className="action-button"
                  onClick={() => submitDayVote(target.id)}
                >
                  <i className="fas fa-user-slash" /> 投票放逐 {target.username}
                </button>
              ))}
            <button
              className="action-button"
              onClick={() => submitDayVote(null)}
            >
              <i className="fas fa-ban" /> 棄票
            </button>
          </div>
        </div>
      );
    }

    if (gamePhase === "hunter" && hunterTargets.length > 0 && myRole === "獵人") {
      return (
        <div className="action-panel">
          <h3><i className="fas fa-crosshairs" /> 獵人技能</h3>
          <p>你被放逐了，可以選擇帶走一名玩家</p>
          <div className="target-list">
            {hunterTargets.map(target => (
              <button
                key={target.id}
                className="action-button danger"
                onClick={() => handleHunterShoot(target.id)}
              >
                <i className="fas fa-skull" /> 帶走 {target.username}
              </button>
            ))}
            <button
              className="action-button"
              onClick={() => {
                socket.emit("hunter_shoot", { roomId, targetId: null });
                setHunterTargets([]);
              }}
            >
              <i className="fas fa-times" /> 不使用技能
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const themeStyles = gamePhase === "night" ? {
    backgroundColor: "#111",
    color: "white",
    minHeight: "100vh",
    padding: 20
  } : {
    backgroundColor: "#fff",
    color: "black",
    minHeight: "100vh",
    padding: 20
  };

  const handleHunterShoot = (targetId) => {
    console.log("獵人開槍", { targetId });
    socket.emit("hunter_shoot", { roomId, targetId });
    setHunterTargets([]);
  };

  const toggleMicrophone = () => {
    if (localStream) {
      const enabled = !isMuted;
      localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
  };

  const renderVoiceControls = () => (
    <div style={{ 
      position: "fixed", 
      bottom: 20, 
      right: 20, 
      zIndex: 1000,
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      padding: "15px",
      borderRadius: "10px",
      boxShadow: "0 0 10px rgba(0,0,0,0.2)"
    }}>
      <div style={{ marginBottom: "10px" }}>
        <button 
          onClick={toggleMicrophone} 
          style={{ 
            margin: 5,
            padding: "8px 15px",
            backgroundColor: isMuted ? "#ff4444" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer"
          }}
        >
          {isMuted ? "🔇 開啟麥克風" : "🎤 關閉麥克風"}
        </button>
        <button 
          onClick={toggleDeafen} 
          style={{ 
            margin: 5,
            padding: "8px 15px",
            backgroundColor: isDeafened ? "#ff4444" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer"
          }}
        >
          {isDeafened ? "🔈 開啟聲音" : "🔊 關閉聲音"}
        </button>
      </div>

      {gamePhase === "day" && currentSpeaker && (
        <div style={{ 
          marginBottom: "10px",
          padding: "5px",
          backgroundColor: "#ffeeee",
          borderRadius: "5px",
          textAlign: "center",
          color: currentSpeaker === mySocketId ? "red" : "black",
          fontWeight: "bold"
        }}>
          {currentSpeaker === mySocketId ? 
            `你的發言時間：${speakingTime}秒` : 
            `${playersById[currentSpeaker] || currentSpeaker} 正在發言：${speakingTime}秒`}
          
          {currentSpeaker === mySocketId && (
            <button onClick={() => socket.emit("stop_speaking", { roomId })} style={{ marginLeft: 10 }}>提前結束</button>
          )}
        </div>
      )}
      
      {/* 顯示發言順序 */}
      {gamePhase === "day" && speakingOrder && speakingOrder.length > 0 && (
         <div style={{ fontSize: "14px", marginTop: 10, textAlign: "center" }}>
            <p>發言順序:</p>
            <div>
                {speakingOrder.map((playerId, index) => (
                    <span key={playerId} style={{ fontWeight: playerId === currentSpeaker ? "bold" : "normal", color: playerStates[playerId] === false ? "gray" : "unset" }}>
                        {playersById[playerId] || playerId}{index < speakingOrder.length - 1 ? " → " : ""}
                    </span>
                ))}
            </div>
         </div>
      )}
      
      {/* WebRTC 測試面板 */}
      <div style={{ 
        marginTop: "15px",
        padding: "15px",
        border: "2px solid #2196F3",
        borderRadius: "8px",
        backgroundColor: "#f5f5f5"
      }}>
        <h4 style={{ 
          margin: "0 0 10px 0",
          color: "#2196F3",
          borderBottom: "2px solid #2196F3",
          paddingBottom: "5px"
        }}>
          WebRTC 測試面板
        </h4>
        
        <div style={{ marginTop: "10px" }}>
          <div style={{ 
            padding: "8px",
            backgroundColor: localStream ? "#e8f5e9" : "#ffebee",
            borderRadius: "5px",
            marginBottom: "5px"
          }}>
            <strong>本地流狀態：</strong>
            {localStream ? "✅ 已獲取" : "❌ 未獲取"}
          </div>

          <div style={{ 
            padding: "8px",
            backgroundColor: "#e3f2fd",
            borderRadius: "5px",
            marginBottom: "5px"
          }}>
            <strong>連接狀態：</strong>
            {Object.entries(peerConnections).map(([peerId, pc]) => (
              <div key={peerId} style={{ marginTop: "5px" }}>
                {playersById[peerId] || peerId}: 
                <span style={{ 
                  color: pc.connectionState === "connected" ? "#4CAF50" : 
                         pc.connectionState === "connecting" ? "#FFA000" : "#f44336"
                }}>
                  {pc.connectionState}
                </span>
              </div>
            ))}
          </div>

          <div style={{ 
            padding: "8px",
            backgroundColor: "#e3f2fd",
            borderRadius: "5px"
          }}>
            <strong>遠程流：</strong>
            {Object.keys(remoteStreams).length > 0 ? (
              Object.entries(remoteStreams).map(([peerId, stream]) => (
                <div key={peerId} style={{ marginTop: "5px" }}>
                  {playersById[peerId] || peerId}: 
                  <span style={{ 
                    color: stream.active ? "#4CAF50" : "#f44336"
                  }}>
                    {stream.active ? "✅ 活躍" : "❌ 未活躍"}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ color: "#666" }}>無遠程流</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderCurrentSpeaker = () => {
    if (!currentSpeaker) return null;
    const speakerName = playersById[currentSpeaker] || "未知";
    const myTurn = currentSpeaker === mySocketId;

    return (
      <div style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "10px 20px",
        borderRadius: "5px",
        zIndex: 1000
      }}>
        <div>當前發言者：{speakerName}{myTurn && "（你）"}</div>
        {/* 发言顺序已移到主 render 中单独显示 */}
      </div>
    );
  };

  // 處理 WebRTC 信令
  useEffect(() => {
    socket.on("rtc_signal", async ({ type, from, data }) => {
      switch (type) {
        case "offer":
          await handleOffer(from, data);
          break;
        case "answer":
          await handleAnswer(from, data);
          break;
        case "ice-candidate":
          await handleIceCandidate(from, data);
          break;
      }
    });

    return () => {
      socket.off("rtc_signal");
    };
  }, [localStream]);

  // 創建對等連接
  const createPeerConnection = (peerId) => {
    if (peerConnections[peerId]) return peerConnections[peerId];

    const pc = new RTCPeerConnection(rtcConfiguration);
    
    // 添加本地流
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // 處理遠程流
    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [peerId]: event.streams[0]
      }));
    };

    // 處理 ICE 候選
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("rtc_signal", {
          type: "ice-candidate",
          to: peerId,
          data: event.candidate
        });
      }
    };

    // 處理連接狀態
    pc.onconnectionstatechange = () => {
      console.log(`與 ${peerId} 的連接狀態:`, pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE狀態:`, pc.iceConnectionState);
    };

    setPeerConnections(prev => ({
      ...prev,
      [peerId]: pc
    }));

    return pc;
  };

  // 處理收到的 offer
  const handleOffer = async (from, offer) => {
    const pc = createPeerConnection(from);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit("rtc_signal", {
        type: "answer",
        to: from,
        data: answer
      });
    } catch (err) {
      console.error("處理 offer 時出錯:", err);
    }
  };

  // 處理收到的 answer
  const handleAnswer = async (from, answer) => {
    const pc = peerConnections[from];
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error("處理 answer 時出錯:", err);
      }
    }
  };

  // 處理收到的 ICE 候選
  const handleIceCandidate = async (from, candidate) => {
    const pc = peerConnections[from];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("處理 ICE 候選時出錯:", err);
      }
    }
  };

  // 發起連接
  const initiateConnection = async (peerId) => {
    if (isConnecting) return;
    setIsConnecting(true);

    try {
      const pc = createPeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("rtc_signal", {
        type: "offer",
        to: peerId,
        data: offer
      });
    } catch (err) {
      console.error("發起連接時出錯:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  // 清理連接
  const cleanupConnection = (peerId) => {
    const pc = peerConnections[peerId];
    if (pc) {
      pc.close();
      setPeerConnections(prev => {
        const newConnections = { ...prev };
        delete newConnections[peerId];
        return newConnections;
      });
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[peerId];
        return newStreams;
      });
    }
  };

  // 在組件卸載時清理所有連接
  useEffect(() => {
    return () => {
      Object.keys(peerConnections).forEach(cleanupConnection);
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const createRoom = () => {
    if (newRoomName && username) {
      console.log("創建房間", { roomName: newRoomName, username });
      // 重置遊戲狀態
      setGameStarted(false);
      setGamePhase("waiting");
      setMyRole(null);
      setIsWerewolf(false);
      setIsProphet(false);
      setIsWitch(false);
      setWerewolfTeammates([]);
      setWerewolfTargets([]);
      setWerewolfVotes({});
      setHasVoted(false);
      setNightResult([]);
      setHasChecked(false);
      setCheckedResult(null);
      setWitchAction(null);
      setWitchSaveUsed(false);
      setWitchPoisonUsed(false);
      setVoteResults([]);
      setVoteEliminated(null);
      setSecondVoteCandidates(null);
      setExcludedVoters([]);
      setEligibleVoters([]);
      setHasDayVoted(false);
      setHunterTargets([]);
      setGameEnded(false);
      setWinner(null);

      socket.emit("create_room", { roomName: newRoomName, username });
      setRoomId(newRoomName);
      roomIdRef.current = newRoomName;
      setJoined(true);
    }
  };

  const renderJoinForm = () => (
    <div className="join-form">
      <h2><i className="fas fa-door-open" /> 加入遊戲</h2>
      
      <div className="form-section">
        <h3><i className="fas fa-user" /> 設定暱稱</h3>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="輸入暱稱"
        />
      </div>

      {!isCreatingRoom ? (
        <div className="form-section">
          <h3><i className="fas fa-list" /> 選擇房間</h3>
          {roomList.length > 0 ? (
            <div className="room-list">
              {roomList.map(room => (
                <div key={room.id} className="room-item">
                  <div className="room-info">
                    <span className="room-name">{room.name}</span>
                    <span className="room-players">
                      <i className="fas fa-users" /> {room.players.length}/{room.maxPlayers}
                    </span>
                    <span className="room-id" style={{ fontSize: '12px', color: '#666' }}>
                      <i className="fas fa-key" /> 房間ID: {room.id}
                    </span>
                  </div>
                  <button
                    className="action-button"
                    onClick={() => {
                      console.log("選擇加入房間", { roomId: room.id });
                      setRoomId(room.id);
                      joinRoom();
                    }}
                    disabled={!username || room.players.length >= room.maxPlayers}
                  >
                    <i className="fas fa-sign-in-alt" /> 加入
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-rooms">目前沒有可用的房間</p>
          )}
          
          <button
            className="action-button"
            onClick={() => setIsCreatingRoom(true)}
            style={{ marginTop: '20px' }}
          >
            <i className="fas fa-plus" /> 創建新房間
          </button>
        </div>
      ) : (
        <div className="form-section">
          <h3><i className="fas fa-plus-circle" /> 創建房間</h3>
          <input
            value={newRoomName}
            onChange={e => setNewRoomName(e.target.value)}
            placeholder="輸入房間名稱"
          />
          <div className="button-group">
            <button
              className="action-button"
              onClick={createRoom}
              disabled={!newRoomName || !username}
            >
              <i className="fas fa-check" /> 創建
            </button>
            <button
              className="action-button"
              onClick={() => setIsCreatingRoom(false)}
              style={{ backgroundColor: 'var(--danger-color)' }}
            >
              <i className="fas fa-times" /> 取消
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // 在遊戲界面中顯示當前房間ID
  const renderGameInfo = () => (
    <div style={{ 
      position: 'fixed', 
      top: 20, 
      left: 20, 
      backgroundColor: 'rgba(0,0,0,0.7)', 
      color: 'white', 
      padding: '10px 20px', 
      borderRadius: '5px',
      zIndex: 1000
    }}>
      <div><i className="fas fa-door-open" /> 房間ID: {roomId}</div>
      <div><i className="fas fa-user" /> 暱稱: {username}</div>
      {myRole && (
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
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

  return (
    <div className={`game-container ${gamePhase === "night" ? "night" : "day"}`}>
      <h2><i className="fas fa-gamepad" /> 狼人殺遊戲</h2>
      
      {errorMessage && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle" /> {errorMessage}
        </div>
      )}

      {renderPhaseIndicator()}
      {joined && renderGameInfo()} {/* 添加遊戲信息顯示 */}

      {gameEnded ? (
        <div className="game-end">
          <h3><i className="fas fa-trophy" /> 遊戲結束！</h3>
          <p className="winner-announcement">
            {winner === "狼人" ? (
              <><i className="fas fa-wolf-pack-battalion" /> 狼人陣營獲勝！</>
            ) : (
              <><i className="fas fa-users" /> 好人陣營獲勝！</>
            )}
          </p>
          <button className="action-button" onClick={restartGame}>
            <i className="fas fa-redo" /> 重新開始
          </button>
        </div>
      ) : (
        <>
          {!joined ? (
            renderJoinForm()
          ) : (
            <>
              <div className="player-list">
                {users.map(renderPlayerCard)}
              </div>

              {!gameStarted && isHost && (
                <button className="action-button" onClick={startGame}>
                  <i className="fas fa-play" /> 開始遊戲
                </button>
              )}

              {renderActionButtons()}

              {voteResults.length > 0 && (
                <div className="vote-results">
                  <h4><i className="fas fa-chart-bar" /> 投票結果</h4>
                  <ul>
                    {voteResults.map((v, i) => (
                      <li key={i}>
                        <i className="fas fa-arrow-right" /> {v.from} → {v.to}
                      </li>
                    ))}
                  </ul>
                  {voteEliminated && (
                    <div>
                      <p className="eliminated">
                        <i className="fas fa-skull" /> 被放逐的是：{voteEliminated}
                      </p>
                      {myRole === "獵人" && voteEliminated === playersById[mySocketId] && (
                        <p style={{ color: 'var(--warning-color)', marginTop: '10px' }}>
                          <i className="fas fa-exclamation-triangle" /> 你被放逐了，可以發動獵人技能帶走一名玩家
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {gamePhase === "hunter" && hunterTargets.length > 0 && myRole === "獵人" && (
                <div className="action-panel" style={{ marginTop: '20px' }}>
                  <h3><i className="fas fa-crosshairs" /> 獵人技能</h3>
                  <p>你被放逐了，可以選擇帶走一名玩家</p>
                  <div className="target-list">
                    {hunterTargets.map(target => (
                      <button
                        key={target.id}
                        className="action-button danger"
                        onClick={() => handleHunterShoot(target.id)}
                      >
                        <i className="fas fa-skull" /> 帶走 {target.username}
                      </button>
                    ))}
                    <button
                      className="action-button"
                      onClick={() => {
                        socket.emit("hunter_shoot", { roomId, targetId: null });
                        setHunterTargets([]);
                      }}
                    >
                      <i className="fas fa-times" /> 不使用技能
                    </button>
                  </div>
                </div>
              )}

              {nightResult.length > 0 && (
                <div className="night-results">
                  <h4><i className="fas fa-moon" /> 夜晚結果</h4>
                  <ul>
                    {nightResult.map((r, i) => (
                      <li key={i}>
                        {r === "平安夜" ? (
                          <><i className="fas fa-shield-alt" /> 平安夜</>
                        ) : (
                          <><i className="fas fa-skull" /> 死亡玩家：{r}</>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {joined && renderVoiceControls()}
              {joined && renderCurrentSpeaker()}

              {Object.entries(remoteStreams).map(([peerId, stream]) => (
                <AudioPlayer key={peerId} stream={stream} isDeafened={isDeafened} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function AudioPlayer({ stream, isDeafened }) {
  const audioRef = React.useRef();
  React.useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);
  return <audio ref={audioRef} autoPlay controls={false} muted={isDeafened} style={{ display: 'none' }} />;
}

export default App;
