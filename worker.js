
import { catalog } from './catalog.js';

// --- Server-Side Astronomy Logic (Keep this fast logic here) ---
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

// --- Worker Handler ---
export default {
    async fetch(request, env, ctx) {
        // 1. Calculate Initial State on Server
        let lat = 42.69, lon = 23.32, date = new Date(), bortle = 4;
        // (Parse URL params if needed in future for sharing links)

        const moon = getMoonData(date);
        const objects = catalog.map(obj => {
            const pos = getAltAz(obj.ra, obj.dec, lat, lon, date);
            // Simple scoring
            let score = (pos.alt > 0) ? (pos.alt / 90 * 50) + (Math.max(0, 15 - obj.mag) * 3) : 0;
            return { ...obj, altitude: pos.alt, azimuth: pos.az, score };
        }).filter(o => o.altitude > -10).sort((a, b) => b.score - a.score); // Keep some below horizon for context? Nah, filtering cleans list.

        // 2. Serve the SPA Shell
        const html = `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AstroWell Pro (React/Preact)</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: { space: { 950: '#02040a', 900: '#0B0D17', 800: '#151932' }, accent: { 500: '#0ea5e9' } },
                    fontFamily: { sans: ['Inter', 'sans-serif'] }
                }
            }
        }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        body { background: #02040a; color: #e2e8f0; font-family: 'Inter', sans-serif; }
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.05); }
        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #02040a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
    </style>
</head>
<body>
    <div id="app"></div>

    <!-- Import Map for Preact & HTM -->
    <script type="importmap">
    {
        "imports": {
            "preact": "https://esm.sh/preact@10.19.2",
            "preact/hooks": "https://esm.sh/preact@10.19.2/hooks",
            "htm/preact": "https://esm.sh/htm@3.1.5/preact",
            "lucide-react": "https://esm.sh/lucide-react@0.294.0"
        }
    }
    </script>

    <!-- App Logic -->
    <script type="module">
        import { h, render } from 'preact';
        import { useState, useEffect, useMemo } from 'preact/hooks';
        import { html } from 'htm/preact';
        import { Radar, Disc, Info, X, MapPin } from 'lucide-react';

        // --- Data injected from Server ---
        const INITIAL_DATA = ${JSON.stringify(objects)};
        const INITIAL_MOON = ${JSON.stringify(moon)};
        const INITIAL_COORDS = { lat: ${lat}, lon: ${lon} };

        // --- Components ---

        function Modal({ isOpen, onClose, object }) {
            if (!isOpen || !object) return null;
            
            const size = object.size || 15;
            const dssUrl = \`https://server.dss.stsci.edu/product?task=thumb&r=\${object.ra}&d=\${object.dec}&w=\${size}&h=\${size}&f=gif\`;

            // State for image loading
            const [status, setStatus] = useState('loading'); // loading, success, error

            return html\`
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick=\${onClose}>
                    <div class="bg-space-900 border border-white/10 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden relative animate-[scale-in_0.2s_ease-out]" onClick=\${e => e.stopPropagation()}>
                        
                        <!-- Header -->
                        <div class="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                                <h2 class="text-xl font-bold text-white">\${object.id}</h2>
                                <p class="text-xs text-slate-400">\${object.name} • \${object.const}</p>
                            </div>
                            <button onClick=\${onClose} class="p-2 hover:bg-white/10 rounded-full transition"><\${X} size=\${20} /></button>
                        </div>

                        <!-- Viewer -->
                        <div class="aspect-square bg-black relative flex items-center justify-center group">
                             
                             \${status === 'loading' && html\`
                                <div class="absolute inset-0 flex items-center justify-center">
                                    <div class="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                             \`}

                             \${status === 'error' && html\`
                                <div class="text-red-400 text-sm flex flex-col items-center">
                                    <span class="text-2xl mb-2">⚠️</span>
                                    <span>DSS Image Unavailable</span>
                                    <a href="http://wikisky.org/?object=\${object.id}" target="_blank" class="mt-2 text-accent-500 underline">Try WikiSky</a>
                                </div>
                             \`}

                             <img 
                                src=\${dssUrl} 
                                class="w-full h-full object-contain transition-opacity duration-500 \${status === 'loading' ? 'opacity-0' : 'opacity-100'}"
                                onLoad=\${() => setStatus('success')}
                                onError=\${() => setStatus('error')}
                             />

                             <!-- Reticle Overlay -->
                             <div class="absolute inset-0 pointer-events-none opacity-60">
                                <div class="absolute top-1/2 left-4 right-4 h-[1px] bg-green-500/50"></div>
                                <div class="absolute left-1/2 top-4 bottom-4 w-[1px] bg-green-500/50"></div>
                                <div class="absolute inset-1/4 border border-green-500/30 rounded-full"></div>
                             </div>
                        </div>

                        <!-- Footer -->
                        <div class="p-4 bg-space-950 text-xs text-slate-500 text-center">
                            RA: \${object.ra.toFixed(4)} | DEC: \${object.dec.toFixed(4)} | Mag: \${object.mag}
                        </div>
                    </div>
                </div>
            \`;
        }

        function RadarMap({ objects, onSelect }) {
            // Filter only positive altitude
            const visible = useMemo(() => objects.filter(o => o.altitude > 0), [objects]);
            
            // Hover State
            const [hovered, setHovered] = useState(null);

            return html\`
                <div class="glass rounded-2xl p-6 relative aspect-square max-w-[500px] mx-auto overflow-hidden group">
                    <div class="absolute top-4 left-4 text-xs font-bold text-accent-500 tracking-widest flex items-center gap-2">
                        <\${Radar} size=\${14} /> LIVE RADAR
                    </div>

                    <svg viewBox="0 0 100 100" class="w-full h-full">
                        <!-- Grid -->
                        <circle cx="50" cy="50" r="48" fill="url(#grad)" stroke="#1e293b" stroke-width="0.5" />
                        <circle cx="50" cy="50" r="32" fill="none" stroke="#334155" stroke-width="0.2" stroke-dasharray="2 2" />
                        <circle cx="50" cy="50" r="16" fill="none" stroke="#334155" stroke-width="0.2" stroke-dasharray="2 2" />
                        <line x1="50" y1="2" x2="50" y2="98" stroke="#334155" stroke-width="0.2" />
                        <line x1="2" y1="50" x2="98" y2="50" stroke="#334155" stroke-width="0.2" />
                        
                        <defs>
                            <radialGradient id="grad" cx="0.5" cy="0.5" r="0.5">
                                <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.1" />
                                <stop offset="100%" stop-color="#02040a" stop-opacity="0" />
                            </radialGradient>
                        </defs>

                        <!-- Objects -->
                        \${visible.map(obj => {
                            const r = 48 * (90 - obj.altitude) / 90;
                            const theta = (obj.azimuth - 90) * (Math.PI / 180);
                            const x = 50 + r * Math.cos(theta);
                            const y = 50 + r * Math.sin(theta);
                            
                            const isHovered = hovered === obj.id;
                            const color = obj.altitude > 40 ? '#22d3ee' : '#c084fc';

                            return html\`
                                <g 
                                    key=\${obj.id} 
                                    onClick=\${() => onSelect(obj)}
                                    onMouseEnter=\${() => setHovered(obj.id)}
                                    onMouseLeave=\${() => setHovered(null)}
                                    class="cursor-pointer"
                                >
                                    <!-- Hit Area (Invisible) -->
                                    <circle cx=\${x} cy=\${y} r="6" fill="transparent" />
                                    
                                    <!-- Dot -->
                                    <circle 
                                        cx=\${x} cy=\${y} 
                                        r=\${isHovered ? 3 : 1.5} 
                                        fill=\${color} 
                                        class="transition-all duration-300 \${isHovered ? 'drop-shadow-[0_0_8px_white]' : ''}" 
                                    />
                                    
                                    <!-- Tooltip (SVG Based, simple) -->
                                    \${isHovered && html\`
                                        <g pointer-events="none">
                                            <rect x=\${x - 20} y=\${y - 12} width="40" height="8" rx="2" fill="#0f172a" fill-opacity="0.9" />
                                            <text x=\${x} y=\${y - 7} text-anchor="middle" font-size="3" fill="white" font-weight="bold">\${obj.id}</text>
                                        </g>
                                    \`}
                                </g>
                            \`;
                        })}
                    </svg>
                    
                    <div class="absolute bottom-2 text-[10px] text-slate-500 w-full text-center">Center=Zenith • Edge=Horizon</div>
                </div>
            \`;
        }

        function App() {
            const [objects] = useState(INITIAL_DATA);
            const [selectedObj, setSelectedObj] = useState(null);

            return html\`
                <div class="min-h-screen pb-10">
                    <!-- Navbar -->
                    <nav class="border-b border-white/5 bg-space-950/80 backdrop-blur sticky top-0 z-40">
                        <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                            <h1 class="font-bold text-xl tracking-wide flex items-center gap-2">
                                <span class="text-2xl">🔭</span> AstroWell <span class="bg-accent-500/10 text-accent-500 px-2 py-0.5 rounded text-xs">ULTIMATE</span>
                            </h1>
                            <div class="text-xs font-mono text-slate-500 flex gap-4">
                                <span>Lat: \${INITIAL_COORDS.lat}</span>
                                <span>Moon: \${INITIAL_MOON.illumination}%</span>
                            </div>
                        </div>
                    </nav>

                    <!-- Content -->
                    <main class="max-w-7xl mx-auto p-6 grid lg:grid-cols-2 gap-8 mt-4">
                        
                        <!-- Col 1: Radar -->
                        <div class="space-y-6">
                            <\${RadarMap} objects=\${objects} onSelect=\${setSelectedObj} />
                            
                            <div class="glass rounded-xl p-4 text-sm text-slate-400">
                                <h3 class="font-bold text-white mb-2 flex items-center gap-2"><\${Info} size=\${16} /> Guide</h3>
                                <p>Points represent deep sky objects. Closer to center = Higher in sky (Better visibility). Blue dots are high altitude targets.</p>
                            </div>
                        </div>

                        <!-- Col 2: List -->
                        <div class="glass rounded-2xl overflow-hidden h-[600px] flex flex-col">
                            <div class="p-4 border-b border-white/5 bg-white/5 font-bold text-lg">Top Targets</div>
                            <div class="overflow-y-auto flex-1 p-2 space-y-1">
                                \${objects.map(obj => html\`
                                    <div 
                                        key=\${obj.id}
                                        onClick=\${() => setSelectedObj(obj)}
                                        class="p-3 rounded-lg hover:bg-white/5 transition cursor-pointer flex justify-between items-center group"
                                    >
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs group-hover:bg-accent-500 group-hover:text-white transition">
                                                \${obj.type.substring(0,1)}
                                            </div>
                                            <div>
                                                <div class="font-bold text-slate-200">\${obj.id}</div>
                                                <div class="text-xs text-slate-500">\${obj.name}</div>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="font-mono font-bold \${obj.altitude > 30 ? 'text-accent-500' : 'text-slate-400'}">\${obj.altitude.toFixed(0)}°</div>
                                            <div class="text-[10px] text-slate-600">ALT</div>
                                        </div>
                                    </div>
                                \`)}
                            </div>
                        </div>
                    </main>

                    <!-- Modal -->
                    <\${Modal} 
                        isOpen=\${!!selectedObj} 
                        onClose=\${() => setSelectedObj(null)} 
                        object=\${selectedObj} 
                    />
                </div>
            \`;
        }

        render(html\`<\${App} />\`, document.getElementById('app'));
    </script>
</body>
</html>
    `;

        return new Response(html, { headers: { "Content-Type": "text/html" } });
    }
};
