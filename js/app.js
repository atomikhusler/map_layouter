/**
 * MAP LAYOUT DRAFTER - Main Controller (V7.1 Bulletproof Master)
 * Cures: Screen Freezes, Blur Fog, and Android Back-Button Crashes.
 */

import { state, CATEGORIES, TOOLS, getActiveProject } from './config.js';
import { initMap, lockArea, map, toggleGPS } from './map.js';
import { initSymbols, redrawAllFeatures } from './symbol.js'; 
import * as Exporter from './export.js'; 
import { loadDraftLocally, clearDraft, saveDraftLocally } from './storage.js';
import { switchProject, renameProject, deleteProject } from './projectManager.js';

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

// Modals State
let pendingTargetProjectId = null;

document.addEventListener('DOMContentLoaded', () => {
    
    // ELITE FIX: Prevent Android hardware back-button from crashing the WebView via alerts
    window.history.pushState(null, null, window.location.href);
    window.onpopstate = function () {
        window.history.pushState(null, null, window.location.href);
        saveDraftLocally(); 
        
        // Show non-blocking Toast instead of thread-blocking alert()
        const existingToast = document.getElementById('back-toast');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.id = 'back-toast';
        toast.className = 'absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-full text-xs font-bold z-[9999] shadow-lg text-center transition-opacity duration-300 opacity-0 pointer-events-none';
        toast.innerText = 'App navigation protected. Use the on-screen menus.';
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.remove('opacity-0'), 10);
        setTimeout(() => {
            toast.classList.add('opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    };

    // ELITE FIX: Force save to Omni-Vault if the user manually closes the browser tab
    window.addEventListener('beforeunload', () => {
        saveDraftLocally();
    });

    // Prevent Android zoom freezing
    document.addEventListener('touchmove', (e) => {
        if (e.scale && e.scale !== 1 && state.ui.currentCategory !== CATEGORIES.HAND) { 
            e.preventDefault(); 
        } 
    }, { passive: false });

    // 1. Load Data & Boot Engines
    const hasSavedData = loadDraftLocally();
    initMap();
    initSymbols();
    
    // 2. Re-apply UI Preferences
    if (state.ui.isDarkMode) {
        document.body.classList.add('dark');
        const darkToggle = document.getElementById('toggle-dark-mode');
        if (darkToggle) darkToggle.checked = true;
    }

    if (state.ui.smokiness) {
        const slider = document.getElementById('smokiness-slider');
        if (slider) slider.value = state.ui.smokiness;
        const opacity = 1 - (state.ui.smokiness / 100);
        const tilePane = document.querySelector('.leaflet-tile-pane');
        if (tilePane) tilePane.style.opacity = opacity.toString();
    }

    // 3. Context-Aware Boot: Check if the *active* project has a locked area
    const activeProject = getActiveProject();
    if (hasSavedData && activeProject.isAreaLocked) {
        document.getElementById('setup-layer').classList.add('hidden');
        document.getElementById('ui-layer').classList.remove('hidden');
        document.getElementById('display-area-id').innerText = `Area: ${state.user.hlbId || "Unknown"} (${activeProject.name})`;
        
        lockArea();
        redrawAllFeatures(); 
    } else {
        initPhase1Setup(); 
    }

    // 4. Initialize UI Listeners
    initDockLogic();
    initUIControls();
    initProjectDrawerLogic();
});

// ==========================================
// SETUP PHASE (Area Search & Lock)
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
            
            // ELITE FIX: Completely overwrite the class tree to guarantee fog removal
            const setupLayer = document.getElementById('setup-layer');
            if(setupLayer) {
                setupLayer.className = "absolute inset-0 z-[70] pointer-events-none flex flex-col items-center justify-center";
            }
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
                        li.className = 'p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm border-b border-gray-100 dark:border-gray-700 last:border-0 text-gray-700 dark:text-gray-200';
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
                suggestionsBox.innerHTML = '<li class="p-3 text-sm text-red-500">Network Error.</li>';
                suggestionsBox.classList.remove('hidden');
            } finally {
                btnSearch.innerText = "Search";
            }
        });

        const searchContainer = searchInput.parentElement.parentElement;
        if (searchContainer) searchContainer.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', () => {
            if (!suggestionsBox.classList.contains('hidden')) suggestionsBox.classList.add('hidden');
        });
    }

    if (btnLock) {
        btnLock.addEventListener('click', () => {
            state.user.enumeratorName = inputName ? inputName.value.trim() : "Unknown";
            state.user.hlbId = inputArea ? inputArea.value.trim() : "Unknown";
            state.ui.phase = 2;

            const activeProject = getActiveProject();
            document.getElementById('display-area-id').innerText = `Area: ${state.user.hlbId} (${activeProject.name})`;

            lockArea(); 
            saveDraftLocally();

            document.getElementById('setup-layer').classList.add('hidden');
            document.getElementById('ui-layer').classList.remove('hidden');
        });
    }
}

