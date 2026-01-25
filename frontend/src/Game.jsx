import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import kenzo from './assets/kenzo.png';
import jude from './assets/jude.png';
import olive from './assets/olive.png';
import flag from './assets/flag.png';


function Game() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const [players, setPlayers] = useState({});
  const [playerDogs, setPlayerDogs] = useState({});
  const keysPressed = useRef({});
  const myPlayer = useRef({ 
    x: 400, 
    y: 300, 
    rotation: 0,
    lap: 0,
    lastCheckpoint: 0,
    speed: 0
  });
  const dogImages = useRef({});
  const myDogType = useRef(null);
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 150
  });
  const [myLap, setMyLap] = useState(0);
  const [myPosition, setMyPosition] = useState(1);
  const [raceTime, setRaceTime] = useState(0);
  const [raceFinished, setRaceFinished] = useState(false);

  const CANVAS_WIDTH = canvasDimensions.width;
  const CANVAS_HEIGHT = canvasDimensions.height;
  const SPEED = 5;
  const MAX_SPEED = 8;
  const ACCELERATION = 0.5;
  const FRICTION = 0.95;
  const ROTATION_SPEED = 0.08;
  const TOTAL_LAPS = 3;

  const getCheckpoints = () => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const radiusX = CANVAS_WIDTH * 0.35;
    const radiusY = CANVAS_HEIGHT * 0.35;
    const trackOffset = 70; // Middle of track width
    
    return [
      { 
        // Top checkpoint
        x: centerX, 
        y: centerY - radiusY * 0.9, 
        radius: 60
      },
      { 
        // Right checkpoint
        x: centerX + radiusX * 0.9, 
        y: centerY, 
        radius: 60
      },
      { 
        // Bottom checkpoint
        x: centerX, 
        y: centerY + radiusY * 0.9, 
        radius: 60
      },
      { 
        // Left checkpoint (finish line)
        x: centerX - radiusX * 0.9, 
        y: centerY, 
        radius: 60
      }
    ];
  };


  useEffect(() => {
    socketRef.current = io('http://localhost:3001');

    socketRef.current.on('current-players', (currentPlayers) => {
      setPlayers(currentPlayers);
      const dogs = {};
      Object.keys(currentPlayers).forEach(id => {
        dogs[id] = currentPlayers[id].dogType || 'kenzo';
      });
      setPlayerDogs(dogs);
    });

    socketRef.current.on('player-joined', (player) => {
      setPlayers(prev => ({ ...prev, [player.id]: player }));
    });

    socketRef.current.on('player-moved', (player) => {
      setPlayers(prev => ({ ...prev, [player.id]: player }));
    });

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

  // Load dog images
  useEffect(() => {
    const kenzoImg = new Image();
    kenzoImg.src = kenzo;
    const oliveImg = new Image();
    oliveImg.src = olive;
    const judeImg = new Image();
    judeImg.src = jude;
    const flagImg = new Image();
    flagImg.src = flag;

    dogImages.current = { kenzo: kenzoImg, olive: oliveImg, jude: judeImg, flag: flagImg };

    // Pick random dog
    const dogTypes = ['kenzo', 'olive', 'jude'];
    myDogType.current = dogTypes[Math.floor(Math.random() * dogTypes.length)];
  }, []);

  // Initial player position
  useEffect(() => {
    // Place player on the track at the start/finish line position
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const radiusX = CANVAS_WIDTH * 0.35;
    
    // Start line is on the left side of the track (angle = Math.PI)
    const startAngle = Math.PI; // Left side
    
    // Position on the track (middle of the track width)
    const trackRadius = radiusX - 70; // 70px from outer edge (track width is 140px)
    
    myPlayer.current.x = centerX + Math.cos(startAngle) * trackRadius;
    myPlayer.current.y = centerY + Math.sin(startAngle) * trackRadius;
    myPlayer.current.rotation = startAngle; // Face left to go around track
    myPlayer.current.lastCheckpoint = 3;
  }, [CANVAS_WIDTH, CANVAS_HEIGHT]);

  // Race timer
  useEffect(() => {
    if (myLap > 0 && !raceFinished) {
      const timer = setInterval(() => {
        setRaceTime(prev => prev + 0.1);
      }, 100);
      return () => clearInterval(timer);
    }
  }, [myLap, raceFinished]);
  

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;

    const gameLoop = () => {
      if (!raceFinished) {
        // Movement with acceleration
        if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) {
          myPlayer.current.speed = Math.min(myPlayer.current.speed + ACCELERATION, MAX_SPEED);
        } else {
          myPlayer.current.speed *= FRICTION;
        }

        if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) {
          myPlayer.current.rotation -= ROTATION_SPEED;
        }
        if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) {
          myPlayer.current.rotation += ROTATION_SPEED;
        }

        // Update position based on speed and rotation
        myPlayer.current.x += Math.cos(myPlayer.current.rotation) * myPlayer.current.speed;
        myPlayer.current.y += Math.sin(myPlayer.current.rotation) * myPlayer.current.speed;

        
        // Check checkpoints
        checkCheckpoints();

        // Check off-track
        checkOffTrack();

        // Send position to server (limit to ~30 updates per second)
        if (socketRef.current) {
          const now = Date.now();
          if (!myPlayer.current.lastUpdate || now - myPlayer.current.lastUpdate > 33) {
            myPlayer.current.lastUpdate = now;
            socketRef.current.emit('player-move', {
              id: socketRef.current.id,
              dogType: myDogType.current,
              lap: myPlayer.current.lap,
              ...myPlayer.current
            });
          }
        }
      }

      // Clear canvas
      ctx.fillStyle = '#1a5f4a'; // Dark green grass
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw track
      drawTrack(ctx);

      const checkpoints = getCheckpoints();
      const flagImg = dogImages.current.flag;
      if (flagImg && flagImg.complete) {
        checkpoints.forEach((cp, i) => {
          const flagSize = 40;
          ctx.drawImage(flagImg, cp.x - flagSize/2, cp.y - flagSize/2, flagSize, flagSize);
        });
      }


      // Draw all players
      Object.values(players).forEach((player) => {
        const dogType = playerDogs[player.id] || 'olive';
        drawDog(ctx, player.x, player.y, player.rotation, dogType, false);
      });

      // Draw my player
      if (socketRef.current?.id) {
        drawDog(ctx, myPlayer.current.x, myPlayer.current.y, myPlayer.current.rotation, myDogType.current, true);
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [players, playerDogs, CANVAS_WIDTH, CANVAS_HEIGHT, raceFinished]);

  const checkCheckpoints = () => {
    const checkpoints = getCheckpoints();
    const nextCheckpoint = (myPlayer.current.lastCheckpoint + 1) % checkpoints.length;
    const cp = checkpoints[nextCheckpoint];
    
    const dist = Math.sqrt(
      Math.pow(myPlayer.current.x - cp.x, 2) + 
      Math.pow(myPlayer.current.y - cp.y, 2)
    );

    // Only register checkpoint if you hit THE NEXT ONE in sequence
    if (dist < cp.radius) {
      myPlayer.current.lastCheckpoint = nextCheckpoint;
      
      // Completed a lap when you hit checkpoint 3 (the finish line) after going through all others
      if (nextCheckpoint === 3) {
        myPlayer.current.lap++;
        setMyLap(myPlayer.current.lap);
        
        if (myPlayer.current.lap >= TOTAL_LAPS) {
          setRaceFinished(true);
        }
      }
    }
  };

  const checkOffTrack = () => {
    const checkpoints = getCheckpoints();
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const radiusX = CANVAS_WIDTH * 0.35;
    const radiusY = CANVAS_HEIGHT * 0.35;
    
    const dx = (myPlayer.current.x - centerX) / radiusX;
    const dy = (myPlayer.current.y - centerY) / radiusY;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    
    // EXACT boundaries - crash only when hitting red
    // Gray track outer edge (safe)
    const grayOuterBound = 1.0 + (70 / radiusX);  // ≈ 1.20
    // Gray track inner edge (safe)  
    const grayInnerBound = 1.0 - (70 / radiusX);  // ≈ 0.80
    
    // Crash if OUTSIDE gray track (hitting red borders)
    if (distFromCenter < grayInnerBound || distFromCenter > grayOuterBound) {
      const cp = checkpoints[myPlayer.current.lastCheckpoint];
      if (!cp) return;
      
      myPlayer.current.x = cp.x;
      myPlayer.current.y = cp.y;
      myPlayer.current.speed = 0;
      
      const angleToCenter = Math.atan2(cp.y - centerY, cp.x - centerX);
      myPlayer.current.rotation = angleToCenter + Math.PI / 2;
    }
  };

  const drawTrack = (ctx) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const radiusX = CANVAS_WIDTH * 0.35;
    const radiusY = CANVAS_HEIGHT * 0.35;

    // Outer track border (red/white curb)
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 160;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Main track (gray asphalt)
    ctx.strokeStyle = '#424242';
    ctx.lineWidth = 140;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Center line dashes
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Start/Finish line (checkered pattern) - FIXED POSITION
    const finishAngle = Math.PI; // Left side (180 degrees)
    const finishRadius = radiusX - 70; // Middle of the track
    const finishX = centerX + Math.cos(finishAngle) * finishRadius;
    const finishY = centerY + Math.sin(finishAngle) * finishRadius;
    
    // Rotate the finish line to be perpendicular to the track
    ctx.save();
    ctx.translate(finishX, finishY);
    ctx.rotate(finishAngle - Math.PI/2); // Rotate to be perpendicular to track
    
    const finishWidth = 30;
    const finishHeight = 140;
    
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : '#000000';
        ctx.fillRect(
          -finishWidth/2 + j * finishWidth/2,
          -finishHeight/2 + i * finishHeight/10,
          finishWidth/2,
          finishHeight/10
        );
      }
    }
  
    ctx.restore();
    
    // "START" text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('START', finishX, finishY - finishHeight/2 - 10);
  };

  
   const drawDog = (ctx, x, y, rotation, dogType, isMe) => {
    const img = dogImages.current[dogType];
    if (!img || !img.complete) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation + Math.PI / 2);


    // Draw actual dog image
    const size = 50;
    ctx.drawImage(img, -size/2, -size/2, size, size);


    ctx.restore();

      // Name tag above dog
      if (isMe) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('YOU', x, y - 35);
      }
    };

    const handleResize = () => {
      setCanvasDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 150
      });
    };

    useEffect(() => {
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }, []);
      


  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      margin: 0, 
      padding: 0, 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: '#1a5f4a',
      position: 'fixed',
      top: 0,
      left: 0
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        width: '100%',
        padding: '15px 30px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        color: 'white'
      }}>
        <h1 style={{ margin: 0, fontSize: '32px' }}>🐕 Pit Crew Pups 🏎️</h1>
        
        <div style={{ display: 'flex', gap: '30px', fontSize: '20px', fontWeight: 'bold' }}>
          <div style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.2)', 
            padding: '10px 20px', 
            borderRadius: '10px' 
          }}>
            Lap: {myLap}/{TOTAL_LAPS}
          </div>
          <div style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.2)', 
            padding: '10px 20px', 
            borderRadius: '10px' 
          }}>
            Position: {myPosition}/{Object.keys(players).length || 1}
          </div>
          <div style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.2)', 
            padding: '10px 20px', 
            borderRadius: '10px' 
          }}>
            Time: {raceTime.toFixed(1)}s
          </div>
          <div style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.2)', 
            padding: '10px 20px', 
            borderRadius: '10px' 
          }}>
            Speed: {Math.floor(myPlayer.current.speed * 10)}
          </div>
        </div>
      </div>

      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        style={{ display: 'block' }}
      />

      {/* Winner modal */}
      {raceFinished && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '50px',
            borderRadius: '20px',
            textAlign: 'center'
          }}>
            <h2 style={{ fontSize: '48px', margin: '0 0 20px 0' }}>🏆 Race Complete! 🏆</h2>
            <p style={{ fontSize: '32px' }}>Time: {raceTime.toFixed(2)}s</p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                padding: '15px 40px',
                fontSize: '24px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                marginTop: '20px'
              }}
            >
              Race Again! 🏁
            </button>
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '10px',
        fontSize: '16px'
      }}>
        🎮 Arrow Keys or WASD to move
      </div>
    </div>
  );
}

export default Game;