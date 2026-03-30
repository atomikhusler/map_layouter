/**
 * MAP LAYOUT DRAFTER - V9 Premium Architecture
 * Application Controller & Event Orchestrator
 * Fixes: 100% Type-Safe Event Targets (Zero Acode Errors).
 */

import { state, CATEGORIES, TOOLS, getActiveProject } from './config.js';
import { initMap, lockArea, map, toggleGPS } from './map.js';
import { initSymbols, redrawAllFeatures, deselectAll } from './symbol.js'; 
import * as Exporter from './export.js'; 
import { loadDraftLocally, saveDraftLocally } from './storage.js';
import { switchProject, renameProject, deleteProject } from './projectManager.js';

// Global Diagnostic Logger
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

let pendingTargetProjectId = null;

document.addEventListener('DOMContentLoaded', () => {
    
    // Security: Stop browser navigation but keep session active
    window.history.pushState(null, null, window.location.href);
    window.onpopstate = function () {
        window.history.pushState(null, null, window.location.href);
        saveDraftLocally(); 
        showToast('Use the workspace menu to navigate.');
    };

    window.addEventListener('beforeunload', () => saveDraftLocally());

    // Stop native pinch-zoom scaling on the UI layer
    document.addEventListener('touchmove', (e) => {
        if (e.scale && e.scale !== 1 && state.ui.currentCategory !== CATEGORIES.HAND) e.preventDefault(); 
    }, { passive: false });

    // Boot Sequence
    const hasSavedData = loadDraftLocally();
    initMap();
    initSymbols();
    
    // Theme Restoration
    if (state.ui.isDarkMode) {
        document.body.classList.add('dark');
        const darkToggle = document.getElementById('toggle-dark-mode');
        if (darkToggle instanceof HTMLInputElement) darkToggle.checked = true;
    }

    // Opacity Restoration
    if (state.ui.smokiness) {
        const slider = document.getElementById('smokiness-slider');
        if (slider instanceof HTMLInputElement) slider.value = state.ui.smokiness.toString();
        const opacity = 1 - (state.ui.smokiness / 100);
        const tilePane = document.querySelector('.leaflet-tile-pane');
        if (tilePane instanceof HTMLElement) tilePane.style.opacity = opacity.toString();
    }

    // Context-Aware Routing
    const activeProject = getActiveProject();
    if (hasSavedData && activeProject.isAreaLocked) {
        document.getElementById('setup-layer')?.classList.add('hidden');
        document.getElementById('ui-layer')?.classList.remove('hidden');
        
        // Update context labels
        const areaBadge = document.getElementById('display-area-id');
        const drafterBadge = document.getElementById('display-drafter-name');
        if (areaBadge) areaBadge.innerText = `Area: ${state.user.hlbId || "Unknown"}`;
        if (drafterBadge) drafterBadge.innerText = `Drafter: ${state.user.enumeratorName || "Unknown"}`;
        
        lockArea();
        redrawAllFeatures(); 
    } else {
        initPhase1Setup(); 
    }

    initDockLogic();
    initUIControls();
    initProjectDrawerLogic();
});

