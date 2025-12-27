import { catalog } from './catalog.js';
import * as Astronomy from 'https://esm.sh/astronomy-engine@2.1.19';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (request.method === "POST" && url.pathname === "/results") {
            return await handleResults(request);
        }

        return new Response(renderHome(), {
            headers: { "Content-Type": "text/html" },
        });
    },
};

async function handleResults(request) {
    const formData = await request.formData();
    const lat = parseFloat(formData.get("latitude"));
    const lon = parseFloat(formData.get("longitude"));
    const dateStr = formData.get("datetime") || new Date().toISOString();
    const bortle = parseInt(formData.get("bortle") || "4");

    // Equipment
    const focalLength = parseFloat(formData.get("focal_length") || "0");
    const sensorWidth = parseFloat(formData.get("sensor_width") || "0");
    const sensorHeight = parseFloat(formData.get("sensor_height") || "0");

    const date = new Date(dateStr);
    const observer = new Astronomy.Observer(lat, lon, 0);

    // 1. Moon Calculations
    const moonPhase = Astronomy.MoonPhase(date); // 0 to 360
    const moonIllum = getMoonIllumination(moonPhase);
    const moonEq = Astronomy.MoonPosition(date);
    const moonHor = Astronomy.Horizon(date, observer, moonEq.ra, moonEq.dec, 'normal');

    const moonData = {
        altitude: moonHor.altitude.toFixed(1),
        azimuth: moonHor.azimuth.toFixed(1),
        illumination: Math.round(moonIllum * 100),
        is_up: moonHor.altitude > 0
    };

    // 2. DSO Calculations
    const results = catalog.map(obj => {
        const ra = obj.ra; // degrees
        const dec = obj.dec; // degrees

        // Calculate Position
        const hor = Astronomy.Horizon(date, observer, ra, dec, 'normal');
        const alt = hor.altitude;
        const az = hor.azimuth;

        // Airmass (Simple approximation)
        let airmass = "-";
        if (alt > 0) {
            const z = (90 - alt) * (Math.PI / 180);
            airmass = (1 / Math.cos(z)).toFixed(2);
        }

        // Moon Separation
        const sep = Astronomy.AngleBetween(ra, dec, moonEq.ra, moonEq.dec);

        // Scoring Logic (simplified port from Python)
        let score = 0;
        if (alt > 0) {
            // Alt Score
            let altScore = (alt > 30) ? 50 : (alt / 30) * 50;

            // Mag Penalty
            const bortlePenalty = (bortle - 1) * 0.5;

            // Moon Penalty
            let moonPenalty = 0;
            if (moonData.is_up) {
                const sepFactor = 1 - (Math.min(sep, 90) / 90);
                moonPenalty = moonIllum * sepFactor * 20;
            }

            const effMag = obj.mag + bortlePenalty + moonPenalty;
            let magScore = 50 - (effMag * 5);
            magScore = Math.max(0, Math.min(50, magScore));

            score = altScore + magScore;
        }

        // FOV Check
        let fovMatch = null;
        const minFov = calculateFov(focalLength, sensorWidth, sensorHeight);
        if (minFov && obj.size) {
            const sizeDeg = obj.size / 60.0;
            fovMatch = (sizeDeg < minFov) ? "Fits in FOV" : "Too Large";
        }

        return {
            ...obj,
            altitude: alt.toFixed(1),
            azimuth: az.toFixed(1),
            airmass,
            moon_separation: sep.toFixed(1),
            score: score.toFixed(1),
            fov_match: fovMatch
        };
    });

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    return new Response(renderResults(results, moonData, { lat, lon, time: dateStr }, { fl: focalLength }), {
        headers: { "Content-Type": "text/html" },
    });
}

// Helpers
function getMoonIllumination(phase) {
    // Phase is 0..360. Illum is 0..1..0
    // Simple approx: 0.5 * (1 - cos(phase_rad))
    const rad = phase * (Math.PI / 180);
    return 0.5 * (1 - Math.cos(rad)); // Logic from Python astroplan approx
}

function calculateFov(fl, sw, sh) {
    if (!fl || !sw || !sh) return null;
    const fovW = 2 * Math.atan(sw / (2 * fl)) * (180 / Math.PI);
    const fovH = 2 * Math.atan(sh / (2 * fl)) * (180 / Math.PI);
    return Math.min(fovW, fovH);
}

