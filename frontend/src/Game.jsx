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
  
  const [playerNames, setPlayerNames] = useState({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
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
  const myName = useRef('');
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 150
  });
  const [myLap, setMyLap] = useState(0);
  const [myPosition, setMyPosition] = useState(1);
  const [raceTime, setRaceTime] = useState(0);
  const [raceFinished, setRaceFinished] = useState(false);
  
  // Landing page states
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedDog, setSelectedDog] = useState(null);
  const [playerName, setPlayerName] = useState('');

  const CANVAS_WIDTH = canvasDimensions.width;
  const CANVAS_HEIGHT = canvasDimensions.height;
  const SPEED = 5;
  const MAX_SPEED = 30;
  const ACCELERATION = 0.5;
  const FRICTION = 0.95;
  const ROTATION_SPEED = 0.08;
  const TOTAL_LAPS = 3;

  const getCheckpoints = () => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const radiusX = CANVAS_WIDTH * 0.35;
    const radiusY = CANVAS_HEIGHT * 0.35;
    
    return [
      { 
        x: centerX, 
        y: centerY - radiusY, 
        radius: 80
      },
      { 
        x: centerX + radiusX, 
        y: centerY, 
        radius: 80
      },
      { 
        x: centerX, 
        y: centerY + radiusY, 
        radius: 80
      },
      { 
        x: centerX - radiusX, 
        y: centerY, 
        radius: 80
      }
    ];
  };

  useEffect(() => {
    if (!gameStarted) return;

    socketRef.current = io('http://localhost:3001');

    socketRef.current.on('current-players', (currentPlayers) => {
      setPlayers(currentPlayers);

      const names = {};
      Object.keys(currentPlayers).forEach(id => {
        names[id] = currentPlayers[id].name;
      });
      setPlayerNames(names);
    });


    socketRef.current.on('player-joined', (player) => {
      setPlayers(prev => ({ ...prev, [player.id]: player }));
      setPlayerNames(prev => ({ ...prev, [player.id]: player.name }));
    });


    socketRef.current.on('player-moved', (player) => {
      setPlayers(prev => ({ ...prev, [player.id]: player }));
      if (player.name) {
        setPlayerNames(prev => ({ ...prev, [player.id]: player.name }));
      }
    });


    

    return () => {
      socketRef.current.disconnect();
    };
  }, [gameStarted]);

  useEffect(() => {
    if (!gameStarted) return;

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
  }, [gameStarted]);

  // Load dog images immediately
  useEffect(() => {
    let loadedCount = 0;
    const totalImages = 4;

    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        setImagesLoaded(true);
      }
    };

    const kenzoImg = new Image();
    kenzoImg.onload = checkAllLoaded;
    kenzoImg.src = kenzo;
    
    const oliveImg = new Image();
    oliveImg.onload = checkAllLoaded;
    oliveImg.src = olive;
    
    const judeImg = new Image();
    judeImg.onload = checkAllLoaded;
    judeImg.src = jude;
    
    const flagImg = new Image();
    flagImg.onload = checkAllLoaded;
    flagImg.src = flag;

    dogImages.current = { kenzo: kenzoImg, olive: oliveImg, jude: judeImg, flag: flagImg };
  }, []);

  // Initial player position
  useEffect(() => {
    if (!gameStarted) return;

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const radiusX = CANVAS_WIDTH * 0.35;
    
    const startAngle = Math.PI;
    const trackRadius = radiusX - 70;
    
    myPlayer.current.x = centerX + Math.cos(startAngle) * trackRadius;
    myPlayer.current.y = centerY + Math.sin(startAngle) * trackRadius;
    myPlayer.current.rotation = startAngle;
    myPlayer.current.lastCheckpoint = 3;
  }, [CANVAS_WIDTH, CANVAS_HEIGHT, gameStarted]);

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
    if (!gameStarted) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;

    const gameLoop = () => {
      if (!raceFinished) {
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

        myPlayer.current.x += Math.cos(myPlayer.current.rotation) * myPlayer.current.speed;
        myPlayer.current.y += Math.sin(myPlayer.current.rotation) * myPlayer.current.speed;

        checkCheckpoints();
        checkOffTrack();

        if (socketRef.current) {
          const now = Date.now();
          if (!myPlayer.current.lastUpdate || now - myPlayer.current.lastUpdate > 33) {
            myPlayer.current.lastUpdate = now;
            socketRef.current.emit('player-move', {
              id: socketRef.current.id,
              dogType: myDogType.current,
              name: myName.current,
              lap: myPlayer.current.lap,
              ...myPlayer.current
            });
          }
        }
      }

      ctx.fillStyle = '#1a5f4a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawTrack(ctx);

      const checkpoints = getCheckpoints();
      const flagImg = dogImages.current.flag;
      if (flagImg && flagImg.complete) {
        checkpoints.forEach((cp, i) => {
          const flagSize = 40;
          ctx.drawImage(flagImg, cp.x - flagSize/2, cp.y - flagSize/2, flagSize, flagSize);
        });
      }

      Object.values(players).forEach((player) => {
        if (player.id === socketRef.current?.id) return;
        const dogType = player.dogType || 'olive';
        const name = player.name || playerNames[player.id] || 'Player';
        drawDog(ctx, player.x, player.y, player.rotation, dogType, name, false);
      });

      if (socketRef.current?.id) {
        drawDog(ctx, myPlayer.current.x, myPlayer.current.y, myPlayer.current.rotation, myDogType.current, myName.current, true);
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [players, playerNames, CANVAS_WIDTH, CANVAS_HEIGHT, raceFinished, gameStarted]);

  const checkCheckpoints = () => {
    const checkpoints = getCheckpoints();
    const nextCheckpoint = (myPlayer.current.lastCheckpoint + 1) % checkpoints.length;
    const cp = checkpoints[nextCheckpoint];
    
    const dist = Math.sqrt(
      Math.pow(myPlayer.current.x - cp.x, 2) + 
      Math.pow(myPlayer.current.y - cp.y, 2)
    );

    if (dist < cp.radius) {
      myPlayer.current.lastCheckpoint = nextCheckpoint;
      
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
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const radiusX = CANVAS_WIDTH * 0.35;
    const radiusY = CANVAS_HEIGHT * 0.35;
    
    const dx = (myPlayer.current.x - centerX) / radiusX;
    const dy = (myPlayer.current.y - centerY) / radiusY;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    
    const grayOuterBound = 1.0 + (70 / radiusX);
    const grayInnerBound = 1.0 - (70 / radiusX);
    
    if (distFromCenter < grayInnerBound || distFromCenter > grayOuterBound) {
      const checkpoints = getCheckpoints();
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

    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 160;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#424242';
    ctx.lineWidth = 140;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const finishAngle = Math.PI;
    const finishRadius = radiusX;
    const finishX = centerX + Math.cos(finishAngle) * finishRadius;
    const finishY = centerY + Math.sin(finishAngle) * finishRadius;
    
    ctx.save();
    ctx.translate(finishX, finishY);
    ctx.rotate(finishAngle - Math.PI/2);
    
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
  };

  
  const drawDog = (ctx, x, y, rotation, dogType, name, isMe) => {
    const img = dogImages.current[dogType];
    if (!img || !img.complete) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation + Math.PI / 2);

    const size = 50;
    ctx.drawImage(img, -size/2, -size/2, size, size);

    ctx.restore();

    ctx.fillStyle = isMe ? '#FFD700' : '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(name || 'Player', x, y - 35);
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

  const handleStartGame = () => {
    if (!selectedDog || !playerName.trim()) {
      alert('Please enter your name and select a dog!');
      return;
    }
    myDogType.current = selectedDog;
    myName.current = playerName.trim();
    setGameStarted(true);
  };

  // Landing Page
  if (!gameStarted) {
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
        justifyContent: 'center',
        backgroundColor: '#1a5f4a',
        position: 'fixed',
        top: 0,
        left: 0,
        fontFamily: '"Space Mono", monospace'
      }}>
        <h1 style={{ 
          margin: '0 0 48px 0', 
          fontSize: '50px',
          fontWeight: '700',
          letterSpacing: '4px',
          color: 'white'
        }}>
          pit crew pups
        </h1>

        {/* Name Input */}
        <div style={{ marginBottom: '48px' }}>
          <label style={{ 
            display: 'block',
            color: 'white',
            fontSize: '18px',
            marginBottom: '12px',
            letterSpacing: '1px'
          }}>
            ENTER YOUR NAME
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={15}
            placeholder="username"
            style={{
              padding: '16px 24px',
              fontSize: '18px',
              backgroundColor: 'white',
              color: '#1a5f4a',
              border: '2px solid white',
              fontFamily: '"Space Mono", monospace',
              fontWeight: '700',
              letterSpacing: '2px',
              textAlign: 'center',
              width: '300px'
            }}
          />
        </div>

        {/* Dog Selection */}
        <div style={{ marginBottom: '48px' }}>
          <label style={{ 
            display: 'block',
            color: 'white',
            fontSize: '18px',
            marginBottom: '24px',
            letterSpacing: '1px',
            textAlign: 'center'
          }}>
            CHOOSE YOUR PUP
          </label>
          <div style={{ 
            display: 'flex', 
            gap: '32px',
            justifyContent: 'center'
          }}>
            {['kenzo', 'jude', 'olive'].map(dog => (
              <div
                key={dog}
                onClick={() => setSelectedDog(dog)}
                style={{
                  cursor: 'pointer',
                  padding: '16px',
                  border: selectedDog === dog ? '4px solid #FFD700' : '4px solid transparent',
                  backgroundColor: selectedDog === dog ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                {imagesLoaded && (
                  <img 
                    src={dogImages.current[dog]?.src || ''} 
                    style={{ 
                      width: '100px', 
                      height: '100px',
                      objectFit: 'contain'
                    }}
                  />
                )}
                <span style={{  
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '700',
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}>
                  {dog}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <button 
          onClick={handleStartGame}
          style={{
            padding: '20px 60px',
            fontSize: '24px',
            backgroundColor: 'white',
            color: '#1a5f4a',
            border: '2px solid white',
            cursor: 'pointer',
            fontWeight: '700',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            fontFamily: '"Space Mono", monospace',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.color = 'white';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = 'white';
            e.target.style.color = '#1a5f4a';
          }}
        >
          START RACE
        </button>
      </div>
    );
  }

  // Game Screen
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
      left: 0,
      fontFamily: '"Space Mono", monospace'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-start', 
        alignItems: 'center',
        width: '100%',
        padding: '32px 60px',
        marginLeft: '120px',
        gap: '200px',
        color: 'white'
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '32px',
          fontWeight: '700',
          letterSpacing: '2px'
        }}>
          pit crew pups
        </h1>
        
        <div style={{ 
          display: 'flex', 
          gap: '24px', 
          fontSize: '18px',
          fontWeight: '400',
          letterSpacing: '1px'
        }}>
          <span>lap {myLap}/{TOTAL_LAPS}</span>
          <span></span>
          <span>time {raceTime.toFixed(1)}s</span>
          <span></span>
          <span>speed {Math.floor(myPlayer.current.speed * 10)}</span>
        </div>
      </div>

      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        style={{ display: 'block' }}
      />

      {raceFinished && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          fontFamily: '"Space Mono", monospace'
        }}>
          <div style={{
            textAlign: 'center',
            color: 'white'
          }}>
            <h2 style={{ 
              fontSize: '64px', 
              margin: '0 0 24px 0',
              fontWeight: '700',
              letterSpacing: '4px',
              textTransform: 'uppercase'
            }}>
              RACE COMPLETE
            </h2>
            <p style={{ 
              fontSize: '32px',
              margin: '0 0 48px 0',
              letterSpacing: '2px'
            }}>
              {raceTime.toFixed(2)}S
            </p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                padding: '16px 40px',
                fontSize: '18px',
                backgroundColor: 'white',
                color: '#1a5f4a',
                border: '2px solid white',
                cursor: 'pointer',
                fontWeight: '700',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontFamily: '"Space Mono", monospace',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'white';
                e.target.style.color = '#1a5f4a';
              }}
            >
              RACE AGAIN
            </button>
          </div>
        </div>
      )}

      <div style={{
        position: 'fixed',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '14px',
        letterSpacing: '1px',
        textTransform: 'uppercase'
      }}>
        use arrow keys or WASD to move 
      </div>
    </div>
  );
}

export default Game;