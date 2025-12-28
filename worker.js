import { catalog } from './catalog.js';

/* --- Astronomy Math (Server Side) --- */
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function toRad(deg) { return deg * DEG2RAD; }
function toDeg(rad) { return rad * RAD2DEG; }

function getJulianDate(date) {
    return (date.getTime() / 86400000) + 2440587.5;
}

function getLST(date, lon) {
    const jd = getJulianDate(date);
    const d = jd - 2451545.0;
    let gmst = 280.46061837 + 360.98564736629 * d;
    gmst %= 360;
    if (gmst < 0) gmst += 360;
    let lst = gmst + lon;
    lst %= 360;
    if (lst < 0) lst += 360;
    return lst;
}

function getAltAz(ra, dec, lat, lon, date) {
    const lst = getLST(date, lon);
    const ha = lst - ra;
    const haRad = toRad(ha);
    const decRad = toRad(dec);
    const latRad = toRad(lat);
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
    const altRad = Math.asin(sinAlt);
    const alt = toDeg(altRad);
    const cosAz = (Math.sin(decRad) - Math.sin(altRad) * Math.sin(latRad)) / (Math.cos(altRad) * Math.cos(latRad));
    const cosAzClamped = Math.min(1, Math.max(-1, cosAz));
    let azRad = Math.acos(cosAzClamped);
    if (Math.sin(haRad) > 0) azRad = 2 * Math.PI - azRad;
    const az = toDeg(azRad);
    return { alt, az };
}

function getMoonData(date) {
    const jd = getJulianDate(date);
    const d = jd - 2444238.5;
    const phaseRaw = (d / 29.530588853) % 1;
    const illum = 0.5 * (1 - Math.cos(phaseRaw * 2 * Math.PI));
    return {
        illumination: Math.round(illum * 100),
        phase: phaseRaw,
        ra: 0, dec: 0 // Simplified for server-side speed if avoidance not critical
    };
}
/* ----------------------------------- */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Default Params
        let lat = 42.69;
        let lon = 23.32;
        let date = new Date();
        let bortle = 4;

        // Handle POST (Form Submit)
        if (request.method === "POST") {
            const formData = await request.formData();
            lat = parseFloat(formData.get("latitude")) || lat;
            lon = parseFloat(formData.get("longitude")) || lon;
            const dStr = formData.get("datetime");
            if (dStr) date = new Date(dStr);
            bortle = parseInt(formData.get("bortle")) || bortle;
        }

        // Calculate Data Server-Side
        const moon = getMoonData(date);

        // Process Catalog
        const objects = catalog.map(obj => {
            const pos = getAltAz(obj.ra, obj.dec, lat, lon, date);

            let score = 0;
            if (pos.alt > 0) {
                let altScore = (pos.alt > 30) ? 50 : (pos.alt / 30) * 50;
                const magScore = Math.max(0, 50 - (obj.mag * 5));
                score = Math.max(0, altScore + magScore - (bortle * 2));
            }

            return {
                ...obj,
                altitude: pos.alt,
                azimuth: pos.az,
                score: score
            };
        }).sort((a, b) => b.score - a.score);

        // Render
        return new Response(renderPage(objects, moon, lat, lon, date, bortle), {
            headers: { "Content-Type": "text/html" }
        });
    },
};

function renderPage(objects, moon, lat, lon, date, bortle) {
    const dateStr = date.toISOString().slice(0, 16);

    // Generate Rows
    const rows = objects.map(obj => `
        <tr class="border-b border-white/5 hover:bg-white/5 transition">
            <td class="p-3 font-semibold text-blue-300 text-sm whitespace-nowrap">${obj.id}</td>
            <td class="p-3">
                <div class="text-sm font-medium text-slate-200">${obj.name}</div>
                <div class="text-xs text-slate-500">${obj.type} • ${obj.const}</div>
            </td>
            <td class="p-3 text-center">
                 <div class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${obj.altitude > 30 ? 'bg-green-500/20 text-green-400' : (obj.altitude > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-500')}">
                    ${obj.altitude.toFixed(0)}°
                 </div>
                 <div class="text-[10px] text-slate-500 mt-1">Az: ${obj.azimuth.toFixed(0)}°</div>
            </td>
             <td class="p-3 text-center">
                 <div class="flex items-center gap-2">
                    <div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-blue-600 to-indigo-500" style="width: ${Math.min(100, obj.score)}%"></div>
                    </div>
                    <span class="text-xs font-mono text-slate-400 w-6">${obj.score.toFixed(0)}</span>
                 </div>
            </td>
            <td class="p-3 text-right">
                <a href="https://server.dss.stsci.edu/product?task=thumb&r=${obj.ra}&d=${obj.dec}&w=${obj.size || 15}&h=${obj.size || 15}&f=gif" target="_blank" class="text-xs border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-slate-300 transition">View</a>
            </td>
        </tr>
    `).join('');

    // Generate Radar Dots (Server-Side!)
    const radarDots = objects.filter(o => o.altitude > 0).map(obj => {
        // Polar to XY
        // r = 48 * (90 - alt) / 90
        const r = 48 * (90 - obj.altitude) / 90;
        const theta = (obj.azimuth - 90) * (Math.PI / 180);
        const x = 50 + r * Math.cos(theta);
        const y = 50 + r * Math.sin(theta);
        const color = obj.altitude > 30 ? '#4ade80' : '#facc15';

        return `<circle cx="${x}" cy="${y}" r="2" fill="${color}" fill-opacity="0.8" style="cursor:help"><title>${obj.id}</title></circle>`;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AstroImage Well V2</title>
    <!-- Tailwind via CDN (Reliable) -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              space: { 900: '#0B0D17', 800: '#151932' },
              accent: { 500: '#6366F1' }
            }
          }
        }
      }
    </script>
    <style>
      body { background-color: #0B0D17; color: #E2E8F0; font-family: sans-serif; }
      .glass { background: rgba(21, 25, 50, 0.6); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.08); }
    </style>
