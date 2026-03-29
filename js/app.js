/**
 * MAP LAYOUT DRAFTER - Bootstrapper & UI Controller (Sprint 3 Master)
 * Features: Humanized Search Helper, Touch-Perfect Draggable UI, Elite Tile Fading, Linter-Safe.
 */

import { state, CATEGORIES, TOOLS } from './config.js';
import { initMap, lockArea, map, toggleBaseMap, toggleGPS } from './map.js';
import { initSymbols, redrawAllFeatures } from './symbol.js'; 
import { generatePDF } from './export.js'; 
import { loadDraftLocally, clearDraft } from './storage.js';

window.appLogs = [];
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    window.appLogs.push(`[INFO] ${new Date().toLocaleTimeString()}: ${args.join(' ')}`);
    originalLog.apply(console, args);
};
console.error = function(...args) {
    window.appLogs.push(`[ERROR] ${new Date().toLocaleTimeString()}: ${args.join(' ')}`);
    originalError.apply(console, args);
};

document.addEventListener('DOMContentLoaded', () => {
    // Prevent accidental zooming/scrolling on the UI layer
    document.addEventListener('touchmove', (e) => {
        if (e.scale !== 1 && state.ui.currentCategory !== CATEGORIES.HAND) { e.preventDefault(); } 
    }, { passive: false });

    initMap();
    initSymbols();
    
    const hasSavedData = loadDraftLocally();
    if (hasSavedData && state.features.length > 0) {
        if(document.getElementById('setup-layer')) document.getElementById('setup-layer').classList.add('hidden');
        if(document.getElementById('ui-layer')) document.getElementById('ui-layer').classList.remove('hidden');
        if(document.getElementById('display-area-id')) document.getElementById('display-area-id').innerText = `Area: ${state.user.hlbId}`;
        lockArea();
        redrawAllFeatures(); 
    } else {
        initPhase1Setup(); 
    }

    initFABLogic();
    initUIControls();
    
    // Sprint 3 Fix: Elite Mobile-Optimized Draggable Engine
    makeDraggable(document.getElementById('fab-container'));
});

// ==========================================
// 3. PHASE 1: SPLIT SETUP & HUMANIZED SEARCH
// ==========================================
function initPhase1Setup() {
    const btnToStepB = document.getElementById('btn-to-step-b');
    const btnLock = document.getElementById('btn-lock-area');
    const inputName = document.getElementById('setup-name');
    const inputArea = document.getElementById('setup-area');
    
    const searchInput = document.getElementById('map-search');
    const btnSearch = document.getElementById('btn-search');
    const suggestionsBox = document.getElementById('search-suggestions');

    // Input Validation
    const checkInputs = () => {
        if (!btnToStepB) return;
        if (inputName && inputName.value.trim() !== "" && inputArea && inputArea.value.trim() !== "") {
            btnToStepB.removeAttribute('disabled');
        } else {
            btnToStepB.setAttribute('disabled', 'true');
        }
    };

    if(inputName) inputName.addEventListener('input', checkInputs);
    if(inputArea) inputArea.addEventListener('input', checkInputs);

    // Step A to Step B Transition
    if (btnToStepB) {
        btnToStepB.addEventListener('click', () => {
            document.getElementById('setup-step-a').classList.add('hidden');
            document.getElementById('setup-step-b').classList.remove('hidden');
        });
    }

    // Nominatim OpenStreetMap Search Helper (Does NOT lock the map)
    if (btnSearch && searchInput && suggestionsBox) {
        btnSearch.addEventListener('click', async () => {
            const query = searchInput.value.trim();
            if (!query) return;
            
            try {
                btnSearch.innerText = "...";
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                suggestionsBox.innerHTML = ''; // Clear old
                
                if (data.length > 0) {
                    data.forEach(place => {
                        const li = document.createElement('li');
                        li.className = 'p-3 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-0 text-gray-700';
                        li.innerText = place.display_name;
                        
                        // Human Validation Step: Fly to location, but wait for user to confirm
                        li.onclick = () => {
                            map.flyTo([place.lat, place.lon], 17, { duration: 1.5 });
                            suggestionsBox.classList.add('hidden');
                            searchInput.value = place.name || place.display_name.split(',')[0];
                        };
                        suggestionsBox.appendChild(li);
                    });
                    suggestionsBox.classList.remove('hidden');
                } else {
                    suggestionsBox.innerHTML = '<li class="p-3 text-sm text-red-500">No results found. Try a broader search.</li>';
                    suggestionsBox.classList.remove('hidden');
                }
            } catch (err) {
                console.error("Search failed", err);
                suggestionsBox.innerHTML = '<li class="p-3 text-sm text-red-500">Network Error. Check connection.</li>';
                suggestionsBox.classList.remove('hidden');
            } finally {
                btnSearch.innerText = "Search";
            }
        });

        // Hide suggestions if clicking outside (Acode strict type-safe version)
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (target instanceof Node && !searchInput.contains(target) && !suggestionsBox.contains(target) && !btnSearch.contains(target)) {
                suggestionsBox.classList.add('hidden');
            }
        });
    }

    // Final Geographic Lock (The Human Decision)
    if (btnLock) {
        btnLock.addEventListener('click', () => {
            state.user.enumeratorName = inputName ? inputName.value.trim() : "Unknown";
            state.user.hlbId = inputArea ? inputArea.value.trim() : "Unknown";
            state.ui.phase = 2;

            if(document.getElementById('display-area-id')) {
                document.getElementById('display-area-id').innerText = `Area: ${state.user.hlbId}`;
            }

            lockArea(); // Executes Leaflet bounds lock

            if(document.getElementById('setup-layer')) document.getElementById('setup-layer').classList.add('hidden');
            if(document.getElementById('ui-layer')) document.getElementById('ui-layer').classList.remove('hidden');
        });
    }
}

