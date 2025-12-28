import { catalog } from './catalog.js';

/* --- Astronomy Engine (SSR) --- */
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function toRad(deg) { return deg * DEG2RAD; }
function toDeg(rad) { return rad * RAD2DEG; }

function getJulianDate(date) { return (date.getTime() / 86400000) + 2440587.5; }

function getAltAz(ra, dec, lat, lon, date) {
    const jd = getJulianDate(date);
    const d = jd - 2451545.0;
    let gmst = 280.46061837 + 360.98564736629 * d;
    gmst %= 360; if (gmst < 0) gmst += 360;
    let lst = gmst + lon; lst %= 360; if (lst < 0) lst += 360;

    const ha = lst - ra;
    const haRad = toRad(ha);
    const decRad = toRad(dec);
    const latRad = toRad(lat);

    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
    const altRad = Math.asin(sinAlt);
    const alt = toDeg(altRad);

    const cosAz = (Math.sin(decRad) - Math.sin(altRad) * Math.sin(latRad)) / (Math.cos(altRad) * Math.cos(latRad));
    let azRad = Math.acos(Math.min(1, Math.max(-1, cosAz)));
    if (Math.sin(haRad) > 0) azRad = 2 * Math.PI - azRad;
    const az = toDeg(azRad);
    return { alt, az };
}

function getMoonData(date) {
    const jd = getJulianDate(date);
    const d = jd - 2444238.5;
    const phaseRaw = (d / 29.530588853) % 1;
    const illum = 0.5 * (1 - Math.cos(phaseRaw * 2 * Math.PI));
    return { illumination: Math.round(illum * 100) };
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        let lat = 42.69, lon = 23.32, date = new Date(), bortle = 4;

        if (request.method === "POST") {
            const fd = await request.formData();
            lat = parseFloat(fd.get("latitude")) || lat;
            lon = parseFloat(fd.get("longitude")) || lon;
            if (fd.get("datetime")) date = new Date(fd.get("datetime"));
            bortle = parseInt(fd.get("bortle")) || bortle;
        }

        const moon = getMoonData(date);

        const objects = catalog.map(obj => {
            const pos = getAltAz(obj.ra, obj.dec, lat, lon, date);
            let score = 0;
            if (pos.alt > 0) {
                let altScore = (pos.alt > 30) ? 50 : (pos.alt / 30) * 50;
                const magScore = Math.max(0, 50 - (obj.mag * 5));
                score = Math.max(0, altScore + magScore - (bortle * 2));
            }
            return { ...obj, altitude: pos.alt, azimuth: pos.az, score };
        }).sort((a, b) => b.score - a.score);

        return new Response(renderPage(objects, moon, lat, lon, date, bortle), {
            headers: { "Content-Type": "text/html" }
        });
    },
};

