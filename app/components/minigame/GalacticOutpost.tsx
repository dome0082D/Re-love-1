"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Box, Text, Plane, Cone, Cylinder, Sphere } from '@react-three/drei';
import * as THREE from 'three';

// --- DATABASE MERCE ---
const dbItems = [
    { id: "cpu", name: "Processore Quantico", val: 750, color: "#ff4040" },
    { id: "gpu", name: "Scheda Grafica RTX", val: 1200, color: "#00ff00" },
    { id: "shoes", name: "Stivali Anti-Gravità", val: 400, color: "#ffffff" },
    { id: "solar", name: "Cella Solare", val: 800, color: "#00ccff" },
    { id: "relic", name: "Reliquia Antica", val: 1500, color: "#bb86fc" }
];

const npcNames = ["Mercante Nomade", "Cercatore", "Abitante Locale", "Contrabbandiere"];

// --- CONTROLLER GIOCATORE (WASD) ---
function Player() {
    const { camera } = useThree();
    const keys = useRef({ w: false, a: false, s: false, d: false });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (key in keys.current) keys.current[key as keyof typeof keys.current] = true;
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (key in keys.current) keys.current[key as keyof typeof keys.current] = false;
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useFrame(() => {
        const speed = 0.15; 
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; 
        dir.normalize();

        const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();

        if (keys.current.w) camera.position.addScaledVector(dir, speed);
        if (keys.current.s) camera.position.addScaledVector(dir, -speed);
        if (keys.current.a) camera.position.addScaledVector(side, speed);
        if (keys.current.d) camera.position.addScaledVector(side, -speed);
    });

    return <PointerLockControls />;
}

// --- COMPONENTI DEL MONDO (LOW-POLY) ---
function Tree({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            <Cylinder args={[0.2, 0.2, 2]} position={[0, 1, 0]}>
                <meshStandardMaterial color="#5c4033" />
            </Cylinder>
            <Cone args={[1.5, 3]} position={[0, 3, 0]}>
                <meshStandardMaterial color="#2d4c1e" />
            </Cone>
        </group>
    );
}

function Mountain({ position, scale = 1 }: { position: [number, number, number], scale?: number }) {
    return (
        <Cone args={[10 * scale, 20 * scale, 4]} position={position} rotation={[0, Math.PI / 4, 0]}>
            <meshStandardMaterial color="#555555" roughness={0.9} />
        </Cone>
    );
}

function Portal({ position, onClick }: { position: [number, number, number], onClick: () => void }) {
    const portalRef = useRef<any>();
    useFrame((state) => {
        if(portalRef.current) portalRef.current.rotation.y += 0.02;
    });

    return (
        <group position={position} onClick={onClick}>
            <Box ref={portalRef} args={[2, 4, 2]} position={[0, 2, 0]}>
                <meshStandardMaterial color="#bb86fc" emissive="#bb86fc" emissiveIntensity={0.5} wireframe={true} />
            </Box>
            <Text position={[0, 4.5, 0]} fontSize={0.4} color="white" anchorX="center" anchorY="middle">
                PORTALE (Viaggia)
            </Text>
        </group>
    );
}