// ==========================================
// FLOATING DOCK LOGIC
// ==========================================
function initDockLogic() {
    const dockButtons = document.querySelectorAll('.fab-cat-btn');
    dockButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            dockButtons.forEach(b => {
                b.classList.remove('bg-blue-100', 'text-blue-600', 'dark:bg-blue-900/40', 'dark:text-blue-400');
                b.classList.add('text-gray-600', 'dark:text-gray-300');
            });
            e.currentTarget.classList.remove('text-gray-600', 'dark:text-gray-300');
            e.currentTarget.classList.add('bg-blue-100', 'text-blue-600', 'dark:bg-blue-900/40', 'dark:text-blue-400');

            const category = e.currentTarget.getAttribute('data-cat');
            state.ui.currentCategory = category;
            populateSubMenu(category);
        });
    });

    const defaultBtn = document.querySelector('.fab-cat-btn[data-cat="hand"]');
    if (defaultBtn) defaultBtn.click();
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
            <button class="tool-btn w-10 h-10 flex justify-center items-center bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent active:scale-90 transition-all" data-tool="${TOOLS.PUCCA_RES}"><div class="w-5 h-5 border-2 border-black bg-white"></div></button>
            <button class="tool-btn w-10 h-10 flex justify-center items-center bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent active:scale-90 transition-all" data-tool="${TOOLS.PUCCA_NON_RES}"><div class="w-5 h-5 border-2 border-black" style="background: repeating-linear-gradient(45deg, #000 0, #000 1px, #fff 0, #fff 4px);"></div></button>
            <button class="tool-btn w-10 h-10 flex justify-center items-center bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent active:scale-90 transition-all" data-tool="${TOOLS.KUTCHA_RES}"><div class="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent border-b-black"></div></button>
            <button class="tool-btn w-10 h-10 flex justify-center items-center bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent active:scale-90 transition-all" data-tool="${TOOLS.KUTCHA_NON_RES}"><div class="relative w-0 h-0 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent border-b-black"><div class="absolute top-[2px] -left-[6px] w-[12px] h-[12px]" style="background: repeating-linear-gradient(45deg, #000 0, #000 1px, #fff 0, #fff 4px);"></div></div></button>
        `;
    } else if (category === CATEGORIES.LINE) {
        toolsHTML = `
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-xs font-bold dark:text-white active:scale-90 transition-all" data-tool="${TOOLS.LINE_MAINROAD}">Main</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-xs font-bold dark:text-white active:scale-90 transition-all" data-tool="${TOOLS.LINE_STRAIGHT}">Straight</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-xs font-bold dark:text-white active:scale-90 transition-all" data-tool="${TOOLS.LINE_PATHWAY}">Path</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-xs font-bold dark:text-white active:scale-90 transition-all" data-tool="${TOOLS.LINE_FREEHAND}">Draw</button>
        `;
    } else if (category === CATEGORIES.LANDMARK) {
        toolsHTML = `
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-xs font-bold dark:text-white active:scale-90 transition-all" data-tool="${TOOLS.LM_TAP}">Tap</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-xs font-bold dark:text-white active:scale-90 transition-all" data-tool="${TOOLS.LM_TEMPLE}">Temple</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-xs font-bold dark:text-white active:scale-90 transition-all" data-tool="${TOOLS.LM_SQUARE}">Square</button>
            <button class="tool-btn px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-transparent text-xs font-bold dark:text-white active:scale-90 transition-all" data-tool="${TOOLS.LM_CUSTOM}">(+)</button>
        `;
    }

    submenu.innerHTML = toolsHTML;
    submenu.classList.remove('hidden');

    submenu.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setActiveTool(e.currentTarget.getAttribute('data-tool'));
            submenu.querySelectorAll('.tool-btn').forEach(b => {
                b.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
                b.classList.add('border-transparent', 'bg-gray-100', 'dark:bg-gray-700');
            });
            e.currentTarget.classList.remove('border-transparent', 'bg-gray-100', 'dark:bg-gray-700');
            e.currentTarget.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
        });
    });

    const firstTool = submenu.querySelector('.tool-btn');
    if (firstTool) firstTool.click();
}

function setActiveTool(toolId) {
    state.ui.currentTool = toolId;
}

// ==========================================
// UI CONTROLS & EXPORTS
// ==========================================
function initUIControls() {
    
    const brandingPill = document.getElementById('branding-pill');
    let tapCount = 0; let tapTimer;
    if (brandingPill) {
        brandingPill.addEventListener('click', () => {
            tapCount++; clearTimeout(tapTimer);
            if (tapCount >= 5) {
                tapCount = 0;
                if(confirm("DEVELOPER MODE: Download internal error logs?")) {
                    const blob = new Blob([window.appLogs.join('\n') || "No errors."], { type: 'text/plain' });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = `LMD_Logs_${Date.now()}.txt`;
                    link.click();
                }
            }
            tapTimer = setTimeout(() => tapCount = 0, 1500);
        });
    }

    document.getElementById('toggle-dark-mode').addEventListener('change', (e) => {
        state.ui.isDarkMode = e.target.checked; 
        if (e.target.checked) document.body.classList.add('dark');
        else document.body.classList.remove('dark');
        saveDraftLocally();
    });

    const slider = document.getElementById('smokiness-slider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            state.ui.smokiness = e.target.value;
            const opacity = 1 - (e.target.value / 100);
            const tilePane = document.querySelector('.leaflet-tile-pane');
            if (tilePane) tilePane.style.opacity = opacity.toString();
        });
        slider.addEventListener('change', () => saveDraftLocally());
    }

    document.getElementById('btn-undo').addEventListener('click', () => {
        const activeProject = getActiveProject();
        if (activeProject.undoStack.length > 0) {
            const currentState = activeProject.undoStack.pop();
            activeProject.redoStack.push(currentState);
            activeProject.features = activeProject.undoStack.length > 0 ? JSON.parse(JSON.stringify(activeProject.undoStack[activeProject.undoStack.length - 1])) : [];
            redrawAllFeatures();
            saveDraftLocally();
        }
    });

    document.getElementById('btn-redo').addEventListener('click', () => {
        const activeProject = getActiveProject();
        if (activeProject.redoStack.length > 0) {
            const nextState = activeProject.redoStack.pop();
            activeProject.undoStack.push(nextState);
            activeProject.features = JSON.parse(JSON.stringify(nextState));
            redrawAllFeatures();
            saveDraftLocally();
        }
    });

    document.getElementById('btn-refresh').addEventListener('click', () => redrawAllFeatures());
    document.getElementById('btn-toggle-gps').addEventListener('click', toggleGPS);

    document.getElementById('export-pdf').addEventListener('click', () => { if (Exporter.generatePDF) Exporter.generatePDF(); });
    document.getElementById('export-png').addEventListener('click', async () => {
        if (Exporter.generatePNG) {
            const imgData = await Exporter.generatePNG();
            if (imgData) {
                const link = document.createElement("a"); link.href = imgData; link.download = `Map_${state.user.hlbId}.png`; link.click();
            }
        }
    });
    document.getElementById('export-csv').addEventListener('click', () => { if (Exporter.generateCSV) Exporter.generateCSV(); });
    document.getElementById('export-json').addEventListener('click', () => { if (Exporter.generateJSON) Exporter.generateJSON(); });

    document.getElementById('btn-emergency-reset').addEventListener('click', () => {
        if(confirm("CRITICAL WARNING: This eradicates the Omni-Vault memory permanently. Proceed?")) clearDraft();
    });

    document.getElementById('btn-close-inspector').addEventListener('click', () => {
        document.getElementById('inspector-panel').classList.add('scale-95', 'opacity-0', 'pointer-events-none');
        setTimeout(() => document.getElementById('inspector-panel').classList.add('hidden'), 200);
        document.getElementById('ui-overlay').classList.add('opacity-0', 'pointer-events-none');
    });
}
// ==========================================
// PROJECT DRAWER LOGIC
// ==========================================
function initProjectDrawerLogic() {
    const btnMenu = document.getElementById('btn-menu');
    const btnCloseMenu = document.getElementById('btn-close-menu');
    const settingsMenu = document.getElementById('settings-menu');
    const uiOverlay = document.getElementById('ui-overlay');
    const popover = document.getElementById('popover-project-actions');
    const switchModal = document.getElementById('modal-project-switch');

    const toggleMenu = () => {
        if (!settingsMenu || !uiOverlay) return;
        const isClosed = settingsMenu.classList.contains('translate-x-full');
        if (isClosed) {
            renderProjectCards(); 
            settingsMenu.classList.remove('translate-x-full');
            uiOverlay.classList.remove('hidden');
            
            // Allow display:block to execute before fading in
            setTimeout(() => {
                uiOverlay.classList.remove('opacity-0', 'pointer-events-none');
                uiOverlay.classList.add('opacity-100', 'pointer-events-auto');
            }, 10);
        } else {
            settingsMenu.classList.add('translate-x-full');
            
            // ELITE FIX: Eradicate invisible shield causing screen freezes
            uiOverlay.classList.remove('opacity-100', 'pointer-events-auto');
            uiOverlay.classList.add('opacity-0', 'pointer-events-none');
            popover.classList.add('hidden'); 
            
            // Crucial: Put 'hidden' back after the fade animation finishes
            setTimeout(() => {
                if (settingsMenu.classList.contains('translate-x-full')) {
                    uiOverlay.classList.add('hidden');
                }
            }, 300);
        }
    };
    
    btnMenu.addEventListener('click', toggleMenu);
    btnCloseMenu.addEventListener('click', toggleMenu);
    uiOverlay.addEventListener('click', () => {
        if (!settingsMenu.classList.contains('translate-x-full')) toggleMenu();
        if (!switchModal.classList.contains('hidden')) closeSwitchModal();
        popover.classList.add('hidden');
    });

    document.getElementById('btn-cancel-switch').addEventListener('click', closeSwitchModal);
    document.getElementById('btn-confirm-switch').addEventListener('click', () => {
        if (pendingTargetProjectId) {
            switchProject(pendingTargetProjectId);
            renderProjectCards(); 
        }
        closeSwitchModal();
        toggleMenu(); 
    });

    document.getElementById('action-rename-project').addEventListener('click', () => {
        if (!pendingTargetProjectId) return;
        const project = state.projects[pendingTargetProjectId];
        const newName = prompt("Rename Project:", project.name);
        if (newName) {
            renameProject(pendingTargetProjectId, newName);
            renderProjectCards();
        }
        popover.classList.add('hidden');
    });

    document.getElementById('action-delete-project').addEventListener('click', () => {
        if (!pendingTargetProjectId) return;
        if (confirm(`CRITICAL: Permanently delete all map data for "${state.projects[pendingTargetProjectId].name}"?`)) {
            deleteProject(pendingTargetProjectId);
            renderProjectCards();
        }
        popover.classList.add('hidden');
    });
}

export function renderProjectCards() {
    const container = document.getElementById('project-list-container');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(state.projects).forEach(id => {
        const p = state.projects[id];
        const isActive = (id === state.activeProjectId);
        const featureCount = p.features ? p.features.length : 0;
        const statusText = isActive ? "Active Project" : (p.isAreaLocked ? `${featureCount} Features` : "Empty Slot");
        
        const cardClass = isActive 
            ? "project-card relative bg-blue-50 dark:bg-blue-900/20 p-3.5 rounded-xl border-2 border-blue-500 shadow-sm cursor-pointer transition-all"
            : "project-card relative bg-gray-50 dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-400 transition-all";
            
        const titleClass = isActive ? "font-bold text-sm text-blue-800 dark:text-blue-300" : "font-bold text-sm text-gray-700 dark:text-gray-200";
        const subClass = isActive ? "text-[10px] text-blue-600/80 dark:text-blue-400 mt-0.5" : "text-[10px] text-gray-500 mt-0.5";

        const cardHTML = `
            <div id="${id}_card" class="${cardClass}" data-id="${id}">
                <div class="flex justify-between items-start pointer-events-none">
                    <div>
                        <h4 class="${titleClass}">${p.name}</h4>
                        <p class="${subClass}">${statusText}</p>
                    </div>
                </div>
                <button class="absolute top-3 right-3 p-1 text-gray-400 hover:text-blue-600 pointer-events-auto z-10 project-menu-trigger" data-id="${id}">⋮</button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });

    document.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('project-menu-trigger')) return; 
            
            const targetId = card.getAttribute('data-id');
            if (targetId !== state.activeProjectId && state.projects[targetId].isAreaLocked) {
                pendingTargetProjectId = targetId;
                openSwitchModal(state.projects[targetId].name);
            } else if (targetId !== state.activeProjectId && !state.projects[targetId].isAreaLocked) {
                switchProject(targetId);
                renderProjectCards();
            }
        });
    });

    document.querySelectorAll('.project-menu-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            pendingTargetProjectId = e.currentTarget.getAttribute('data-id');
            const popover = document.getElementById('popover-project-actions');
            
            const rect = e.currentTarget.getBoundingClientRect();
            popover.style.top = `${rect.bottom + 5}px`;
            popover.style.right = `${window.innerWidth - rect.right}px`;
            popover.style.left = 'auto'; 
            
            popover.classList.remove('hidden');
        });
    });
}

function openSwitchModal(projectName) {
    const modal = document.getElementById('modal-project-switch');
    const overlay = document.getElementById('ui-overlay');
    overlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    overlay.classList.add('opacity-100', 'z-[110]', 'pointer-events-auto'); 
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        modal.classList.remove('scale-95', 'opacity-0');
    }, 10);
}

function closeSwitchModal() {
    const modal = document.getElementById('modal-project-switch');
    const overlay = document.getElementById('ui-overlay');
    
    modal.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        overlay.classList.remove('z-[110]');
        // Only hide overlay if drawer isn't active
        const settingsMenu = document.getElementById('settings-menu');
        if (settingsMenu && settingsMenu.classList.contains('translate-x-full')) {
             overlay.classList.add('hidden', 'opacity-0', 'pointer-events-none');
             overlay.classList.remove('opacity-100', 'pointer-events-auto');
        }
    }, 200);
}