// ==========================================
// SETUP & SEARCH ENGINE
// ==========================================
function initPhase1Setup() {
    const btnToStepB = document.getElementById('btn-to-step-b');
    const btnLock = document.getElementById('btn-lock-area');
    const inputName = document.getElementById('setup-name');
    const inputArea = document.getElementById('setup-area');
    const searchInput = document.getElementById('map-search');
    const btnSearch = document.getElementById('btn-search');
    const suggestionBox = document.getElementById('search-suggestions');

    const checkInputs = () => {
        if (!btnToStepB) return;
        if (inputName instanceof HTMLInputElement && inputArea instanceof HTMLInputElement) {
            if (inputName.value.trim() && inputArea.value.trim()) {
                btnToStepB.removeAttribute('disabled');
            } else {
                btnToStepB.setAttribute('disabled', 'true');
            }
        }
    };

    inputName?.addEventListener('input', checkInputs);
    inputArea?.addEventListener('input', checkInputs);

    btnToStepB?.addEventListener('click', () => {
        document.getElementById('setup-step-a')?.classList.add('hidden');
        document.getElementById('setup-step-b')?.classList.remove('hidden');
    });
    
    // Fixed Search Suggestion Engine
    if (btnSearch && searchInput instanceof HTMLInputElement && suggestionBox) {
        btnSearch.addEventListener('click', async () => {
            const query = searchInput.value.trim();
            if (!query) return;
            try {
                btnSearch.innerText = "...";
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                suggestionBox.innerHTML = ''; 
                
                if (data.length > 0) {
                    suggestionBox.classList.remove('hidden');
                    data.forEach(item => {
                        const li = document.createElement('li');
                        li.className = "px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200";
                        li.innerText = item.display_name;
                        li.addEventListener('click', () => {
                            map.flyTo([item.lat, item.lon], 17, { duration: 1.5 });
                            searchInput.value = item.name || item.display_name.split(',')[0];
                            suggestionBox.classList.add('hidden');
                        });
                        suggestionBox.appendChild(li);
                    });
                } else {
                    suggestionBox.innerHTML = '<li class="px-4 py-3 text-sm text-gray-400 italic">Location not found</li>';
                    suggestionBox.classList.remove('hidden');
                }
            } catch (err) {
                console.error("Geocoding failure:", err);
            } finally {
                btnSearch.innerText = "Search";
            }
        });

        // ELITE FIX: Type-safe click-away listener
        document.addEventListener('click', (e) => {
            if (e.target instanceof Node) {
                if (!searchInput.contains(e.target) && !suggestionBox.contains(e.target)) {
                    suggestionBox.classList.add('hidden');
                }
            }
        });
    }

    btnLock?.addEventListener('click', () => {
        if (inputName instanceof HTMLInputElement) state.user.enumeratorName = inputName.value.trim() || "Unknown";
        if (inputArea instanceof HTMLInputElement) state.user.hlbId = inputArea.value.trim() || "Unknown";
        
        state.ui.phase = 2;

        const areaBadge = document.getElementById('display-area-id');
        const drafterBadge = document.getElementById('display-drafter-name');
        if (areaBadge) areaBadge.innerText = `Area: ${state.user.hlbId}`;
        if (drafterBadge) drafterBadge.innerText = `Drafter: ${state.user.enumeratorName}`;

        lockArea(); 
        saveDraftLocally();

        document.getElementById('setup-layer')?.classList.add('hidden');
        document.getElementById('ui-layer')?.classList.remove('hidden');
    });
}

// ==========================================
// TOOL DOCK & UI LOGIC
// ==========================================
function initDockLogic() {
    const dockButtons = document.querySelectorAll('.fab-cat-btn');
    dockButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            deselectAll(); 
            dockButtons.forEach(b => {
                b.classList.remove('bg-blue-100', 'text-blue-600', 'dark:bg-blue-900/40', 'dark:text-blue-400');
                b.classList.add('text-gray-600', 'dark:text-gray-300');
            });
            if (e.currentTarget instanceof Element) {
                e.currentTarget.classList.add('bg-blue-100', 'text-blue-600', 'dark:bg-blue-900/40', 'dark:text-blue-400');
                const category = e.currentTarget.getAttribute('data-cat') || CATEGORIES.HAND;
                state.ui.currentCategory = category;
                populateSubMenu(category);
            }
        });
    });

    const defaultBtn = document.querySelector('.fab-cat-btn[data-cat="hand"]');
    if (defaultBtn instanceof HTMLElement) defaultBtn.click();
}