</head>
<body class="min-h-screen bg-[url('https://images.unsplash.com/photo-1534796636912-3b95b3ab5980?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-fixed bg-center">
    <!-- Overlay -->
    <div class="fixed inset-0 bg-space-900/90 backdrop-blur-sm"></div>

    <div class="relative z-10 max-w-7xl mx-auto p-4 flex flex-col lg:flex-row gap-6">
        
        <!-- Sidebar Controls -->
        <div class="lg:w-80 flex-shrink-0 space-y-4">
             <div class="glass p-6 rounded-2xl shadow-xl">
                <h1 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 mb-6">AstroImage Well</h1>
                
                <form method="POST" class="space-y-4">
                    <div>
                        <label class="text-xs uppercase text-slate-500 font-bold tracking-wider">Your Coords</label>
                        <div class="flex gap-2 mt-1">
                            <input type="text" name="latitude" value="${lat}" class="w-full bg-space-800 border border-white/10 rounded px-3 py-2 text-sm focus:border-accent-500 outline-none">
                            <input type="text" name="longitude" value="${lon}" class="w-full bg-space-800 border border-white/10 rounded px-3 py-2 text-sm focus:border-accent-500 outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="text-xs uppercase text-slate-500 font-bold tracking-wider">Date/Time</label>
                        <input type="datetime-local" name="datetime" value="${dateStr}" class="mt-1 w-full bg-space-800 border border-white/10 rounded px-3 py-2 text-white text-sm scheme-dark">
                    </div>
                    <div>
                        <label class="text-xs uppercase text-slate-500 font-bold tracking-wider">Bortle Class: <span class="text-white">${bortle}</span></label>
                        <input type="range" name="bortle" min="1" max="9" value="${bortle}" class="w-full mt-1 h-2 bg-space-800 rounded-lg appearance-none cursor-pointer accent-accent-500">
                    </div>
                    <button type="submit" class="w-full py-3 bg-accent-500 hover:bg-indigo-600 rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition transform active:scale-95">
                        Refresh Sky 🚀
                    </button>
                    <button type="button" onclick="window.print()" class="w-full py-2 bg-space-800 border border-white/10 hover:bg-white/5 rounded-lg text-sm font-medium transition">
                        Print Plan 🖨️
                    </button>
                </form>
             </div>

             <!-- Moon & Status -->
             <div class="glass p-5 rounded-2xl flex items-center justify-between">
                <div>
                    <div class="text-xs text-slate-500 uppercase font-bold">Moon Illum</div>
                    <div class="text-2xl font-bold text-slate-200">${moon.illumination}%</div>
                </div>
                <div class="text-4xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                    ${moon.illumination < 10 ? '🌑' : moon.illumination < 50 ? '🌘' : '🌕'}
                </div>
             </div>
        </div>

        <!-- Main Content (Grid 2/3) -->
        <div class="flex-1 space-y-6">
            
            <!-- Radar Map -->
            <div class="glass rounded-2xl p-1 relative overflow-hidden group">
                <div class="absolute top-3 left-4 text-xs font-bold text-slate-500 uppercase z-10">Live Sky Radar (Zenith Center)</div>
                <div class="flex justify-center p-4">
                    <svg viewBox="0 0 100 100" class="w-[300px] h-[300px] lg:w-[400px] lg:h-[400px]">
                        <!-- Grid -->
                        <circle cx="50" cy="50" r="48" fill="#0f172a" stroke="#1e293b" stroke-width="0.5"></circle>
                        <circle cx="50" cy="50" r="32" fill="none" stroke="#1e293b" stroke-width="0.2" stroke-dasharray="2 2"></circle>
                        <circle cx="50" cy="50" r="16" fill="none" stroke="#1e293b" stroke-width="0.2" stroke-dasharray="2 2"></circle>
                        <line x1="50" y1="2" x2="50" y2="98" stroke="#1e293b" stroke-width="0.2"></line>
                        <line x1="2" y1="50" x2="98" y2="50" stroke="#1e293b" stroke-width="0.2"></line>
                        <!-- Labels -->
                        <text x="50" y="6" text-anchor="middle" font-size="3" fill="#64748b">N</text>
                        <text x="96" y="51" text-anchor="middle" font-size="3" fill="#64748b">E</text>
                        <text x="50" y="98" text-anchor="middle" font-size="3" fill="#64748b">S</text>
                        <text x="4" y="51" text-anchor="middle" font-size="3" fill="#64748b">W</text>
                        
                        <!-- Dynamic Dots -->
                        ${radarDots}
                    </svg>
                </div>
            </div>

            <!-- List -->
            <div class="glass rounded-2xl overflow-hidden">
                <div class="px-4 py-3 bg-white/5 border-b border-white/5 flex justify-between items-center">
                    <h3 class="font-bold text-slate-300">Top Targets</h3>
                    <span class="text-xs text-slate-500">${objects.length} Objects found</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-black/20 text-xs uppercase text-slate-400 font-semibold tracking-wider">
                            <tr>
                                <th class="p-3">ID</th>
                                <th class="p-3">Object Info</th>
                                <th class="p-3 text-center">Position</th>
                                <th class="p-3 text-center w-24">Score</th>
                                <th class="p-3 text-right">DSS</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
            
        </div>
    </div>
</body>
</html>
    `;
}
