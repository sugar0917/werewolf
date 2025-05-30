import React, { useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:4000");

function App() {
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);

  const joinRoom = () => {
    if (roomId && username) {
      socket.emit("join_room", { roomId, username });
      setJoined(true);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>狼人殺 - 加入房間</h2>
      {!joined ? (
        <>
          <input
            type="text"
            placeholder="房號"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <br />
          <input
            type="text"
            placeholder="暱稱"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <br />
          <button onClick={joinRoom}>加入房間</button>
        </>
      ) : (
        <p>已加入房間 {roomId}，歡迎 {username}</p>
      )}
    </div>
  );
}

export default App;