// ==========================================
// 4. ELITE DRAGGABLE FAB ENGINE
// ==========================================
function makeDraggable(container) {
    if (!container) return;
    const dragHandle = document.getElementById('fab-main');
    if (!dragHandle) return;

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    dragHandle.onmousedown = dragStart;
    dragHandle.ontouchstart = dragStart;

    function dragStart(e) {
        e = e || window.event;
        
        if(e.type === 'touchstart') {
            pos3 = e.touches[0].clientX;
            pos4 = e.touches[0].clientY;
        } else {
            e.preventDefault(); 
            pos3 = e.clientX;
            pos4 = e.clientY;
        }
        
        document.onmouseup = closeDrag;
        document.ontouchend = closeDrag;
        document.onmousemove = elementDrag;
        document.ontouchmove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        let clientX, clientY;
        
        if(e.type === 'touchmove') {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            e.preventDefault();
            clientX = e.clientX;
            clientY = e.clientY;
        }

        pos1 = pos3 - clientX;
        pos2 = pos4 - clientY;
        pos3 = clientX;
        pos4 = clientY;

        container.style.top = (container.offsetTop - pos2) + "px";
        container.style.left = (container.offsetLeft - pos1) + "px";
        container.style.bottom = "auto";
        container.style.right = "auto";
    }

    function closeDrag() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
    }
}

// ==========================================
// 5. THE FAB MENU ENGINE
// ==========================================
function initFABLogic() {
    const fabMain = document.getElementById('fab-main');
    const fabCategories = document.getElementById('fab-categories');
    const fabSubmenu = document.getElementById('fab-submenu');
    if(!fabMain || !fabCategories) return;

    fabMain.addEventListener('click', (e) => {
        fabCategories.classList.toggle('hidden');
        fabCategories.classList.toggle('flex');
        if(fabSubmenu) fabSubmenu.classList.add('hidden');
    });

    document.querySelectorAll('.fab-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.currentTarget.getAttribute('data-cat');
            state.ui.currentCategory = category;
            fabMain.innerHTML = e.currentTarget.innerHTML;
            populateSubMenu(category);
            fabCategories.classList.add('hidden');
            fabCategories.classList.remove('flex');
        });
    });
}

function populateSubMenu(category) {
    const submenu = document.getElementById('fab-submenu');
    if(!submenu) return;
    submenu.innerHTML = ''; 
    let toolsHTML = '';

    if (category === CATEGORIES.HAND) {
        submenu.classList.add('hidden');
        setActiveTool(TOOLS.PAN);
        return; 
    } else if (category === CATEGORIES.ERASER) {
        submenu.classList.add('hidden');
        setActiveTool(TOOLS.ERASER);
        return; 
    } else if (category === CATEGORIES.BUILDING) {
        toolsHTML = `
            <button class="tool-btn p-2 bg-gray-100 rounded border-2 border-transparent" data-tool="${TOOLS.PUCCA_RES}"><div class="w-6 h-6 border-2 border-black bg-white"></div></button>
            <button class="tool-btn p-2 bg-gray-100 rounded border-2 border-transparent" data-tool="${TOOLS.PUCCA_NON_RES}"><div class="w-6 h-6 border-2 border-black" style="background: repeating-linear-gradient(45deg, #000 0, #000 1px, #fff 0, #fff 4px);"></div></button>
            <button class="tool-btn p-2 bg-gray-100 rounded border-2 border-transparent" data-tool="${TOOLS.KUTCHA_RES}"><div class="w-0 h-0 border-l-[12px] border-r-[12px] border-b-[20px] border-l-transparent border-r-transparent border-b-black"></div></button>
            <button class="tool-btn p-2 bg-gray-100 rounded border-2 border-transparent" data-tool="${TOOLS.KUTCHA_NON_RES}"><div class="relative w-0 h-0 border-l-[12px] border-r-[12px] border-b-[20px] border-l-transparent border-r-transparent border-b-black"><div class="absolute top-[2px] -left-[8px] w-[16px] h-[16px]" style="background: repeating-linear-gradient(45deg, #000 0, #000 1px, #fff 0, #fff 4px);"></div></div></button>
        `;
    } else if (category === CATEGORIES.LINE) {
        toolsHTML = `
            <button class="tool-btn p-2 bg-gray-100 rounded border-2 border-transparent text-xs font-bold" data-tool="${TOOLS.LINE_STRAIGHT}">Straight</button>
            <button class="tool-btn p-2 bg-gray-100 rounded border-2 border-transparent text-xs font-bold" data-tool="${TOOLS.LINE_PATHWAY}">Path</button>
            <button class="tool-btn p-2 bg-gray-100 rounded border-2 border-transparent text-xs font-bold" data-tool="${TOOLS.LINE_BOUNDARY}">Boundary</button>
            <button class="tool-btn p-2 bg-gray-100 rounded border-2 border-transparent text-xs font-bold" data-tool="${TOOLS.LINE_FREEHAND}">Draw</button>
        `;
    } else if (category === CATEGORIES.LANDMARK) {
        toolsHTML = `
            <button class="tool-btn p-2 bg-gray-100 rounded border-2 border-transparent text-xs font-bold" data-tool="${TOOLS.LM_TAP}">[Tap]</button>
            <button class="tool-btn p-2 bg-gray-100 rounded border-2 border-transparent text-xs font-bold" data-tool="${TOOLS.LM_TEMPLE}">[Temple]</button>
            <button class="tool-btn p-2 bg-gray-100 rounded border-2 border-transparent text-xs font-bold" data-tool="${TOOLS.LM_CUSTOM}">(+)</button>
        `;
    }

    submenu.innerHTML = toolsHTML;
    submenu.classList.remove('hidden');
    submenu.classList.add('flex');

    submenu.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setActiveTool(e.currentTarget.getAttribute('data-tool'));
            submenu.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });
}

