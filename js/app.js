/**
 * MAP LAYOUT DRAFTER - Bootstrapper & UI Controller (Sprint 2 Master)
 * Handles Phase splits, Nominatim Search, Draggable Menus, and Core bindings.
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
    
    // Sprint 2 Fix: Make Tool Hub Draggable
    makeDraggable(document.getElementById('fab-container'));
});

// ==========================================
// 3. PHASE 1: SPLIT SETUP & SEARCH ENGINE
// ==========================================
function initPhase1Setup() {
    const btnToStepB = document.getElementById('btn-to-step-b');
    const btnLock = document.getElementById('btn-lock-area'); // The final confirm button
    const inputName = document.getElementById('setup-name');
    const inputArea = document.getElementById('setup-area');
    const btnSearch = document.getElementById('btn-search');
    
    // Fallback if using old HTML (Backward compatibility)
    const oldLock = document.getElementById('btn-lock-area-old'); 

    const checkInputs = () => {
        const btn = btnToStepB || oldLock || btnLock; 
        if (!btn) return;
        if (inputName && inputName.value.trim() !== "" && inputArea && inputArea.value.trim() !== "") {
            btn.removeAttribute('disabled');
        } else {
            btn.setAttribute('disabled', 'true');
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

    // Nominatim OpenStreetMap Search
    if (btnSearch) {
        btnSearch.addEventListener('click', async () => {
            const query = document.getElementById('map-search').value;
            if (!query) return;
            try {
                btnSearch.innerText = "...";
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                if (data.length > 0) {
                    // Zoom smoothly to the location
                    map.flyTo([data[0].lat, data[0].lon], 17, { duration: 1.5 });
                } else {
                    alert("Location not found. Try a broader search.");
                }
            } catch (err) {
                console.error("Search failed", err);
                alert("Search Error. Check internet connection.");
            } finally {
                btnSearch.innerText = "Find";
            }
        });
    }

    // Final Geographic Lock
    if (btnLock || oldLock) {
        (btnLock || oldLock).addEventListener('click', () => {
            state.user.enumeratorName = inputName ? inputName.value.trim() : "Unknown";
            state.user.hlbId = inputArea ? inputArea.value.trim() : "Unknown";
            state.ui.phase = 2;

            if(document.getElementById('display-area-id')) {
                document.getElementById('display-area-id').innerText = `Area: ${state.user.hlbId}`;
            }

            lockArea();

            if(document.getElementById('setup-layer')) document.getElementById('setup-layer').classList.add('hidden');
            if(document.getElementById('ui-layer')) document.getElementById('ui-layer').classList.remove('hidden');
        });
    }
}

// ==========================================
// 4. DRAGGABLE FAB ENGINE
// ==========================================
function makeDraggable(element) {
    if (!element) return;
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    // Only drag via the Main Button so sub-menus don't accidentally drag
    const dragHandle = document.getElementById('fab-main');
    if (dragHandle) {
        dragHandle.onmousedown = dragMouseDown;
        dragHandle.ontouchstart = dragMouseDown;
    } else {
        element.onmousedown = dragMouseDown;
        element.ontouchstart = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        // Don't prevent default on touchstart or it breaks click events
        pos3 = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        pos4 = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        document.onmouseup = closeDragElement;
        document.ontouchend = closeDragElement;
        document.onmousemove = elementDrag;
        document.ontouchmove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        let clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        let clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        pos1 = pos3 - clientX;
        pos2 = pos4 - clientY;
        pos3 = clientX;
        pos4 = clientY;
        
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        element.style.bottom = "auto";
        element.style.right = "auto";
    }

    function closeDragElement() {
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

    fabMain.addEventListener('click', () => {
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
// 6. GENERIC UI CONTROLS & BINDINGS
// ==========================================
function initUIControls() {
    // Horizontal Transparency Slider
    const slider = document.getElementById('smokiness-slider');
    const tracingLayer = document.getElementById('tracing-layer');
    if (slider && tracingLayer) {
        slider.addEventListener('input', (e) => {
            state.ui.smokiness = e.target.value;
            const opacity = e.target.value / 100;
            tracingLayer.style.backgroundColor = `rgba(255, 255, 255, ${opacity})`;
        });
    }

    // Manual Refresh Sync Button
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            redrawAllFeatures();
            console.log("Forced UI Refresh Triggered.");
        });
    }

    // GPS Toggle Binding (Clicking the GPS pill turns it on/off)
    const gpsContainer = document.getElementById('gps-status')?.parentElement;
    if (gpsContainer) {
        gpsContainer.style.cursor = 'pointer';
        gpsContainer.addEventListener('click', toggleGPS);
    }

    // Export PDF
    if(document.getElementById('btn-export')) {
        document.getElementById('btn-export').addEventListener('click', () => generatePDF());
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

    if(document.getElementById('btn-emergency-reset')) {
        document.getElementById('btn-emergency-reset').addEventListener('click', () => clearDraft());
    }
}
