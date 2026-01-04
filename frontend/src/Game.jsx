import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

import kenzo from './assets/kenzo.png';
import jude from './assets/jude.png';
import olive from './assets/olive.png';


function Game() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const [players, setPlayers] = useState({});
  const keysPressed = useRef({});
  const myPlayer = useRef({ x: 400, y: 300, rotation: 0 });
  const [playerDogs, setPlayerDogs] = useState({});
  const dogImages = useRef({});
  const myDogType = useRef(null);

  const [canvasDimensions, setCanvasDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 100
  });

const CANVAS_WIDTH = canvasDimensions.width;
const CANVAS_HEIGHT = canvasDimensions.height;
const SPEED = 5;
const ROTATION_SPEED = 0.05;

  useEffect(() => {
    // Connect to server
    socketRef.current = io('http://localhost:3001');

    // Receive current players
    socketRef.current.on('current-players', (currentPlayers) => {
      setPlayers(currentPlayers);
      const dogs = {};
      Object.keys(currentPlayers).forEach(id => {
        dogs[id] = currentPlayers[id].dogType || 'kenzo';
      });
      setPlayerDogs(dogs);
    });

    // New player joined
    socketRef.current.on('player-joined', (player) => {
      setPlayers(prev => ({ ...prev, [player.id]: player }));
    });

    // Player moved
    socketRef.current.on('player-moved', (player) => {
      setPlayers(prev => ({ ...prev, [player.id]: player }));
    });

    // Player left
    socketRef.current.on('player-left', (playerId) => {
      setPlayers(prev => {
        const newPlayers = { ...prev };
        delete newPlayers[playerId];
        return newPlayers;
      });
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      keysPressed.current[e.key] = true;
    };

    const handleKeyUp = (e) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Load dog images and pick random dog
  useEffect(() => {
    const kenzoImg = new Image();
    kenzoImg.src = kenzo;
    const oliveImg = new Image();
    oliveImg.src = olive;
    const judeImg = new Image();
    judeImg.src = jude;
  
    dogImages.current = { kenzo: kenzoImg, olive: oliveImg, jude: judeImg };
  
    // Pick random dog for yourself
  const dogTypes = ['kenzo', 'olive', 'jude'];
  myDogType.current = dogTypes[Math.floor(Math.random() * dogTypes.length)];
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;

    const gameLoop = () => {
      // Update player position based on keys
      if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) {
        myPlayer.current.x += Math.cos(myPlayer.current.rotation) * SPEED;
        myPlayer.current.y += Math.sin(myPlayer.current.rotation) * SPEED;
      }
      if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) {
        myPlayer.current.rotation -= ROTATION_SPEED;
      }
      if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) {
        myPlayer.current.rotation += ROTATION_SPEED;
      }

      // Keep player in bounds
      myPlayer.current.x = Math.max(20, Math.min(CANVAS_WIDTH - 20, myPlayer.current.x));
      myPlayer.current.y = Math.max(20, Math.min(CANVAS_HEIGHT - 20, myPlayer.current.y));

      // Send position to server
      if (socketRef.current) {
        socketRef.current.emit('player-move', {
          id: socketRef.current.id,
          dogType: myDogType.current,
          ...myPlayer.current
        });
      }

      // Clear canvas
      ctx.fillStyle = '#2a9d8f';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw simple track (oval)
      ctx.strokeStyle = '#e76f51';
      ctx.lineWidth = 150;
      ctx.beginPath();
      ctx.ellipse(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.35, CANVAS_HEIGHT * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Draw all players
      Object.values(players).forEach((player) => {
        const dogType = playerDogs[player.id] || 'kenzo';
        drawDog(ctx, player.x, player.y, player.rotation, dogType);
      });

      // Draw my player 
      if (socketRef.current?.id && players[socketRef.current.id]) {
        drawDog(ctx, myPlayer.current.x, myPlayer.current.y, myPlayer.current.rotation, myDogType.current);
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [players]);

  const drawDog = (ctx, x, y, rotation, dogType = 'kenzo') => {
    const img = dogImages.current[dogType];
    if (!img || !img.complete) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation  + Math.PI / 2); // rotate to face movement direction, 90 degrees. 
    const size = 40;
    ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
  };

    // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 100
      });
    };

    window.addEventListener('resize', handleResize);
    
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 0, margin: 0, overflow: 'hidden' }}>
      <h1>🐕 Pit Crew Pups</h1>
      <p>Use Arrow Keys or WASD to move</p>
      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        style={{ border: '2px solid #264653', borderRadius: '8px' }}
      />
    </div>
  );
}

export default Game;