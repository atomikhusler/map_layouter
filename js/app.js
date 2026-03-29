/**
 * MAP LAYOUT DRAFTER - Bootstrapper & UI Controller (Sprint 5 Master - Linter Proof)
 * Features: 0-Error Touch Fix, Undo/Redo Memory, Dark Mode, Multi-Format Export.
 */

import { state, CATEGORIES, TOOLS } from './config.js';
import { initMap, lockArea, map, toggleBaseMap, toggleGPS } from './map.js';
import { initSymbols, redrawAllFeatures } from './symbol.js'; 
import { generatePDF, generatePNG, generateCSV, generateJSON } from './export.js'; 
import { loadDraftLocally, clearDraft, saveDraftLocally } from './storage.js';

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
    // ELITE FIX: Added 'e.scale &&' to prevent Android devices from freezing
    document.addEventListener('touchmove', (e) => {
        if (e.scale && e.scale !== 1 && state.ui.currentCategory !== CATEGORIES.HAND) { 
            e.preventDefault(); 
        } 
    }, { passive: false });

    initMap();
    initSymbols();
    
    const hasSavedData = loadDraftLocally();
    if (hasSavedData && state.features.length > 0) {
        state.undoStack.push(JSON.parse(JSON.stringify(state.features)));

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

    if (btnToStepB) {
        btnToStepB.addEventListener('click', () => {
            document.getElementById('setup-step-a').classList.add('hidden');
            document.getElementById('setup-step-b').classList.remove('hidden');
        });
    }

    if (btnSearch && searchInput && suggestionsBox) {
        btnSearch.addEventListener('click', async () => {
            const query = searchInput.value.trim();
            if (!query) return;
            
            try {
                btnSearch.innerText = "...";
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                suggestionsBox.innerHTML = ''; 
                
                if (data.length > 0) {
                    data.forEach(place => {
                        const li = document.createElement('li');
                        li.className = 'p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm border-b border-gray-100 dark:border-gray-700 last:border-0 text-gray-700 dark:text-gray-200 transition-colors';
                        li.innerText = place.display_name;
                        
                        li.onclick = () => {
                            map.flyTo([place.lat, place.lon], 17, { duration: 1.5 });
                            suggestionsBox.classList.add('hidden');
                            searchInput.value = place.name || place.display_name.split(',')[0];
                        };
                        suggestionsBox.appendChild(li);
                    });
                    suggestionsBox.classList.remove('hidden');
                } else {
                    suggestionsBox.innerHTML = '<li class="p-3 text-sm text-red-500">No results found.</li>';
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

        // ELITE FIX: Bulletproof click-away listener using composedPath() to satisfy strict Acode Linter
        document.addEventListener('click', (e) => {
            const path = e.composedPath();
            if (!path.includes(searchInput) && !path.includes(suggestionsBox) && !path.includes(btnSearch)) {
                suggestionsBox.classList.add('hidden');
            }
        });
    }

    if (btnLock) {
        btnLock.addEventListener('click', () => {
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
        // ELITE FIX: Removed e.preventDefault() entirely so button clicks are never swallowed
        if(e.type === 'touchstart') {
            pos3 = e.touches[0].clientX;
            pos4 = e.touches[0].clientY;
        } else {
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
            <button class="tool-btn p-2 bg-gray-100 dark:bg-gray-700 rounded border-2 border-transparent" data-tool="${TOOLS.PUCCA_RES}"><div class="w-6 h-6 border-2 border-black bg-white"></div></button>
            <button class="tool-btn p-2 bg-gray-100 dark:bg-gray-700 rounded border-2 border-transparent" data-tool="${TOOLS.PUCCA_NON_RES}"><div class="w-6 h-6 border-2 border-black" style="background: repeating-linear-gradient(45deg, #000 0, #000 1px, #fff 0, #fff 4px);"></div></button>
            <button class="tool-btn p-2 bg-gray-100 dark:bg-gray-700 rounded border-2 border-transparent" data-tool="${TOOLS.KUTCHA_RES}"><div class="w-0 h-0 border-l-[12px] border-r-[12px] border-b-[20px] border-l-transparent border-r-transparent border-b-black"></div></button>
            <button class="tool-btn p-2 bg-gray-100 dark:bg-gray-700 rounded border-2 border-transparent" data-tool="${TOOLS.KUTCHA_NON_RES}"><div class="relative w-0 h-0 border-l-[12px] border-r-[12px] border-b-[20px] border-l-transparent border-r-transparent border-b-black"><div class="absolute top-[2px] -left-[8px] w-[16px] h-[16px]" style="background: repeating-linear-gradient(45deg, #000 0, #000 1px, #fff 0, #fff 4px);"></div></div></button>
        `;
    } else if (category === CATEGORIES.LINE) {
        toolsHTML = `
            <button class="tool-btn p-2 bg-gray-100 dark:bg-gray-700 rounded border-2 border-transparent text-xs font-bold dark:text-white" data-tool="${TOOLS.LINE_MAINROAD}">Main</button>
            <button class="tool-btn p-2 bg-gray-100 dark:bg-gray-700 rounded border-2 border-transparent text-xs font-bold dark:text-white" data-tool="${TOOLS.LINE_STRAIGHT}">Straight</button>
            <button class="tool-btn p-2 bg-gray-100 dark:bg-gray-700 rounded border-2 border-transparent text-xs font-bold dark:text-white" data-tool="${TOOLS.LINE_PATHWAY}">Path</button>
            <button class="tool-btn p-2 bg-gray-100 dark:bg-gray-700 rounded border-2 border-transparent text-xs font-bold dark:text-white" data-tool="${TOOLS.LINE_FREEHAND}">Draw</button>
        `;
    } else if (category === CATEGORIES.LANDMARK) {
        toolsHTML = `
            <button class="tool-btn p-2 bg-gray-100 dark:bg-gray-700 rounded border-2 border-transparent text-xs font-bold dark:text-white" data-tool="${TOOLS.LM_TAP}">[Tap]</button>
            <button class="tool-btn p-2 bg-gray-100 dark:bg-gray-700 rounded border-2 border-transparent text-xs font-bold dark:text-white" data-tool="${TOOLS.LM_TEMPLE}">[Temple]</button>
            <button class="tool-btn p-2 bg-gray-100 dark:bg-gray-700 rounded border-2 border-transparent text-xs font-bold dark:text-white" data-tool="${TOOLS.LM_CUSTOM}">(+)</button>
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
// 6. GENERIC UI CONTROLS & MEMORY ENGINE
// ==========================================
function initUIControls() {
    
    // --- Dark Mode Toggle ---
    const darkToggle = document.getElementById('toggle-dark-mode');
    if (darkToggle) {
        darkToggle.addEventListener('change', (e) => {
            if (e.target.checked) document.body.classList.add('dark');
            else document.body.classList.remove('dark');
        });
    }

    // --- Undo & Redo Engine ---
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');

    if (btnUndo) {
        btnUndo.addEventListener('click', () => {
            if (state.undoStack.length > 0) {
                const currentState = state.undoStack.pop();
                state.redoStack.push(currentState);
                
                state.features = state.undoStack.length > 0 ? JSON.parse(JSON.stringify(state.undoStack[state.undoStack.length - 1])) : [];
                redrawAllFeatures();
                saveDraftLocally();
            }
        });
    }

    if (btnRedo) {
        btnRedo.addEventListener('click', () => {
            if (state.redoStack.length > 0) {
                const nextState = state.redoStack.pop();
                state.undoStack.push(nextState);
                
                state.features = JSON.parse(JSON.stringify(nextState));
                redrawAllFeatures();
                saveDraftLocally();
            }
        });
    }

    // --- Transparency Slider ---
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
        btnRefresh.addEventListener('click', () => redrawAllFeatures());
    }

    const btnToggleGps = document.getElementById('btn-toggle-gps');
    if (btnToggleGps) btnToggleGps.addEventListener('click', toggleGPS);

    // --- Export Menu Connections ---
    if (document.getElementById('btn-export')) document.getElementById('btn-export').addEventListener('click', generatePDF);
    if (document.getElementById('export-pdf')) document.getElementById('export-pdf').addEventListener('click', generatePDF);
    if (document.getElementById('export-png')) document.getElementById('export-png').addEventListener('click', async () => {
        const imgData = await generatePNG();
        if (imgData) {
            const link = document.createElement("a");
            link.href = imgData;
            link.download = `Map_Layout_${state.user.hlbId || "Draft"}.png`;
            link.click();
        }
    });
    if (document.getElementById('export-csv')) document.getElementById('export-csv').addEventListener('click', generateCSV);
    if (document.getElementById('export-json')) document.getElementById('export-json').addEventListener('click', generateJSON);

    // --- Base Map Layer Switcher ---
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

    if(document.getElementById('btn-force-redraw')) {
        document.getElementById('btn-force-redraw').addEventListener('click', () => {
            redrawAllFeatures();
            alert("Deep Sync Render completed.");
        });
    }

    if(document.getElementById('btn-emergency-reset')) {
        document.getElementById('btn-emergency-reset').addEventListener('click', () => {
            if(confirm("CRITICAL WARNING: This will permanently delete your drafted layout. Proceed?")) clearDraft();
        });
    }

    // --- Slide-out Menu Wiring ---
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