function setActiveTool(toolId) {
    state.ui.currentTool = toolId;
}

// ==========================================
// 6. GENERIC UI CONTROLS & ADVANCED SETTINGS
// ==========================================
function initUIControls() {
    // Elite Transparency Slider: Fades Satellite Tiles, leaves vectors untouched
    const slider = document.getElementById('smokiness-slider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            state.ui.smokiness = e.target.value;
            const opacity = 1 - (e.target.value / 100);
            const tilePane = document.querySelector('.leaflet-tile-pane');
            if (tilePane) tilePane.style.opacity = opacity.toString();
        });
    }

    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            redrawAllFeatures();
        });
    }

    // Wiring Toggle GPS
    const btnToggleGps = document.getElementById('btn-toggle-gps');
    if (btnToggleGps) {
        btnToggleGps.addEventListener('click', toggleGPS);
    }

    // Export Binding
    if(document.getElementById('btn-export')) {
        document.getElementById('btn-export').addEventListener('click', () => generatePDF());
    }

    // Base Map Layer Switcher
    document.querySelectorAll('.map-layer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.map-layer-btn').forEach(b => {
                b.classList.remove('bg-blue-50', 'border-blue-500', 'text-blue-700');
                b.classList.add('bg-gray-50', 'border-transparent', 'text-gray-600');
            });
            const target = e.currentTarget;
            target.classList.remove('bg-gray-50', 'border-transparent', 'text-gray-600');
            target.classList.add('bg-blue-50', 'border-blue-500', 'text-blue-700');
            
            toggleBaseMap(target.getAttribute('data-layer'));
        });
    });

    // Force Map Sync
    if(document.getElementById('btn-force-redraw')) {
        document.getElementById('btn-force-redraw').addEventListener('click', () => {
            redrawAllFeatures();
            alert("Map data re-synced from memory successfully.");
        });
    }

    // Emergency Wipe
    if(document.getElementById('btn-emergency-reset')) {
        document.getElementById('btn-emergency-reset').addEventListener('click', () => {
            if(confirm("CRITICAL WARNING: This will permanently delete your drafted layout. Proceed?")) {
                clearDraft();
            }
        });
    }

    // Slide-out Menu Wiring
    const btnMenu = document.getElementById('btn-menu');
    const btnCloseMenu = document.getElementById('btn-close-menu');
    const settingsMenu = document.getElementById('settings-menu');
    const menuOverlay = document.getElementById('menu-overlay');

    const toggleMenu = () => {
        if(!settingsMenu) return;
        const isClosed = settingsMenu.classList.contains('-translate-x-full');
        if (isClosed) {
            settingsMenu.classList.remove('-translate-x-full');
            if(menuOverlay) menuOverlay.classList.remove('hidden');
            if(document.getElementById('stat-bldg')) document.getElementById('stat-bldg').innerText = state.features.filter(f => f.category === CATEGORIES.BUILDING).length;
            if(document.getElementById('stat-lm')) document.getElementById('stat-lm').innerText = state.features.filter(f => f.category === CATEGORIES.LANDMARK).length;
            if(document.getElementById('stat-lines')) document.getElementById('stat-lines').innerText = state.features.filter(f => f.category === CATEGORIES.LINE).length;
        } else {
            settingsMenu.classList.add('-translate-x-full');
            if(menuOverlay) menuOverlay.classList.add('hidden');
        }
    };

    if(btnMenu) btnMenu.addEventListener('click', toggleMenu);
    if(btnCloseMenu) btnCloseMenu.addEventListener('click', toggleMenu);
    if(menuOverlay) menuOverlay.addEventListener('click', toggleMenu);
}