function populateSubMenu(category) {
    const submenu = document.getElementById('fab-submenu');
    if(!submenu) return;
    submenu.innerHTML = ''; 
    let toolsHTML = '';

    if (category === CATEGORIES.HAND || category === CATEGORIES.ERASER) {
        submenu.classList.add('hidden');
        setActiveTool(category === CATEGORIES.HAND ? TOOLS.PAN : TOOLS.ERASER);
        return; 
    } else if (category === CATEGORIES.BUILDING) {
        toolsHTML = `
            <button class="tool-btn flex justify-center items-center bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent" data-tool="${TOOLS.PUCCA_RES}"><div class="w-5 h-5 border-2 border-black bg-white"></div></button>
            <button class="tool-btn flex justify-center items-center bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent" data-tool="${TOOLS.PUCCA_NON_RES}"><div class="w-5 h-5 border-2 border-black" style="background: repeating-linear-gradient(45deg, #000 0, #000 1px, #fff 0, #fff 4px);"></div></button>
            <button class="tool-btn flex justify-center items-center bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent" data-tool="${TOOLS.KUTCHA_RES}"><div class="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent border-b-black"></div></button>
            <button class="tool-btn flex justify-center items-center bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent" data-tool="${TOOLS.KUTCHA_NON_RES}"><div class="relative w-0 h-0 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent border-b-black"><div class="absolute top-[2px] -left-[6px] w-[12px] h-[12px]" style="background: repeating-linear-gradient(45deg, #000 0, #000 1px, #fff 0, #fff 4px);"></div></div></button>
        `;
    } else if (category === CATEGORIES.LINE) {
        toolsHTML = `
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-[10px] font-bold" data-tool="${TOOLS.LINE_MAINROAD}">Main</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-[10px] font-bold" data-tool="${TOOLS.LINE_STRAIGHT}">Straight</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-[10px] font-bold" data-tool="${TOOLS.LINE_PATHWAY}">Path</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-[10px] font-bold" data-tool="${TOOLS.LINE_RAILWAY}">Railway</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-[10px] font-bold" data-tool="${TOOLS.LINE_FREEHAND}">Draw</button>
        `;
    } else if (category === CATEGORIES.LANDMARK) {
        toolsHTML = `
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-[10px] font-bold" data-tool="${TOOLS.LM_SQUARE}">Square</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-[10px] font-bold" data-tool="${TOOLS.LM_CIRCLE}">Circle</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-[10px] font-bold" data-tool="${TOOLS.LM_PENTAGON}">Pentagon</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-[10px] font-bold" data-tool="${TOOLS.LM_HEXAGON}">Hexagon</button>
        `;
    }

    submenu.innerHTML = toolsHTML;
    submenu.classList.remove('hidden');

    submenu.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.currentTarget instanceof Element) {
                setActiveTool(e.currentTarget.getAttribute('data-tool'));
                submenu.querySelectorAll('.tool-btn').forEach(b => {
                    b.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
                    b.classList.add('border-transparent', 'bg-gray-100', 'dark:bg-gray-700');
                });
                e.currentTarget.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
            }
        });
    });

    const firstTool = submenu.querySelector('.tool-btn');
    if (firstTool instanceof HTMLElement) firstTool.click();
}

function setActiveTool(toolId) { if (toolId) state.ui.currentTool = toolId; }