// --- PERSONAGGIO UMANO (NPC DETTAGLIATO) ---
function NPC({ position, data, onClick }: { position: [number, number, number], data: any, onClick: () => void }) {
    const npcRef = useRef<any>();
    const leftArmRef = useRef<any>();
    const rightArmRef = useRef<any>();
    const [hovered, setHover] = useState(false);
    const { camera } = useThree();

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if(npcRef.current) {
            // Guarda sempre verso il giocatore
            npcRef.current.lookAt(camera.position.x, npcRef.current.position.y, camera.position.z);
            
            // Animazione respiro
            npcRef.current.position.y = Math.sin(t * 2 + position[0]) * 0.03;
        }
        if(leftArmRef.current && rightArmRef.current) {
            // Oscillazione naturale delle braccia
            leftArmRef.current.rotation.x = Math.sin(t * 1.5) * 0.1;
            rightArmRef.current.rotation.x = Math.sin(t * 1.5 + Math.PI) * 0.1;
        }
    });

    const skinColor = "#ffcc99";
    const shirtColor = hovered ? "#ffea00" : (data.isSelling ? "#2a52be" : "#be2a40");
    const pantsColor = "#333333";
    const hairColor = "#4a3000";

    return (
        <group position={position} onClick={onClick} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
            <group ref={npcRef}>
                
                {/* Gambe e Bacino */}
                <Box args={[0.2, 0.7, 0.2]} position={[-0.15, 0.35, 0]}>
                    <meshStandardMaterial color={pantsColor} />
                </Box>
                <Box args={[0.2, 0.7, 0.2]} position={[0.15, 0.35, 0]}>
                    <meshStandardMaterial color={pantsColor} />
                </Box>
                <Box args={[0.52, 0.2, 0.25]} position={[0, 0.8, 0]}>
                    <meshStandardMaterial color={pantsColor} />
                </Box>

                {/* Torso */}
                <Box args={[0.5, 0.6, 0.25]} position={[0, 1.2, 0]}>
                    <meshStandardMaterial color={shirtColor} emissive={hovered ? "#ffea00" : "#000"} emissiveIntensity={0.3} />
                </Box>

                {/* Collo */}
                <Cylinder args={[0.06, 0.08, 0.15]} position={[0, 1.55, 0]}>
                    <meshStandardMaterial color={skinColor} />
                </Cylinder>

                {/* Testa, Capelli e Occhi */}
                <group position={[0, 1.75, 0]}>
                    <Sphere args={[0.18, 16, 16]}>
                        <meshStandardMaterial color={skinColor} />
                    </Sphere>
                    <Box args={[0.38, 0.1, 0.38]} position={[0, 0.15, -0.02]}>
                        <meshStandardMaterial color={hairColor} />
                    </Box>
                    <Sphere args={[0.025, 8, 8]} position={[-0.06, 0.02, 0.16]}>
                        <meshBasicMaterial color="#111" />
                    </Sphere>
                    <Sphere args={[0.025, 8, 8]} position={[0.06, 0.02, 0.16]}>
                        <meshBasicMaterial color="#111" />
                    </Sphere>
                </group>

                {/* Braccia collegate alle spalle */}
                <group position={[-0.35, 1.45, 0]} ref={leftArmRef}>
                    <Box args={[0.15, 0.55, 0.15]} position={[0, -0.25, 0]}>
                        <meshStandardMaterial color={skinColor} />
                    </Box>
                </group>
                <group position={[0.35, 1.45, 0]} ref={rightArmRef}>
                    <Box args={[0.15, 0.55, 0.15]} position={[0, -0.25, 0]}>
                        <meshStandardMaterial color={skinColor} />
                    </Box>
                </group>
            </group>
            
            <Text position={[0, 2.4, 0]} fontSize={0.2} color="white" anchorX="center" anchorY="middle">
                {data.name}
            </Text>
        </group>
    );
}

// --- OGGETTI OLOGRAFICI (Loot) ---
function HologramItem({ position, item, onClick }: { position: [number, number, number], item: any, onClick: () => void }) {
    const [hovered, setHover] = useState(false);
    return (
        <group position={position} onClick={onClick} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
            <Box args={[0.8, 0.8, 0.8]} position={[0, 0.4, 0]}>
                <meshStandardMaterial color={hovered ? "#ffffff" : item.color} emissive={item.color} emissiveIntensity={0.8} wireframe={true} />
            </Box>
            <Text position={[0, 1.2, 0]} fontSize={0.2} color="white" anchorX="center" anchorY="middle">{item.name}</Text>
        </group>
    );
}