function renderPage(objects, moon, lat, lon, date, bortle) {
    // Holographic Radar Dots
    const radarDots = objects.filter(o => o.altitude > 0).map(obj => {
        const r = 48 * (90 - obj.altitude) / 90;
        const theta = (obj.azimuth - 90) * (Math.PI / 180);
        const x = 50 + r * Math.cos(theta);
        const y = 50 + r * Math.sin(theta);

        // Colors: High=Cyan/Blue, Low=Purple/Pink
        const color = obj.altitude > 40 ? '#22d3ee' : '#c084fc';
        const pulseClass = obj.score > 80 ? 'animate-pulse-fast' : '';

        // Detailed Tooltip Data
        const tooltip = `${obj.id} (${obj.name}) | Alt: ${obj.altitude.toFixed(0)}°`;

        return `
        <!-- Item Group -->
        <g class="group cursor-pointer hover:z-[100]" onclick="openSim('${obj.id}', '${obj.ra}', '${obj.dec}', '${obj.size || 15}')">
            
            <!-- Large Hit Area (Invisible but clickable) -->
            <circle cx="${x}" cy="${y}" r="8" fill="transparent" class="group-hover:fill-white/10"></circle>
            
            <!-- Visual Dot -->
            <circle cx="${x}" cy="${y}" r="2" fill="${color}" class="drop-shadow-[0_0_5px_${color}] ${pulseClass} transition-transform group-hover:scale-150"></circle>
            
            <!-- CSS Tooltip (Inside ForeignObject) -->
            <foreignObject x="${x - 30}" y="${y - 45}" width="60" height="40" class="pointer-events-none overflow-visible">
                <div xmlns="http://www.w3.org/1999/xhtml" class="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 transform translate-y-2 group-hover:translate-y-0">
                    <div class="bg-black/90 border border-slate-700/50 rounded px-2 py-1 shadow-xl flex flex-col items-center text-center">
                        <span class="text-[6px] font-bold text-white whitespace-nowrap leading-none mb-0.5">${obj.id}</span>
                        <span class="text-[4px] text-accent-400 whitespace-nowrap leading-none">Alt: ${obj.altitude.toFixed(0)}°</span>
                    </div>
                </div>
            </foreignObject>
        </g>`;
    }).join('');

    const targetRows = objects.map(obj => `
        <tr class="group border-b border-slate-800/50 hover:bg-slate-800/50 transition cursor-pointer" onclick="openSim('${obj.id}', '${obj.ra}', '${obj.dec}', '${obj.size || 15}')">
            <td class="p-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold ring-1 ring-white/10 group-hover:ring-accent-500/50 transition">
                        ${obj.type.includes('Cluster') ? '✨' : obj.type.includes('Galaxy') ? '🌀' : '☁️'}
                    </div>
                    <div>
                        <div class="font-bold text-slate-200 group-hover:text-accent-400 transition">${obj.id}</div>
                        <div class="text-xs text-slate-500">${obj.name}</div>
                    </div>
                </div>
            </td>
            <td class="p-4 hidden sm:table-cell text-sm text-slate-400">${obj.const}</td>
            <td class="p-4 text-center">
                 <div class="inline-flex flex-col">
                    <span class="text-lg font-mono font-bold ${obj.altitude > 30 ? 'text-cyan-400' : 'text-purple-400'}">${obj.altitude.toFixed(0)}°</span>
                    <span class="text-[10px] uppercase text-slate-600 font-bold">Altitude</span>
                 </div>
            </td>
            <td class="p-4 text-right">
                <button class="bg-indigo-600/20 hover:bg-indigo-600 hover:text-white text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-2 ml-auto">
                    <span>Simulate</span> 🔭
                </button>
            </td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en" class="dark scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AstroWell Pro</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              space: { 950: '#02040a', 900: '#0B0D17', 800: '#151932' },
              accent: { 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' }
            },
            animation: { 'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite', 'spin-slow': 'spin 3s linear infinite' }
          }
        }
      }
    </script>
    <style>
        body { background: #02040a; color: #cbd5e1; font-family: 'Inter', sans-serif; overflow-x: hidden; }
        .grid-bg { 
            background-image: 
                linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 50px 50px;
        }
        .radar-glow { box-shadow: 0 0 40px rgba(14, 165, 233, 0.1); }
        .modal-enter { opacity: 0; transform: scale(0.95); }
        .modal-enter-active { opacity: 1; transform: scale(1); transition: all 0.2s ease-out; }
    </style>
</head>
<body class="grid-bg min-h-screen">
    
    <!-- Header -->
    <nav class="border-b border-white/5 bg-space-950/80 backdrop-blur-md sticky top-0 z-40">
        <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="bg-gradient-to-tr from-accent-500 to-purple-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg">🔭</div>
                <h1 class="font-bold text-xl tracking-wide text-white">AstroWell <span class="text-accent-400 font-light">Pro</span></h1>
            </div>
            <div class="flex items-center gap-4 text-xs font-mono text-slate-500">
                <div class="hidden sm:block">LAT: ${lat}</div>
                <div class="hidden sm:block">LON: ${lon}</div>
                <div class="bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-slate-300 flex items-center gap-2">
                    <span class="${moon.illumination > 50 ? 'text-yellow-300' : 'text-slate-500'}">●</span> Moon: ${moon.illumination}%
                </div>
            </div>
        </div>
    </nav>

    <main class="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
        
        <!-- Left Column: Controls & Radar (Col 5) -->
        <aside class="lg:col-span-5 space-y-8">
            
            <!-- Radar Map -->
            <div class="bg-space-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden radar-glow group">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-sm font-bold uppercase tracking-wider text-slate-400">Live Sky Radar</h2>
                    <span class="text-xs bg-accent-500/10 text-accent-400 px-2 py-1 rounded border border-accent-500/20 animate-pulse">LIVE</span>
                </div>
                
                <div class="aspect-square relative flex items-center justify-center">
                    <svg viewBox="0 0 100 100" class="w-full h-full max-w-[400px]">
                        <defs>
                            <radialGradient id="grad1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                                <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:0.05" />
                                <stop offset="100%" style="stop-color:#02040a;stop-opacity:0" />
                            </radialGradient>
                        </defs>
                        <circle cx="50" cy="50" r="48" fill="url(#grad1)" stroke="#1e293b" stroke-width="0.5"></circle>
                        <circle cx="50" cy="50" r="32" fill="none" stroke="#334155" stroke-width="0.2" stroke-dasharray="1 3"></circle>
                        <circle cx="50" cy="50" r="16" fill="none" stroke="#334155" stroke-width="0.2" stroke-dasharray="1 3"></circle>
                        <line x1="50" y1="2" x2="50" y2="98" stroke="#334155" stroke-width="0.2"></line>
                        <line x1="2" y1="50" x2="98" y2="50" stroke="#334155" stroke-width="0.2"></line>
                        
                        <text x="50" y="5" text-anchor="middle" font-size="2.5" font-weight="bold" fill="#38bdf8">N</text>
                        <text x="97" y="51" text-anchor="middle" font-size="2.5" font-weight="bold" fill="#64748b">E</text>
                        <text x="50" y="99" text-anchor="middle" font-size="2.5" font-weight="bold" fill="#64748b">S</text>
                        <text x="3" y="51" text-anchor="middle" font-size="2.5" font-weight="bold" fill="#64748b">W</text>
                        
                        ${radarDots}
                    </svg>
                </div>
                <div class="text-center text-[10px] text-slate-600 mt-2 font-mono">Center = Zenith (90°) • Edge = Horizon (0°)</div>
            </div>

            <!-- Quick Settings -->
            <div class="bg-space-900/50 border border-white/5 rounded-xl p-6">
                <form method="POST">
                     <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">LATITUDE</label>
                            <input type="text" name="latitude" value="${lat}" class="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none transition">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">LONGITUDE</label>
                            <input type="text" name="longitude" value="${lon}" class="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none transition">
                        </div>
                     </div>
                     <button class="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition border border-white/5">
                        Update Coordinates
                     </button>
                </form>
            </div>
        </aside>

        <!-- Right Column: List (Col 7) -->
        <section class="lg:col-span-7">
            <div class="bg-space-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div class="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                    <div>
                        <h2 class="font-bold text-lg text-white">Observation Targets</h2>
                        <p class="text-xs text-slate-500 mt-1">Sorted by Altitude & Quality</p>
                    </div>
                    <div class="bg-accent-500/10 text-accent-400 px-3 py-1 rounded-full text-xs font-bold border border-accent-500/20">
                        ${objects.length} Objects
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <tbody class="divide-y divide-white/5">
                            ${targetRows}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>

    </main>

    <!-- SIMULATOR MODAL (Hidden by default) -->
    <div id="simModal" class="fixed inset-0 z-50 hidden flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity opacity-0">
        <div class="relative w-full max-w-2xl bg-space-900 rounded-2xl border border-white/10 shadow-2xl transform scale-95 transition-transform duration-300" id="simContent">
            
            <!-- Modal Header -->
            <div class="p-4 border-b border-white/10 flex justify-between items-center bg-black/40 rounded-t-2xl">
                <div class="flex items-center gap-3">
                    <h3 class="font-bold text-xl text-white" id="simTitle">Target</h3>
                    <span class="text-xs font-mono text-slate-400 bg-white/5 px-2 py-1 rounded" id="simCoords">RA: 00h 00m</span>
                </div>
                <button onclick="closeSim()" class="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition">✕</button>
            </div>

            <!-- Viewport -->
            <div class="relative aspect-square w-full bg-black overflow-hidden flex items-center justify-center group">
                <!-- Loading Spinner -->
                <div id="simLoading" class="absolute inset-0 flex items-center justify-center z-20">
                    <div class="w-10 h-10 border-4 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                
                <!-- Image -->
                <img id="simImage" src="" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-50" onload="imageLoaded()" onerror="imageError()">
                
                <!-- Reticle Overlay -->
                <div class="absolute w-1/2 h-1/2 border border-green-500/80 shadow-[0_0_15px_rgba(34,197,94,0.3)] pointer-events-none z-10 opacity-80">
                    <div class="absolute top-[50%] left-0 w-2 h-[1px] bg-green-500"></div>
                    <div class="absolute top-[50%] right-0 w-2 h-[1px] bg-green-500"></div>
                    <div class="absolute left-[50%] top-0 w-[1px] h-2 bg-green-500"></div>
                    <div class="absolute left-[50%] bottom-0 w-[1px] h-2 bg-green-500"></div>
                </div>

                <div class="absolute bottom-4 left-4 bg-black/70 backdrop-blur px-3 py-1.5 rounded border border-white/10 text-xs text-green-400 font-mono z-20">
                    SIMULATED FOV
                </div>
            </div>

            <div class="p-4 bg-space-950 rounded-b-2xl border-t border-white/10 text-center">
                <p class="text-xs text-slate-500">Imagery provided by STScI Digitized Sky Survey. Field of View is approximate.</p>
            </div>

        </div>
    </div>

    <script>
        let currentTarget = {};

        function openSim(id, ra, dec, size) {
            currentTarget = { id, ra, dec, size };
            const modal = document.getElementById('simModal');
            const content = document.getElementById('simContent');
            const img = document.getElementById('simImage');
            const loader = document.getElementById('simLoading');
            
            // UI Set
            document.getElementById('simTitle').innerText = id;
            document.getElementById('simCoords').innerText = \`RA: \${parseFloat(ra).toFixed(4)}° | DEC: \${parseFloat(dec).toFixed(4)}°\`;
            
            // Reset
            loader.style.display = 'flex';
            loader.innerHTML = '<div class="w-10 h-10 border-4 border-accent-500 border-t-transparent rounded-full animate-spin"></div>';
            img.style.opacity = '0';
            img.src = ''; 
            
            // Load Strategy 1: STScI DSS (High Quality GIF)
            setTimeout(() => {
                // Ensure size is reasonable (max 60 arcmin for DSS usually)
                const safeSize = Math.min(60, parseFloat(size) || 15);
                img.src = \`https://server.dss.stsci.edu/product?task=thumb&r=\${ra}&d=\${dec}&w=\${safeSize}&h=\${safeSize}&f=gif\`;
            }, 50);

            modal.classList.remove('hidden');
            void modal.offsetWidth;
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
        }

        function closeSim() {
            const modal = document.getElementById('simModal');
            const content = document.getElementById('simContent');
            
            modal.classList.add('opacity-0');
            content.classList.add('scale-95');
            
            setTimeout(() => {
                modal.classList.add('hidden');
                document.getElementById('simImage').src = ''; 
        // ... closeSim ...

        function imageLoaded() {
            const loader = document.getElementById('simLoading');
            const img = document.getElementById('simImage');
            if(loader) loader.style.display = 'none';
            if(img) img.style.opacity = '1';
        }
        
        function imageError() {
             console.warn("DSS Failed, trying backup...");
             const img = document.getElementById('simImage');
             // Avoid infinite loop
             if (!img || img.src.includes('sky-map.org')) {
                const loader = document.getElementById('simLoading');
                if(loader) loader.innerHTML = '<span class="text-red-500 text-xs">Image unavailable in all surveys</span>';
                return;
             }
             
             // Backup Strategy: WikiSky
             const w = 400; 
             const h = 400;
             img.src = \`http://server7.sky-map.org/imgcut?survey=DSS2&img_id=all&angle=0.5&ra=\${currentTarget.ra}&de=\${currentTarget.dec}&w=\${w}&h=\${h}&projection=tan\`;
        }

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSim();
        });
    </script>
</body>
</html>
    `;
}