function initUIControls() {
    document.getElementById('toggle-dark-mode')?.addEventListener('change', (e) => {
        if (e.target instanceof HTMLInputElement) {
            state.ui.isDarkMode = e.target.checked; 
            document.body.classList.toggle('dark', e.target.checked);
            saveDraftLocally();
        }
    });

    const slider = document.getElementById('smokiness-slider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            if (e.target instanceof HTMLInputElement) {
                state.ui.smokiness = parseFloat(e.target.value) || 0;
                const opacity = 1 - (state.ui.smokiness / 100);
                const tilePane = document.querySelector('.leaflet-tile-pane');
                if (tilePane instanceof HTMLElement) tilePane.style.opacity = opacity.toString();
            }
        });
        slider.addEventListener('change', () => saveDraftLocally());
    }
    
    // Undo/Redo Engine
    document.getElementById('btn-undo')?.addEventListener('click', () => {
        const proj = getActiveProject();
        if (proj.undoStack.length > 0) {
            proj.redoStack.push(proj.undoStack.pop());
            proj.features = proj.undoStack.length > 0 ? JSON.parse(JSON.stringify(proj.undoStack[proj.undoStack.length - 1])) : [];
            redrawAllFeatures(); saveDraftLocally();
        }
    });

    document.getElementById('btn-redo')?.addEventListener('click', () => {
        const proj = getActiveProject();
        if (proj.redoStack.length > 0) {
            const state = proj.redoStack.pop();
            proj.undoStack.push(state);
            proj.features = JSON.parse(JSON.stringify(state));
            redrawAllFeatures(); saveDraftLocally();
        }
    });

    document.getElementById('btn-refresh')?.addEventListener('click', () => redrawAllFeatures());
    document.getElementById('btn-toggle-gps')?.addEventListener('click', toggleGPS);

    // V9 Log Generation (Point 13)
    document.getElementById('btn-export-logs')?.addEventListener('click', () => {
        const logData = window.appLogs.join('\n');
        const blob = new Blob([logData], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `LMD_Logs_${Date.now()}.txt`;
        a.click();
    });

    // Exports
    document.getElementById('export-pdf')?.addEventListener('click', () => Exporter.generatePDF());
    document.getElementById('export-png')?.addEventListener('click', async () => {
        const img = await Exporter.generatePNG();
        if (img) {
            const link = document.createElement("a"); link.href = img; link.download = `Draft_${state.user.hlbId}.png`; link.click();
        }
    });
    document.getElementById('export-csv')?.addEventListener('click', () => Exporter.generateCSV());
    document.getElementById('export-json')?.addEventListener('click', () => Exporter.generateJSON());

    document.getElementById('btn-close-inspector')?.addEventListener('click', () => {
        const panel = document.getElementById('inspector-panel');
        if(panel) {
            panel.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
            setTimeout(() => panel.classList.add('hidden'), 200);
        }
        document.getElementById('ui-overlay')?.classList.add('hidden');
        deselectAll(); 
    });

    // Strict Type-Safe Popover Close Logic
    document.addEventListener('click', (e) => {
        if (e.target instanceof Element) {
            const popover = document.getElementById('popover-project-actions');
            if (popover && !e.target.closest('.project-menu-trigger') && !e.target.closest('#popover-project-actions')) {
                popover.classList.add('hidden');
            }
        }
    });
}
// ==========================================
// PROJECT DRAWER LOGIC
// ==========================================
function initProjectDrawerLogic() {
    const btnMenu = document.getElementById('btn-menu');
    const settingsMenu = document.getElementById('settings-menu');
    const uiOverlay = document.getElementById('ui-overlay');

    const toggleMenu = () => {
        if (!settingsMenu || !uiOverlay) return;
        const isClosed = settingsMenu.classList.contains('translate-x-full');
        if (isClosed) {
            renderProjectCards(); 
            settingsMenu.classList.remove('translate-x-full');
            uiOverlay.classList.remove('hidden');
        } else {
            settingsMenu.classList.add('translate-x-full');
            uiOverlay.classList.add('hidden');
        }
    };
    
    btnMenu?.addEventListener('click', toggleMenu);
    document.getElementById('btn-close-menu')?.addEventListener('click', toggleMenu);
    uiOverlay?.addEventListener('click', toggleMenu);
}

export function renderProjectCards() {
    const container = document.getElementById('project-list-container');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(state.projects).forEach(id => {
        const p = state.projects[id];
        const isActive = (id === state.activeProjectId);
        
        const cardHTML = `
            <div class="project-card relative p-3.5 rounded-xl border ${isActive ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-gray-50 border-gray-200'} cursor-pointer" data-id="${id}">
                <div class="flex justify-between items-start pointer-events-none">
                    <div>
                        <h4 class="font-bold text-sm ${isActive ? 'text-blue-800' : 'text-gray-700'}">${p.name}</h4>
                        <p class="text-[10px] text-gray-500 mt-0.5">${p.isAreaLocked ? p.features.length + ' Features' : 'Empty Slot'}</p>
                    </div>
                </div>
                <button class="absolute top-3 right-3 p-1 text-gray-400 project-menu-trigger" data-id="${id}">⋮</button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });

    document.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target instanceof Element && e.target.classList.contains('project-menu-trigger')) return; 
            
            const targetId = card.getAttribute('data-id');
            if (targetId && targetId !== state.activeProjectId) {
                pendingTargetProjectId = targetId;
                openSwitchModal();
            }
        });
    });

    document.querySelectorAll('.project-menu-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.currentTarget instanceof Element) {
                pendingTargetProjectId = e.currentTarget.getAttribute('data-id');
                const popover = document.getElementById('popover-project-actions');
                const rect = e.currentTarget.getBoundingClientRect();
                if (popover) {
                    popover.style.top = `${rect.bottom + 5}px`;
                    popover.style.right = `${window.innerWidth - rect.right}px`;
                    popover.style.left = 'auto'; 
                    popover.classList.remove('hidden');
                }
            }
        });
    });
}

function openSwitchModal() {
    const modal = document.getElementById('modal-project-switch');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.remove('scale-95', 'opacity-0'), 10);
    }
}

function closeSwitchModal() {
    const modal = document.getElementById('modal-project-switch');
    if (modal) {
        modal.classList.add('scale-95', 'opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
    }
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'fixed bottom-10 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full text-xs z-[9999]';
    t.innerText = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}