// --- GESTORE DELLE MAPPE ---
function MapEnvironment({ mapIndex, changeMap, items, npcs, interactNPC, interactItem }: any) {
    return (
        <>
            <Player />
            <ambientLight intensity={0.4} />
            <pointLight position={[0, 10, 0]} intensity={1.5} />

            <Portal position={[0, 0, -15]} onClick={changeMap} />
            
            {items.map((item: any) => <HologramItem key={item.uid} position={[item.x, 0, item.z]} item={item} onClick={() => interactItem(item)} />)}
            {npcs.map((npc: any) => <NPC key={npc.uid} position={[npc.x, 0, npc.z]} data={npc} onClick={() => interactNPC(npc)} />)}

            {/* MAPPA 0: VALLE VERDE */}
            {mapIndex === 0 && (
                <group>
                    <Plane args={[100, 100]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                        <meshStandardMaterial color="#2d4c1e" roughness={1} />
                    </Plane>
                    <Plane args={[100, 8]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 10]}>
                        <meshStandardMaterial color="#1e5f8a" roughness={0.1} />
                    </Plane>
                    <Tree position={[-5, 0, -5]} />
                    <Tree position={[8, 0, -8]} />
                    <Tree position={[-12, 0, 5]} />
                    <Mountain position={[-30, 0, -20]} scale={0.8} />
                </group>
            )}

            {/* MAPPA 1: MONTAGNE */}
            {mapIndex === 1 && (
                <group>
                    <Plane args={[100, 100]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                        <meshStandardMaterial color="#dddddd" roughness={0.8} />
                    </Plane>
                    <Mountain position={[-15, 0, -10]} scale={1.2} />
                    <Mountain position={[15, 0, -15]} scale={1.5} />
                    <Mountain position={[0, 0, 20]} scale={1} />
                </group>
            )}

            {/* MAPPA 2: LAGO */}
            {mapIndex === 2 && (
                <group>
                    <Plane args={[100, 100]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                        <meshStandardMaterial color="#c2b280" roughness={1} />
                    </Plane>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 5]}>
                        <circleGeometry args={[15, 32]} />
                        <meshStandardMaterial color="#00aaff" roughness={0} metalness={0.5} />
                    </mesh>
                    <Tree position={[-18, 0, 0]} />
                    <Tree position={[18, 0, 5]} />
                </group>
            )}
        </>
    );
}

