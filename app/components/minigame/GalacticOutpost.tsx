"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './galactic.css';

// --- DATABASE OGGETTI ESPANSO ---
const dbItems = [
    { id: "rations", name: "Razioni Sintetiche", val: 50, illegal: false, icon: "🥫" },
    { id: "scrap", name: "Rottami di Droide", val: 80, illegal: false, icon: "⚙️" },
    { id: "solar", name: "Matrice Eco-Solare", val: 250, illegal: false, icon: "☀️" },
    { id: "med", name: "Gel Medico", val: 120, illegal: false, icon: "💉" },
    { id: "miner", name: "ASIC Quantum Miner", val: 600, illegal: false, icon: "🖥️" },
    { id: "sneakers", name: "Stivali Air-J8", val: 350, illegal: true, icon: "👟" },
    { id: "cpu", name: "Chip Neurale R9", val: 500, illegal: true, icon: "🧠" },
    { id: "spores", name: "Spore Allucinogene", val: 400, illegal: true, icon: "🍄" },
    { id: "data", name: "Dati Militari", val: 800, illegal: true, icon: "💾" }
];

const aliens = ["un contrabbandiere Zorgon", "un androide dismesso", "una canaglia Umana", "un monaco Xylothiano"];

export default function GalacticOutpost() {
    // --- STATI DEL GIOCO ---
    const [credits, setCredits] = useState(1000);
    const [energy, setEnergy] = useState(100);
    const [suspicion, setSuspicion] = useState(0);
    const [cycle, setCycle] = useState(1);
    const [encounters, setEncounters] = useState(0);
    const [inventory, setInventory] = useState<any[]>([]);
    
    // Infrastruttura
    const [miners, setMiners] = useState(0);
    const [solarPanels, setSolarPanels] = useState(0);

    const [screenOutput, setScreenOutput] = useState<React.ReactNode>(
        <p className="glitch-text" data-text="Inizializzazione sistema visivo... OK.">
            Inizializzazione sistema visivo... <span className="highlight-green">OK</span>.
        </p>
    );
    const [currentOffer, setCurrentOffer] = useState<any>(null);
    const [controlsType, setControlsType] = useState('scan');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // --- SFONDO STELLARE ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let animationFrameId: number;
        let stars: any[] = [];
        const resizeCanvas = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        for (let i = 0; i < 200; i++) stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, z: Math.random() * canvas.width, radius: Math.random() * 1.5 });

        const drawStars = () => {
            ctx.fillStyle = '#020205'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#ffffff';
            stars.forEach(star => {
                star.z -= 1.5; 
                if (star.z <= 0) { star.z = canvas.width; star.x = Math.random() * canvas.width; star.y = Math.random() * canvas.height; }
                let k = 128.0 / star.z;
                let px = (star.x - canvas.width / 2) * k + canvas.width / 2;
                let py = (star.y - canvas.height / 2) * k + canvas.height / 2;
                let size = (1 - star.z / canvas.width) * 3;
                if (px >= 0 && px <= canvas.width && py >= 0 && py <= canvas.height) {
                    ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${100 + size*50}, ${200 + size*10}, 255, ${1 - star.z/canvas.width})`; ctx.fill();
                }
            });
            animationFrameId = requestAnimationFrame(drawStars);
        };
        drawStars();
        return () => { window.removeEventListener('resize', resizeCanvas); cancelAnimationFrame(animationFrameId); };
    }, []);

    // --- LOGICA DEL CICLO E MINING ---
    const nextEvent = () => {
        let currentEncounters = encounters + 1;
        let currentEnergy = energy;
        let currentCycle = cycle;
        let currentSusp = suspicion;
        let currentCreds = credits;

        if (currentEncounters >= 4) {
            currentEncounters = 0;
            currentCycle += 1;
            
            // Calcolo Infrastruttura
            let baseDrain = 10;
            let minerDrain = miners * 15;
            let solarGen = solarPanels * 12;
            let cryptoMined = miners * 60;
            
            currentEnergy = currentEnergy - baseDrain - minerDrain + solarGen;
            currentCreds += cryptoMined;
            
            if (currentSusp > 0) currentSusp = Math.max(0, currentSusp - 5);
            
            if (currentEnergy < 0) {
                setScreenOutput(<h2><span className="highlight-red">TERMINAZIONE SISTEMA</span><br/>SISTEMA DI SUPPORTO VITALE OFFLINE.</h2>);
                setControlsType('gameover');
                return;
            }
        }

        setEncounters(currentEncounters);
        setCycle(currentCycle);
        setEnergy(Math.min(100, currentEnergy)); // Cap max 100
        setSuspicion(currentSusp);
        setCredits(currentCreds);

        if (currentSusp >= 100) {
            triggerRaid();
            return;
        }

        generateEvent();
    };

    const triggerRaid = () => {
        const fine = Math.floor(credits * 0.8);
        setCredits(prev => prev - fine);
        setInventory(prev => prev.filter(i => !i.illegal));
        setSuspicion(0);
        setScreenOutput(
            <>
                <p className="highlight-red" style={{fontSize:'1.5rem'}}>ALLARME ROSSO: RAID FEDERAZIONE</p>
                <p>La tua merce illegale è stata sequestrata. È stata prelevata una multa di <strong>{fine} ⌬</strong> dai tuoi conti.</p>
            </>
        );
        setControlsType('scan');
    };

    const generateEvent = () => {
        const rand = Math.random();
        if (rand < 0.2) {
            // Evento: Commerciante Hardware
            setScreenOutput(<p>Un cargo industriale offre infrastrutture in saldo.</p>);
            setControlsType('infrastructure');
        } else {
            // Evento Cliente (Compra/Vende)
            const alien = aliens[Math.floor(Math.random() * aliens.length)];
            const isSelling = Math.random() > 0.5 || inventory.length === 0;

            if (!isSelling) {
                const item = inventory[Math.floor(Math.random() * inventory.length)];
                const offer = Math.floor(item.val * (0.8 + Math.random() * 0.5));
                setCurrentOffer({ type: 'sell', itemUID: item.uid, price: offer, illegal: item.illegal });
                setScreenOutput(<><p>Attracco di {alien}.</p><p>"Compro il tuo <strong>{item.name}</strong> per <span className="highlight-green">{offer} ⌬</span>."</p></>);
                setControlsType('sell');
            } else {
                const item = { ...dbItems[Math.floor(Math.random() * dbItems.length)], uid: Math.random().toString(36).substring(2, 9) };
                const ask = Math.floor(item.val * (0.7 + Math.random() * 0.4));
                setCurrentOffer({ type: 'buy', item: item, price: ask });
                setScreenOutput(<><p>{alien} offre un carico.</p><p>"Ti lascio <strong>{item.name}</strong> per <span className="highlight-yellow">{ask} ⌬</span>."</p></>);
                setControlsType('buy');
            }
        }
    };

    // --- AZIONI ---
    const handleTransaction = (action: 'buy' | 'sell') => {
        if (action === 'sell') {
            setInventory(prev => prev.filter(i => i.uid !== currentOffer.itemUID));
            setCredits(prev => prev + currentOffer.price);
            if (currentOffer.illegal) setSuspicion(prev => prev + 15);
            setScreenOutput(<p>Transazione completata. <span className="highlight-green">+{currentOffer.price} ⌬</span></p>);
        } else {
            setCredits(prev => prev - currentOffer.price);
            setInventory(prev => [...prev, currentOffer.item]);
            if (currentOffer.item.illegal) setSuspicion(prev => prev + 10);
            setScreenOutput(<p>Carico acquisito. <span className="highlight-red">-{currentOffer.price} ⌬</span></p>);
        }
        setControlsType('scan');
    };

    const buyInfra = (type: 'miner' | 'solar') => {
        if (type === 'miner' && credits >= 600) {
            setCredits(prev => prev - 600);
            setMiners(prev => prev + 1);
            setScreenOutput(<p>ASIC Miner installato. <span className="highlight-red">Consumo energetico aumentato!</span></p>);
        } else if (type === 'solar' && credits >= 300) {
            setCredits(prev => prev - 300);
            setSolarPanels(prev => prev + 1);
            setScreenOutput(<p>Matrice Eco-Solare connessa alla rete.</p>);
        }
        setControlsType('scan');
    };

    // --- COMPONENTI UI ---
    const ProgressBar = ({ label, value, color, max = 100 }: any) => (
        <div className="progress-container">
            <div className="progress-header"><span>{label}</span><span>{value}/{max}</span></div>
            <div className="progress-track">
                <motion.div className="progress-fill" style={{ backgroundColor: color }} initial={{ width: 0 }} animate={{ width: `${(value/max)*100}%` }} transition={{ duration: 0.5 }} />
            </div>
        </div>
    );

    return (
        <div className="game-wrapper crt-effect">
            <canvas ref={canvasRef} id="starfield"></canvas>
            <div className="scanlines"></div>
            <div className="noise-overlay"></div>

            <motion.div className="sys-container-advanced" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
                
                {/* HEADER GLOBALE */}
                <header className="global-header">
                    <div className="title glitch-text" data-text="OS // AVAMPOSTO 9">OS // AVAMPOSTO 9</div>
                    <div className="top-stats">
                        <span className="stat-cred">⌬ {credits}</span>
                        <span className="stat-cycle">CICLO {cycle}</span>
                    </div>
                </header>

                {/* COLONNA SINISTRA: MAGAZZINO */}
                <div className="panel cargo-hold">
                    <h3>STIVA PRINCIPALE</h3>
                    <AnimatePresence>
                        {inventory.map(item => (
                            <motion.div key={item.uid} layout initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}} exit={{opacity:0, scale:0.8}} className={`item-slot ${item.illegal ? 'item-illegal' : ''}`}>
                                <div className="item-title">{item.icon} {item.name}</div>
                                <div className="item-meta"><span>{item.val} ⌬</span>{item.illegal ? <span className="highlight-red">ILLEGALE</span> : <span className="highlight-green">LEGALE</span>}</div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* COLONNA CENTRALE: TERMINALE */}
                <div className="panel terminal">
                    <div className="screen-output">
                        <AnimatePresence mode="wait">
                            <motion.div key={controlsType} initial={{opacity:0, filter:"blur(4px)"}} animate={{opacity:1, filter:"blur(0px)"}} exit={{opacity:0}}>
                                {screenOutput}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                    
                    <div className="command-panel">
                        {controlsType === 'scan' && <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={nextEvent} className="btn-full">[ AVVIA SCANSIONE SETTORE ]</motion.button>}
                        {controlsType === 'sell' && (
                            <>
                                <button onClick={() => handleTransaction('sell')} className="btn-neutral">[ ACCETTA OFFERTA ]</button>
                                <button onClick={() => { setScreenOutput(<p>Comunicazione chiusa.</p>); setControlsType('scan'); }} className="btn-danger">[ RIFIUTA ]</button>
                            </>
                        )}
                        {controlsType === 'buy' && (
                            <>
                                <button disabled={credits < currentOffer?.price} onClick={() => handleTransaction('buy')} className="btn-neutral">[ COMPRA MERCE ]</button>
                                <button onClick={() => { setScreenOutput(<p>Canale chiuso.</p>); setControlsType('scan'); }} className="btn-danger">[ RIFIUTA ]</button>
                            </>
                        )}
                        {controlsType === 'infrastructure' && (
                            <>
                                <button disabled={credits < 600} onClick={() => buyInfra('miner')} className="btn-neutral">[ COMPRA MINER (600⌬) ]</button>
                                <button disabled={credits < 300} onClick={() => buyInfra('solar')} className="btn-neutral">[ COMPRA PANNELLO (300⌬) ]</button>
                                <button onClick={() => { setControlsType('scan'); setScreenOutput(<p>Nessun acquisto.</p>); }} className="btn-danger">[ ESCI ]</button>
                            </>
                        )}
                        {controlsType === 'gameover' && <button onClick={() => window.location.reload()} className="btn-danger btn-full">[ RIAVVIA SISTEMA ]</button>}
                    </div>
                </div>

                {/* COLONNA DESTRA: STATO E INFRASTRUTTURA */}
                <div className="panel status-panel">
                    <h3>STATO SISTEMA</h3>
                    <ProgressBar label="ENERGIA (⚡)" value={energy} color={energy < 30 ? "#ff0055" : "#00e5ff"} />
                    <ProgressBar label="SOSPETTO (🚨)" value={suspicion} color={suspicion > 70 ? "#ff0055" : "#ffea00"} />
                    
                    <h3 style={{marginTop: '30px'}}>INFRASTRUTTURA</h3>
                    <div className="infra-grid">
                        <div className="infra-box">
                            <span className="infra-icon">🖥️</span>
                            <div className="infra-info">
                                <div>ASIC Miners</div>
                                <div className="highlight-yellow">{miners} Attivi</div>
                            </div>
                        </div>
                        <div className="infra-box">
                            <span className="infra-icon">☀️</span>
                            <div className="infra-info">
                                <div>Pannelli Solari</div>
                                <div className="highlight-green">{solarPanels} Attivi</div>
                            </div>
                        </div>
                    </div>
                    <div style={{marginTop: '15px', fontSize: '0.85rem', color: '#888'}}>
                        * I Miners generano 60⌬ ma consumano 15⚡/ciclo.<br/>
                        * I Pannelli generano 12⚡/ciclo.
                    </div>
                </div>

            </motion.div>
        </div>
    );
}