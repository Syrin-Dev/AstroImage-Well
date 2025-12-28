
import { catalog } from './catalog.js';

// --- Server-Side Logic (Reliable) ---
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
    return { alt, az: toDeg(azRad) };
}

function getMoonData(date) {
    const jd = getJulianDate(date);
    const d = jd - 2444238.5;
    const phaseRaw = (d / 29.530588853) % 1;
    return { illumination: Math.round(0.5 * (1 - Math.cos(phaseRaw * 2 * Math.PI)) * 100) };
}

// --- Icons (SVG) ---
const ICONS = {
    radar: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 21a9 9 0 0 0 9-9 9.75 9.75 0 0 0-2.74-6.74L16 3"/><path d="M16 16l5-5"/><circle cx="12" cy="12" r="2"/></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        let lat = 42.69, lon = 23.32, date = new Date(); // Default Defaults

        // Calculate Data
        const moon = getMoonData(date);
        const objects = catalog.map(obj => {
            const pos = getAltAz(obj.ra, obj.dec, lat, lon, date);
            const score = (pos.alt > 0) ? (pos.alt / 90 * 50) + (Math.max(0, 15 - obj.mag) * 3) : 0;
            return { ...obj, altitude: pos.alt, azimuth: pos.az, score };
        }).filter(o => o.altitude > 0).sort((a, b) => b.score - a.score);

        // --- RENDER HTML (SSR) ---
        // No Client JS Frameworks. Just HTML + small script for modal.

        // Generate Radar Dots (HTML)
        const dotsHtml = objects.map(obj => {
            const r = 48 * (90 - obj.altitude) / 90;
            const theta = (obj.azimuth - 90) * (Math.PI / 180);
            const x = 50 + r * Math.cos(theta);
            const y = 50 + r * Math.sin(theta);
            const color = obj.altitude > 40 ? '#22d3ee' : '#c084fc'; // Cyan vs Purple

            return `
            <g class="group cursor-pointer" onclick="openModal('${obj.id}', '${obj.name}', '${obj.const}', '${obj.ra}', '${obj.dec}', '${Math.max(10, obj.size || 15)}')">
                <title>${obj.id} (${obj.name})</title>
                <!-- Hit Area -->
                <circle cx="${x}" cy="${y}" r="6" fill="white" opacity="0"></circle>
                <!-- Visible Dot -->
                <circle cx="${x}" cy="${y}" r="2" fill="${color}" class="transition-all duration-300 group-hover:r-[4] group-hover:fill-white drop-shadow-[0_0_5px_${color}]"></circle>
            </g>
        `;
        }).join('');

        // Generate List Items
        const listHtml = objects.map(obj => `
        <div onclick="openModal('${obj.id}', '${obj.name}', '${obj.const}', '${obj.ra}', '${obj.dec}', '${Math.max(10, obj.size || 15)}')" 
             class="group flex items-center justify-between p-3 rounded-lg hover:bg-white/5 cursor-pointer transition border border-transparent hover:border-white/5">
            <div class="flex items-center gap-3">
                 <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-400 group-hover:bg-accent-500 group-hover:text-white transition">
                    ${obj.type[0]}
                 </div>
                 <div>
                    <div class="font-bold text-slate-200 group-hover:text-accent-400 transition">${obj.id}</div>
                    <div class="text-xs text-slate-500">${obj.name}</div>
                 </div>
            </div>
            <div class="text-right">
                <div class="font-mono font-bold ${obj.altitude > 30 ? 'text-accent-400' : 'text-slate-500'}">${obj.altitude.toFixed(0)}°</div>
                <div class="text-[10px] text-slate-600">ALT</div>
            </div>
        </div>
    `).join('');

        const html = `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AstroWell (Fast)</title>
    <!-- Tailwind CSS (CDN) -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: { space: { 950: '#02040a', 900: '#0B0D17' }, accent: { 500: '#0ea5e9', 400: '#38bdf8' } },
            fontFamily: { sans: ['Inter', 'sans-serif'] }
          }
        }
      }
    </script>
    <style>
        body { background: #02040a; color: #cbd5e1; font-family: sans-serif; }
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); }
        .grid-bg { background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0); background-size: 20px 20px; }
    </style>
</head>
<body class="grid-bg min-h-screen">
    
    <!-- Header -->
    <header class="border-b border-white/10 bg-space-950/80 backdrop-blur sticky top-0 z-40">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <h1 class="font-bold text-xl text-white flex items-center gap-2">
                <span>🔭</span> <span class="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">AstroWell</span>
            </h1>
            <div class="text-xs font-mono text-slate-500">
                Moon ${moon.illumination}%
            </div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto p-4 grid lg:grid-cols-2 gap-6 mt-4">
        
        <!-- Radar -->
        <div class="glass rounded-2xl p-6 aspect-square relative flex items-center justify-center max-w-[500px] mx-auto border border-accent-500/20 shadow-[0_0_30px_rgba(14,165,233,0.1)]">
            <div class="absolute top-4 left-4 text-xs font-bold text-accent-500 tracking-widest flex items-center gap-2">
                ${ICONS.radar} LIVE SKY
            </div>
            
            <svg viewBox="0 0 100 100" class="w-full h-full">
                <!-- Grid -->
                <circle cx="50" cy="50" r="48" fill="url(#grad)" stroke="#1e293b" stroke-width="0.5" />
                <circle cx="50" cy="50" r="32" fill="none" stroke="#334155" stroke-width="0.2" stroke-dasharray="2 2" />
                <line x1="50" y1="2" x2="50" y2="98" stroke="#334155" stroke-width="0.2" />
                <line x1="2" y1="50" x2="98" y2="50" stroke="#334155" stroke-width="0.2" />
                
                <defs>
                    <radialGradient id="grad" cx="0.5" cy="0.5" r="0.5">
                        <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.1" />
                        <stop offset="100%" stop-color="#02040a" stop-opacity="0" />
                    </radialGradient>
                </defs>
                
                <!-- Dots (Server Generated) -->
                ${dotsHtml}
            </svg>

            <!-- Cardinal -->
            <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
                <span class="absolute top-2 text-[10px] text-accent-500 font-bold">N</span>
                <span class="absolute bottom-2 text-[10px] text-slate-600 font-bold">S</span>
                <span class="absolute left-2 text-[10px] text-slate-600 font-bold">W</span>
                <span class="absolute right-2 text-[10px] text-slate-600 font-bold">E</span>
            </div>
        </div>

        <!-- List -->
        <div class="glass rounded-2xl h-[600px] flex flex-col border border-white/5">
            <div class="p-4 border-b border-white/5 bg-white/5 font-bold text-lg text-white">Top Targets</div>
            <div class="overflow-y-auto flex-1 p-2 space-y-1">
                ${listHtml}
            </div>
        </div>
    </main>

    <!-- Modal (Hidden by default) -->
    <div id="modal" class="fixed inset-0 z-50 hidden flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 opacity-0 transition-opacity duration-200">
        <div id="modalContent" class="bg-space-900 border border-white/10 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden relative transform scale-95 transition-transform duration-200">
            <!-- Header -->
            <div class="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                    <h2 id="mTitle" class="text-xl font-bold text-white">Title</h2>
                    <p id="mSub" class="text-xs text-slate-400">Subtitle</p>
                </div>
                <button onclick="closeModal()" class="p-2 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white">
                    ${ICONS.close}
                </button>
            </div>
            
            <!-- Viewer -->
            <div class="aspect-square bg-black relative flex items-center justify-center">
                <div id="mLoader" class="absolute inset-0 flex items-center justify-center">
                     <div class="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <img id="mImg" src="" class="w-full h-full object-contain opacity-0 transition-opacity duration-500" onload="this.style.opacity=1; document.getElementById('mLoader').style.display='none'">
                
                <!-- Reticle -->
                <div class="absolute inset-0 pointer-events-none opacity-60">
                    <div class="absolute top-1/2 left-4 right-4 h-[1px] bg-green-500/50"></div>
                    <div class="absolute left-1/2 top-4 bottom-4 w-[1px] bg-green-500/50"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function openModal(id, name, constellation, ra, dec, size) {
            const m = document.getElementById('modal');
            const mc = document.getElementById('modalContent');
            const img = document.getElementById('mImg');
            const loader = document.getElementById('mLoader');

            // Set Content
            document.getElementById('mTitle').innerText = id;
            document.getElementById('mSub').innerText = name + ' • ' + constellation;
            
            // Reset Image
            img.style.opacity = '0';
            img.src = '';
            loader.style.display = 'flex';
            
            // URL
            const url = \`https://server.dss.stsci.edu/product?task=thumb&r=\${ra}&d=\${dec}&w=\${size}&h=\${size}&f=gif\`;
            
            // Delay load slightly for anim
            setTimeout(() => { img.src = url; }, 50);

            // Show
            m.classList.remove('hidden');
            // Reflow
            void m.offsetWidth;
            m.classList.remove('opacity-0');
            mc.classList.remove('scale-95');
        }

        function closeModal() {
            const m = document.getElementById('modal');
            const mc = document.getElementById('modalContent');
            
            m.classList.add('opacity-0');
            mc.classList.add('scale-95');
            
            setTimeout(() => {
                m.classList.add('hidden');
            }, 200);
        }

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
        document.getElementById('modal').addEventListener('click', (e) => {
            if(e.target === document.getElementById('modal')) closeModal();
        });
    </script>
</body>
</html>
    `;

        return new Response(html, { headers: { "Content-Type": "text/html" } });
    }
};