// --- APP PRINCIPALE ---
export default function GalacticOutpost() {
    const [credits, setCredits] = useState(1500);
    const [mapIndex, setMapIndex] = useState(0);
    const mapNames = ["Valle Verde", "Passo Montano", "Lago Cristallo"];

    const [logs, setLogs] = useState<string[]>([
        "GALACTIC OUTPOST ONLINE.",
        "WASD per muoverti. Cerca l'obelisco viola.",
        "Clicca sugli umani o oggetti."
    ]);
    const [activeTerminal, setActiveTerminal] = useState<any>(null);

    const [worldData, setWorldData] = useState<any>({
        0: { items: generateItems(4), npcs: generateNPCs(3) },
        1: { items: generateItems(3), npcs: generateNPCs(2) },
        2: { items: generateItems(5), npcs: generateNPCs(3) }
    });

    function generateItems(count: number) {
        return Array.from({ length: count }).map(() => ({
            ...dbItems[Math.floor(Math.random() * dbItems.length)],
            uid: Math.random().toString(36).substr(2, 9),
            x: (Math.random() - 0.5) * 30, z: (Math.random() - 0.5) * 30
        }));
    }

    function generateNPCs(count: number) {
        return Array.from({ length: count }).map(() => ({
            name: npcNames[Math.floor(Math.random() * npcNames.length)],
            uid: Math.random().toString(36).substr(2, 9),
            x: (Math.random() - 0.5) * 20, z: (Math.random() - 0.5) * 20,
            offerItem: dbItems[Math.floor(Math.random() * dbItems.length)],
            isSelling: Math.random() > 0.5
        }));
    }

    const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 3));

    const handleNextMap = () => {
        const next = (mapIndex + 1) % 3;
        setMapIndex(next);
        addLog(`Viaggio verso: ${mapNames[next]}`);
    };

    const handleInteractItem = (item: any) => setActiveTerminal({ type: 'loot', data: item });
    const handleInteractNPC = (npc: any) => setActiveTerminal({ type: 'npc', data: npc });

    const processTrade = (accepted: boolean) => {
        if (!activeTerminal) return;

        if (activeTerminal.type === 'loot' && accepted) {
            setCredits(prev => prev + activeTerminal.data.val);
            setWorldData((prev: any) => {
                const newData = { ...prev };
                newData[mapIndex].items = newData[mapIndex].items.filter((i: any) => i.uid !== activeTerminal.data.uid);
                return newData;
            });
            addLog(`Raccolto e venduto per ${activeTerminal.data.val} ⌬`);
        } 
        else if (activeTerminal.type === 'npc' && accepted) {
            const npc = activeTerminal.data;
            if (npc.isSelling && credits >= npc.offerItem.val) {
                setCredits(prev => prev - npc.offerItem.val);
                addLog(`Comprato ${npc.offerItem.name} da ${npc.name}.`);
            } else if (!npc.isSelling) {
                setCredits(prev => prev + npc.offerItem.val);
                addLog(`Venduto merce a ${npc.name} per ${npc.offerItem.val} ⌬.`);
            } else {
                addLog("Crediti insufficienti!");
            }
        } else {
            addLog("Azione annullata.");
        }
        setActiveTerminal(null);
    };

    return (
        <div style={{ width: '100%', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#050505' }}>
            
            {/* CONTAINER DEL GIOCO MINIATURIZZATO (10x5 cm) */}
            <div style={{ width: '10cm', height: '5cm', backgroundColor: '#000', position: 'relative', border: '2px solid #00ffcc', boxShadow: '0 0 15px rgba(0, 255, 204, 0.3)', overflow: 'hidden' }}>
                
                {/* OVERLAY HUD ADATTATO */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px', boxSizing: 'border-box', fontFamily: '"Courier New", Courier, monospace', color: '#00ffcc', textShadow: '0 0 2px rgba(0,255,204,0.8)' }}>
                    
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(255, 255, 255, 0.5)', fontSize: '10px' }}>+</div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold' }}>
                        <div>{mapNames[mapIndex].toUpperCase()}</div>
                        <div style={{ color: '#ffea00' }}>CREDITI: {credits} ⌬</div>
                    </div>

                    {/* FINESTRA INTERATTIVA */}
                    {activeTerminal && (
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0, 0, 0, 0.9)', border: '1px solid #00ffcc', padding: '8px', pointerEvents: 'auto', textAlign: 'center', width: '90%' }}>
                            
                            {activeTerminal.type === 'loot' ? (
                                <p style={{ fontSize: '9px', marginBottom: '8px', margin: 0 }}>Trovi: {activeTerminal.data.name} ({activeTerminal.data.val} ⌬)</p>
                            ) : (
                                <p style={{ fontSize: '9px', marginBottom: '8px', margin: 0 }}>
                                    {activeTerminal.data.name}: "{activeTerminal.data.isSelling ? 'Ti vendo' : 'Compro'} {activeTerminal.data.offerItem.name} per {activeTerminal.data.offerItem.val} ⌬"
                                </p>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '10px' }}>
                                <button onClick={() => processTrade(true)} style={btnStyle}>ACCETTA</button>
                                <button onClick={() => processTrade(false)} style={{...btnStyle, borderColor: '#ff0055', color: '#ff0055'}}>RIFIUTA</button>
                            </div>
                        </div>
                    )}

                    <div style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '3px', borderLeft: '2px solid #00ffcc', fontSize: '7px' }}>
                        {logs.map((log, i) => <div key={i} style={{ opacity: 1 - i * 0.2 }}>{`> ${log}`}</div>)}
                    </div>
                </div>

                {/* TELA 3D */}
                <Canvas camera={{ position: [0, 1.5, 0], fov: 75 }}>
                    <MapEnvironment 
                        mapIndex={mapIndex} 
                        changeMap={handleNextMap}
                        items={worldData[mapIndex].items} 
                        npcs={worldData[mapIndex].npcs}
                        interactItem={handleInteractItem}
                        interactNPC={handleInteractNPC}
                    />
                </Canvas>
            </div>
        </div>
    );
}

const btnStyle = { background: 'transparent', color: '#00ffcc', border: '1px solid #00ffcc', padding: '3px 6px', fontFamily: 'inherit', fontSize: '8px', cursor: 'pointer', textTransform: 'uppercase' as const };