// Simple HTML Rendering (replacing Jinja2)
function renderHome() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AstroImage Well (JS)</title>
    <!-- Tailwind CSS (via CDN for speed) -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #0f172a; color: #e2e8f0; font-family: 'Inter', sans-serif; }
        .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
    <div class="glass p-8 rounded-2xl shadow-2xl w-full max-w-lg">
        <h1 class="text-3xl font-bold text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">AstroImage Well</h1>
        <p class="text-center text-slate-400 mb-6">Plan your astrophotography session</p>
        
        <form action="/results" method="POST" class="space-y-4">
            <div>
                <label class="block text-sm font-medium mb-1">Your Coordinates</label>
                <div class="flex gap-2">
                    <input type="number" step="any" name="latitude" placeholder="Lat (e.g. 42.69)" required class="w-1/2 p-2 rounded bg-slate-800 border border-slate-700 focus:border-blue-500 outline-none">
                    <input type="number" step="any" name="longitude" placeholder="Lon (e.g. 23.32)" required class="w-1/2 p-2 rounded bg-slate-800 border border-slate-700 focus:border-blue-500 outline-none">
                </div>
            </div>
            
            <div>
                <label class="block text-sm font-medium mb-1">Time</label>
                <input type="datetime-local" name="datetime" class="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white scheme-dark">
            </div>

            <div>
                <label class="block text-sm font-medium mb-1">Bortle Scale (1-9)</label>
                <input type="number" name="bortle" min="1" max="9" value="4" class="w-full p-2 rounded bg-slate-800 border border-slate-700">
            </div>

            <div class="pt-2 border-t border-slate-700">
                <label class="block text-sm font-medium mb-1 text-blue-300">Equipment (Optional)</label>
                <div class="grid grid-cols-3 gap-2">
                    <input type="number" name="focal_length" placeholder="FL (mm)" class="p-2 rounded bg-slate-800 border border-slate-700 text-sm">
                    <input type="number" name="sensor_width" placeholder="W (mm)" step="0.1" class="p-2 rounded bg-slate-800 border border-slate-700 text-sm">
                    <input type="number" name="sensor_height" placeholder="H (mm)" step="0.1" class="p-2 rounded bg-slate-800 border border-slate-700 text-sm">
                </div>
            </div>

            <button type="submit" class="w-full py-3 mt-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-bold hover:opacity-90 transition transform hover:scale-[1.02]">
                Find Targets 🚀
            </button>
        </form>
    </div>
</body>
</html>
  `;
}

function renderResults(objects, moon, loc, equip) {
    const rows = objects.map(obj => `
    <tr class="border-b border-slate-700 hover:bg-slate-700/50 transition">
        <td class="p-3 font-semibold text-blue-300">${obj.id}</td>
        <td class="p-3">${obj.name}<br><span class="text-xs text-slate-400">${obj.type}</span></td>
        <td class="p-3 text-center font-mono ${parseFloat(obj.score) > 80 ? 'text-green-400 font-bold' : parseFloat(obj.score) > 50 ? 'text-yellow-400' : 'text-slate-500'}">${obj.score}</td>
        <td class="p-3 text-center">${obj.altitude}°<br><span class="text-xs text-slate-400">Az: ${obj.azimuth}°</span></td>
        <td class="p-3 text-center sm:table-cell hidden">${obj.mag}</td>
        <td class="p-3 text-center sm:table-cell hidden text-xs">${obj.fov_match || '-'}</td>
    </tr>
  `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Results - AstroImage Well</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background-color: #0f172a; color: #e2e8f0; font-family: 'Inter', sans-serif; }</style>
</head>
<body class="p-4 md:p-8 max-w-6xl mx-auto">
    <div class="flex justify-between items-center mb-6">
        <a href="/" class="text-blue-400 hover:text-blue-300">← Back</a>
        <h1 class="text-2xl font-bold">Observation Session</h1>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h3 class="text-slate-400 text-sm uppercase">Moon Status</h3>
            <div class="text-2xl font-bold mt-1 ${moon.illumination > 50 ? 'text-yellow-400' : 'text-slate-200'}">${moon.illumination}%</div>
            <div class="text-sm text-slate-400">Alt: ${moon.altitude}° / ${moon.is_up ? 'UP' : 'DOWN'}</div>
        </div>
        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h3 class="text-slate-400 text-sm uppercase">Location</h3>
            <div class="text-lg mt-1">${loc.lat}, ${loc.lon}</div>
            <div class="text-sm text-slate-400">${loc.time.split('T')[0]}</div>
        </div>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-700">
        <table class="w-full text-left border-collapse">
            <thead class="bg-slate-900 text-slate-400 uppercase text-xs">
                <tr>
                    <th class="p-3">ID</th>
                    <th class="p-3">Object</th>
                    <th class="p-3 text-center">Score</th>
                    <th class="p-3 text-center">Pos</th>
                    <th class="p-3 text-center sm:table-cell hidden">Mag</th>
                    <th class="p-3 text-center sm:table-cell hidden">FOV</th>
                </tr>
            </thead>
            <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${rows}
            </tbody>
        </table>
    </div>
</body>
</html>
  `;
}
