import { catalog } from './catalog.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // API Endpoint for raw data (optional, but good practice)
        if (url.pathname === "/api/catalog") {
            return new Response(JSON.stringify(catalog), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // Serve the Single Page App (SPA)
        return new Response(renderApp(catalog), {
            headers: { "Content-Type": "text/html" },
        });
    },
};

// The "Mega" SPA Shell
function renderApp(catalogData) {
    const catalogJSON = JSON.stringify(catalogData);

    return `<!-- AstroImage Well 2.0 - Professional Client-Side Planner -->
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AstroImage Well Pro</title>
    
    <!-- Design System -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              space: { 900: '#0B0D17', 800: '#151932', 700: '#2A2F55' },
              accent: { 400: '#6366F1', 500: '#4F46E5' },
              success: '#10B981',
              warning: '#F59E0B',
              danger: '#EF4444'
            },
            fontFamily: { sans: ['Inter', 'sans-serif'] }
          }
        }
      }
    </script>
    <style>
      body { background-color: #0B0D17; color: #E2E8F0; }
      .glass-panel { background: rgba(21, 25, 50, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); }
      .scroll-hide::-webkit-scrollbar { display: none; }
      .radar-grid { stroke: #334155; stroke-dasharray: 4 4; fill: none; }
      [v-cloak] { display: none; }
    </style>
    
    <!-- Libraries -->
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
    <script src="https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div id="app" v-cloak class="min-h-screen flex flex-col">
        
        <!-- Navbar -->
        <nav class="border-b border-white/10 bg-space-900/80 backdrop-blur sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">🔭</span>
                    <h1 class="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">AstroImage Well <span class="text-xs uppercase px-2 py-0.5 rounded bg-accent-500/20 text-accent-400 border border-accent-500/30">Pro</span></h1>
                </div>
                <div class="flex items-center gap-4">
                     <button @click="toggleNightMode" :class="nightMode ? 'text-red-500' : 'text-slate-400 hover:text-white'">
                        Use Night Mode <span class="ml-1">👁️</span>
                     </button>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <main class="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <!-- Left Sidebar: Controls (Col 1-3) -->
            <aside class="lg:col-span-3 space-y-6">
                <!-- Location & Time -->
                <div class="glass-panel p-5 rounded-xl space-y-4">
                    <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">My Observatory</h2>
                    
                    <div class="space-y-2">
                        <label class="text-sm text-slate-300">Coordinates</label>
                        <div class="flex gap-2">
                            <input v-model.number="lat" type="number" step="0.01" class="w-full bg-space-900 border border-white/10 rounded px-3 py-2 text-sm focus:border-accent-500 outline-none" placeholder="Lat">
                            <input v-model.number="lon" type="number" step="0.01" class="w-full bg-space-900 border border-white/10 rounded px-3 py-2 text-sm focus:border-accent-500 outline-none" placeholder="Lon">
                        </div>
                        <button @click="useGPS" class="text-xs text-accent-400 hover:text-accent-500 flex items-center gap-1">
                            📍 Detect My Location
                        </button>
                    </div>

                    <div class="space-y-2">
                        <label class="text-sm text-slate-300">Date & Time</label>
                        <input v-model="dateStr" type="datetime-local" class="w-full bg-space-900 border border-white/10 rounded px-3 py-2 text-sm text-white scheme-dark focus:border-accent-500 outline-none">
                    </div>

                    <div class="space-y-2">
                        <label class="text-sm text-slate-300">Bortle (Sky Quality)</label>
                         <input v-model.number="bortle" type="range" min="1" max="9" class="w-full h-2 bg-space-900 rounded-lg appearance-none cursor-pointer accent-accent-500">
                         <div class="flex justify-between text-xs text-slate-500">
                            <span>1 (Exc)</span>
                            <span class="text-white font-bold">{{ bortle }}</span>
                            <span>9 (Bad)</span>
                         </div>
                    </div>
                </div>

                <!-- Moon Status -->
                <div class="glass-panel p-5 rounded-xl text-center relative overflow-hidden group">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
                    <div class="relative z-10">
                         <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Moon Phase</h3>
                         <div class="text-4xl mb-1">{{ moonEmoji }}</div>
                         <div class="text-2xl font-bold text-white">{{ moonIllumination }}%</div>
                         <div class="text-xs" :class="moonIsUp ? 'text-green-400' : 'text-slate-500'">
                            {{ moonIsUp ? 'Currently UP' : 'Currently DOWN' }}
                         </div>
                    </div>
                </div>
            </aside>

            <!-- Center: Dashboard aka Sky Map (Col 4-12) -->
            <section class="lg:col-span-9 space-y-6">
                
                <!-- Targets Table / Dashboard Switcher -->
                <div class="glass-panel rounded-xl overflow-hidden flex flex-col h-[700px]">
                    <div class="p-4 border-b border-white/10 flex items-center justify-between bg-space-800/50">
                        <div class="flex gap-4">
                             <button @click="viewMode = 'list'" class="px-3 py-1.5 rounded text-sm font-medium transition" :class="viewMode === 'list' ? 'bg-accent-500 text-white' : 'text-slate-400 hover:text-white'">Target List</button>
                             <button @click="viewMode = 'radar'" class="px-3 py-1.5 rounded text-sm font-medium transition" :class="viewMode === 'radar' ? 'bg-accent-500 text-white' : 'text-slate-400 hover:text-white'">Radar Map</button>
                        </div>
                        <input v-model="searchQuery" type="text" placeholder="Search objects..." class="bg-space-900 border border-white/10 rounded px-3 py-1.5 text-sm focus:border-accent-500 outline-none w-64">
                    </div>
                    
                    <!-- View: List -->
                    <div v-if="viewMode === 'list'" class="flex-1 overflow-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-space-900 sticky top-0 z-10 text-xs uppercase text-slate-400 font-semibold tracking-wider">
                                <tr>
                                    <th class="p-3">Object</th>
                                    <th class="p-3">Type</th>
                                    <th class="p-3">Constellation</th>
                                    <th class="p-3 text-right">Mag</th>
                                    <th class="p-3 text-center">Altitude</th>
                                    <th class="p-3 text-center">Score</th>
                                    <th class="p-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-white/5">
                                <tr v-for="obj in sortedObjects" :key="obj.id" class="hover:bg-white/5 transition group">
                                    <td class="p-3 font-medium text-white">{{ obj.id }} <span class="text-slate-500 ml-1 text-xs group-hover:text-slate-300">{{ obj.name }}</span></td>
                                    <td class="p-3 text-sm text-slate-400">{{ obj.type }}</td>
                                    <td class="p-3 text-sm text-slate-400">{{ obj.const }}</td>
                                    <td class="p-3 text-right text-sm font-mono text-slate-300">{{ obj.mag }}</td>
                                    <td class="p-3 text-center">
                                        <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold" 
                                             :class="obj.altitude > 30 ? 'bg-success/20 text-success' : obj.altitude > 0 ? 'bg-warning/20 text-warning' : 'bg-space-900 text-slate-600'">
                                            {{ obj.altitude.toFixed(0) }}°
                                        </div>
                                    </td>
                                    <td class="p-3 text-center">
                                         <div class="w-full bg-space-900 rounded-full h-1.5 mt-1 overflow-hidden">
                                            <div class="h-full bg-gradient-to-r from-blue-500 to-accent-500" :style="{ width: Math.min(100, obj.score) + '%' }"></div>
                                         </div>
                                         <div class="text-[10px] text-slate-500 mt-0.5">{{ obj.score.toFixed(0) }}/100</div>
                                    </td>
                                    <td class="p-3 text-center">
                                        <button @click="openSimulator(obj)" class="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded text-slate-300">
                                            🔭 Sim
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- View: Radar -->
                    <div v-else class="flex-1 flex items-center justify-center relative p-10">
                        <div class="relative w-[500px] h-[500px]">
                            <!-- Radar Background -->
                            <svg viewBox="0 0 100 100" class="w-full h-full absolute inset-0 select-none">
                                <circle cx="50" cy="50" r="48" class="stroke-slate-700 fill-space-900" stroke-width="0.5"></circle>
                                <circle cx="50" cy="50" r="32" class="radar-grid" stroke-width="0.2"></circle> <!-- 30 deg -->
                                <circle cx="50" cy="50" r="16" class="radar-grid" stroke-width="0.2"></circle> <!-- 60 deg -->
                                <line x1="50" y1="2" x2="50" y2="98" class="radar-grid" stroke-width="0.2"></line>
                                <line x1="2" y1="50" x2="98" y2="50" class="radar-grid" stroke-width="0.2"></line>
                                <text x="50" y="5" text-anchor="middle" class="text-[3px] fill-slate-500 font-mono">N</text>
                                <text x="96" y="51" text-anchor="middle" class="text-[3px] fill-slate-500 font-mono">E</text>
                                <text x="50" y="99" text-anchor="middle" class="text-[3px] fill-slate-500 font-mono">S</text>
                                <text x="4" y="51" text-anchor="middle" class="text-[3px] fill-slate-500 font-mono">W</text>
                            </svg>
                            
                            <!-- Objects -->
                            <div v-for="obj in visibleObjects" :key="obj.id"
                                 class="absolute w-2 h-2 -ml-1 -mt-1 rounded-full cursor-pointer hover:scale-150 transition z-10"
                                 :class="obj.altitude > 30 ? 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-warning opacity-70'"
                                 :style="getRadarStyle(obj)"
                                 :title="obj.id">
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
        
        <!-- Modal: Simulator -->
        <div v-if="selectedObject" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" @click.self="selectedObject = null">
            <div class="glass-panel w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div class="p-4 border-b border-white/10 flex justify-between items-center bg-space-800">
                    <h3 class="font-bold text-lg text-white">Target Simulator: {{ selectedObject.id }}</h3>
                     <button @click="selectedObject = null" class="text-slate-400 hover:text-white">✕</button>
                </div>
                <div class="flex-1 overflow-auto bg-black relative flex items-center justify-center p-10">
                    <!-- DSS Image Placeholer Logic -->
                    <div class="relative border-2 border-dashed border-slate-700 w-[500px] h-[500px] flex items-center justify-center bg-space-900 group">
                        <img :src="getDSSUrl(selectedObject)" class="absolute inset-0 w-full h-full object-cover opacity-80" alt="DSS Preview" @error="imageError = true">
                         <div class="absolute inset-0 border border-success/50 border-2 w-1/2 h-1/2 m-auto pointer-events-none" title="Simulated FOV"></div>
                         <span class="absolute top-2 left-2 text-xs bg-black/50 px-2 py-1 rounded text-success font-mono">Simulated Field</span>
                    </div>
                </div>
                <div class="p-4 bg-space-900 border-t border-white/10 text-sm text-slate-400">
                    Loading imagery from STScI DSS Service. The green rectangle represents your sensor (approx).
                </div>
            </div>
        </div>

    </div>

    <!-- Client-Side Catalog Data -->
    <script>
        window.CATALOG_DATA = ${catalogJSON};
    </script>

    <!-- Main Vue App Logic -->
    <script>
        const { createApp, ref, computed, onMounted, watch } = Vue;

        createApp({
            setup() {
                // State
                const catalog = ref(window.CATALOG_DATA);
                const lat = ref(42.69);
                const lon = ref(23.32);
                const dateStr = ref(new Date().toISOString().slice(0, 16));
                const bortle = ref(4);
                const viewMode = ref('list'); // 'list' or 'radar'
                const searchQuery = ref("");
                const nightMode = ref(false);
                const selectedObject = ref(null);
                
                // Computed Astronomy
                const observer = computed(() => new Astronomy.Observer(lat.value, lon.value, 0));
                const date = computed(() => new Date(dateStr.value));
                
                const moonData = computed(() => {
                    const phase = Astronomy.MoonPhase(date.value);
                    const pos = Astronomy.MoonPosition(date.value);
                    const hor = Astronomy.Horizon(date.value, observer.value, pos.ra, pos.dec, 'normal');
                    return {
                        phase,
                        illumination: Math.round(getIllumination(phase) * 100),
                        altitude: hor.altitude,
                        isUp: hor.altitude > 0
                    };
                });
                
                const processedObjects = computed(() => {
                    return catalog.value.map(obj => {
                        const hor = Astronomy.Horizon(date.value, observer.value, obj.ra, obj.dec, 'normal');
                        
                        // Scoring
                        let score = 0;
                        if (hor.altitude > 0) {
                            let altScore = (hor.altitude > 30) ? 50 : (hor.altitude / 30) * 50;
                            const moonP = moonData.value.isUp ? 20 * (moonData.value.illumination/100) : 0; 
                            const magScore = Math.max(0, 50 - (obj.mag * 5));
                            score = Math.max(0, altScore + magScore - moonP - (bortle.value * 2));
                        }
                        
                        return {
                            ...obj,
                            altitude: hor.altitude,
                            azimuth: hor.azimuth,
                            score: score
                        };
                    });
                });
                
                const sortedObjects = computed(() => {
                    let items = processedObjects.value.filter(o => 
                        o.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                        o.id.toLowerCase().includes(searchQuery.value.toLowerCase())
                    );
                    return items.sort((a, b) => b.score - a.score);
                });
                
                const visibleObjects = computed(() => processedObjects.value.filter(o => o.altitude > 0));

                const moonIsUp = computed(() => moonData.value.isUp);
                const moonIllumination = computed(() => moonData.value.illumination);
                const moonEmoji = computed(() => {
                    const p = moonData.value.phase; // 0..360
                    if (p < 45) return '🌑';
                    if (p < 90) return '🌒';
                    if (p < 135) return '🌓';
                    if (p < 180) return '🌔';
                    if (p < 225) return '🌕';
                    if (p < 270) return '🌖';
                    if (p < 315) return '🌗';
                    return '🌘';
                });

                // Methods
                function getIllumination(phase) {
                    const rad = phase * (Math.PI / 180);
                    return 0.5 * (1 - Math.cos(rad));
                }
                
                function useGPS() {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(pos => {
                            lat.value = parseFloat(pos.coords.latitude.toFixed(4));
                            lon.value = parseFloat(pos.coords.longitude.toFixed(4));
                        });
                    }
                }
                
                function toggleNightMode() {
                    nightMode.value = !nightMode.value;
                    if(nightMode.value) document.documentElement.style.filter = "sepia(1) hue-rotate(-50deg) contrast(1.2) brightness(0.8)";
                    else document.documentElement.style.filter = "";
                }
                
                function getRadarStyle(obj) {
                    // Polar to Cartesian for radar
                    // Radius = 90 - altitude (Zenith is 0 distance)
                    // Angle = azimuth (North is up, but standard math is East=0)
                    // Azimuth 0 (North) -> should be -90 deg logic or similar
                    // Let's stick to standard SVG coordinate:
                    // cx=50, cy=50. r=50.
                    // r_norm = (90 - alt) / 90
                    // angle_rad = (az - 90) * PI / 180  (Subtract 90 to rotate 0 to Top)
                    
                    const r_norm = (90 - obj.altitude) / 90 * 48; // 48 is max radius
                    const angle_rad = (obj.azimuth - 90) * (Math.PI / 180);
                    
                    const x = 50 + r_norm * Math.cos(angle_rad);
                    const y = 50 + r_norm * Math.sin(angle_rad);
                    
                    return { left: x + '%', top: y + '%' };
                }
                
                function openSimulator(obj) {
                    selectedObject.value = obj;
                }
                
                function getDSSUrl(obj) {
                    // DSS Image Service
                    // size usually in arcmin. 
                    const h = obj.size || 15;
                    const w = obj.size || 15;
                    return \`https://server.dss.stsci.edu/product?task=thumb&r=\${obj.ra}&d=\${obj.dec}&w=\${w}&h=\${h}&f=gif\`;
                }

                // Initial Timer
                onMounted(() => {
                    setInterval(() => {
                         // Update every minute (reactive date)
                         // For now manual is fine.
                    }, 60000);
                });

                return {
                    lat, lon, dateStr, bortle,
                    sortedObjects, visibleObjects,
                    moonIllumination, moonIsUp, moonEmoji,
                    viewMode, searchQuery,
                    toggleNightMode, nightMode,
                    useGPS, getRadarStyle,
                    openSimulator, selectedObject, getDSSUrl,
                    error: null
                };
            },
            compilerOptions: {
              delimiters: ['{{', '}}'] // Ensure standard delimiters are explicit
            },
            errorHandler(err, instance, info) {
                console.error("Vue Error:", err);
                alert("App Error: " + err.message);
            }
        });
        
        // Safety check for Astronomy Engine
        if (typeof Astronomy === 'undefined') {
            document.body.innerHTML = '<div style="color:red; padding:20px;">Error: Astronomy Engine failed to load. Please refresh or check your connection.</div>';
        } else {
            app.mount('#app');
        }
    </script>
</body>
</html>`;
}
