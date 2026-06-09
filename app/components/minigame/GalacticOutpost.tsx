"use client";

import React, { useState, useEffect, useCallback } from 'react';

// Costanti del gioco
const GRID_SIZE = 20; // Griglia 20x20
const SPEED = 150; // Velocità in millisecondi

export default function SnakeGame() {
    const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
    const [food, setFood] = useState({ x: 15, y: 5 });
    const [dir, setDir] = useState({ x: 0, y: -1 });
    const [gameOver, setGameOver] = useState(false);
    const [score, setScore] = useState(0);
    const [isStarted, setIsStarted] = useState(false);

    // Genera cibo in una posizione casuale vuota
    const generateFood = useCallback((currentSnake: {x: number, y: number}[]) => {
        let newFood;
        while (true) {
            newFood = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE)
            };
            // eslint-disable-next-line no-loop-func
            if (!currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y)) {
                break;
            }
        }
        return newFood;
    }, []);

    // Gestione dei comandi da tastiera
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Previene lo scrolling della pagina con le frecce
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
            }

            if (!isStarted && !gameOver && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                setIsStarted(true);
            }

            setDir((prevDir) => {
                switch (e.key) {
                    case 'ArrowUp':
                        return prevDir.y === 1 ? prevDir : { x: 0, y: -1 };
                    case 'ArrowDown':
                        return prevDir.y === -1 ? prevDir : { x: 0, y: 1 };
                    case 'ArrowLeft':
                        return prevDir.x === 1 ? prevDir : { x: -1, y: 0 };
                    case 'ArrowRight':
                        return prevDir.x === -1 ? prevDir : { x: 1, y: 0 };
                    default:
                        return prevDir;
                }
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isStarted, gameOver]);

    // Game Loop principale
    useEffect(() => {
        if (gameOver || !isStarted) return;

        const moveSnake = () => {
            setSnake((prevSnake) => {
                const head = prevSnake[0];
                const newHead = { x: head.x + dir.x, y: head.y + dir.y };

                // Controllo collisioni coi muri
                if (
                    newHead.x < 0 ||
                    newHead.x >= GRID_SIZE ||
                    newHead.y < 0 ||
                    newHead.y >= GRID_SIZE
                ) {
                    setGameOver(true);
                    return prevSnake;
                }

                // Controllo collisioni col proprio corpo
                if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
                    setGameOver(true);
                    return prevSnake;
                }

                const newSnake = [newHead, ...prevSnake];

                // Se mangia il cibo
                if (newHead.x === food.x && newHead.y === food.y) {
                    setScore(s => s + 10);
                    setFood(generateFood(newSnake));
                } else {
                    newSnake.pop(); // Rimuove la coda se non ha mangiato
                }

                return newSnake;
            });
        };

        const interval = setInterval(moveSnake, SPEED);
        return () => clearInterval(interval);
    }, [dir, food, gameOver, isStarted, generateFood]);

    const resetGame = () => {
        setSnake([{ x: 10, y: 10 }]);
        setDir({ x: 0, y: -1 });
        setFood(generateFood([{ x: 10, y: 10 }]));
        setGameOver(false);
        setScore(0);
        setIsStarted(false);
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            // Colore di sfondo trasparente/leggero per fondersi col tuo sito
            backgroundColor: 'transparent',
            padding: '20px',
            boxSizing: 'border-box'
        }}>
            
            {/* Header del gioco */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                maxWidth: '400px',
                marginBottom: '15px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: '#333'
            }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Re-Love Snake</h2>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ff6b4a' }}>Punti: {score}</div>
            </div>

            {/* Contenitore Griglia di Gioco */}
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '400px',
                aspectRatio: '1 / 1', // Mantiene sempre il gioco quadrato
                backgroundColor: '#ffffff', // Sfondo hero
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                border: '2px solid #f0f0f0',
                overflow: 'hidden',
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`
            }}>
                
                {/* Rendering Cibo */}
                <div style={{
                    gridColumnStart: food.x + 1,
                    gridRowStart: food.y + 1,
                    backgroundColor: '#ff6b4a', // Arancione logo Re-Love
                    borderRadius: '50%',
                    transform: 'scale(0.8)'
                }} />

                {/* Rendering Serpente */}
                {snake.map((segment, index) => (
                    <div key={index} style={{
                        gridColumnStart: segment.x + 1,
                        gridRowStart: segment.y + 1,
                        backgroundColor: index === 0 ? '#1f2937' : '#4b5563', // Testa scura, corpo grigio
                        borderRadius: index === 0 ? '4px' : '2px',
                        transform: 'scale(0.95)'
                    }} />
                ))}

                {/* Overlay Game Over / Inizio */}
                {(!isStarted || gameOver) && (
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.85)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 10,
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>
                        {gameOver ? (
                            <>
                                <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#1f2937' }}>Game Over!</h3>
                                <p style={{ color: '#4b5563', marginBottom: '20px' }}>Hai totalizzato {score} punti</p>
                                <button 
                                    onClick={resetGame}
                                    style={{
                                        backgroundColor: '#ff6b4a',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        fontSize: '1rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 6px rgba(255, 107, 74, 0.3)'
                                    }}
                                >
                                    Riprova
                                </button>
                            </>
                        ) : (
                            <p style={{ color: '#4b5563', fontSize: '1.1rem', fontWeight: '500' }}>
                                Usa le <strong>Frecce Direzionali</strong> per iniziare
                            </p>
                        )}
                    </div>
                )}
            </div>
            
            <p style={{ marginTop: '15px', color: '#888', fontSize: '0.85rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                Gioca mentre aspetti che i tuoi articoli vengano venduti!
            </p>
        </div>
    );
}