/**
 * MAP LAYOUT DRAFTER - Bootstrapper & UI Controller
 * Handles Phase transitions, FAB Menu logic, and the Black Box Logger.
 */

import { state, CATEGORIES, TOOLS } from './config.js';
import { initMap, lockArea } from './map.js';
import { initSymbols, redrawAllFeatures } from './symbol.js'; 
import { generatePDF } from './export.js'; 
import { loadDraftLocally, clearDraft } from './storage.js';

// ==========================================
// 1. ELITE BLACK BOX LOGGER (Field Diagnostics)
// ==========================================
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

function downloadCrashLog() {
    const blob = new Blob([window.appLogs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MapDrafter_Diagnostic_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    alert("Diagnostic Log Downloaded.");
}

// ==========================================
// 2. APP INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("Map Layout Drafter: Boot Sequence Initiated.");

    // Prevent default browser zooming/scrolling
    document.addEventListener('touchmove', (e) => {
        if (e.scale !== 1 && state.ui.currentCategory !== CATEGORIES.HAND) { 
            e.preventDefault(); 
        } 
    }, { passive: false });

    initMap();
    initSymbols();
    
    // THE AMNESIA FIX: Try to load saved data first
    const hasSavedData = loadDraftLocally();
    if (hasSavedData && state.features.length > 0) {
        console.log("Found existing draft. Bypassing Phase 1.");
        document.getElementById('setup-layer').classList.add('hidden');
        document.getElementById('ui-layer').classList.remove('hidden');
        document.getElementById('display-area-id').innerText = `Area: ${state.user.hlbId}`;
        lockArea();
        redrawAllFeatures(); // Repaint the map
    } else {
        initPhase1Setup(); // Normal start
    }

    initFABLogic();
    initUIControls();
});

// ==========================================
// 3. PHASE 1: AREA SETUP LOGIC
// ==========================================
function initPhase1Setup() {
    const btnLock = document.getElementById('btn-lock-area');
    const inputName = document.getElementById('setup-name');
    const inputArea = document.getElementById('setup-area');

    // Enable button only if both fields have text
    const checkInputs = () => {
        if (inputName.value.trim() !== "" && inputArea.value.trim() !== "") {
            btnLock.removeAttribute('disabled');
        } else {
            btnLock.setAttribute('disabled', 'true');
        }
    };

    inputName.addEventListener('input', checkInputs);
    inputArea.addEventListener('input', checkInputs);

    btnLock.addEventListener('click', () => {
        // Save metadata to central state
        state.user.enumeratorName = inputName.value.trim();
        state.user.hlbId = inputArea.value.trim();
        state.ui.phase = 2;

        console.log(`Phase 1 Complete. Area Locked for: ${state.user.hlbId}`);

        // Update UI Text
        document.getElementById('display-area-id').innerText = `Area: ${state.user.hlbId}`;

        // Lock the Map Boundaries
        lockArea();

        // Transition UI
        document.getElementById('setup-layer').classList.add('hidden');
        document.getElementById('ui-layer').classList.remove('hidden');
    });
}

// ==========================================
// 4. THE FAB MENU ENGINE (Phase 2)
// ==========================================
function initFABLogic() {
    const fabMain = document.getElementById('fab-main');
    const fabCategories = document.getElementById('fab-categories');
    const fabSubmenu = document.getElementById('fab-submenu');
    
    // Toggle Level 1 Categories
    fabMain.addEventListener('click', () => {
        fabCategories.classList.toggle('hidden');
        fabCategories.classList.toggle('flex');
        fabSubmenu.classList.add('hidden'); // Always hide submenu when toggling main
    });

    // Handle Level 1 Category Clicks
    document.querySelectorAll('.fab-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.currentTarget.getAttribute('data-cat');
            state.ui.currentCategory = category;
            
            // Update Main FAB Icon to reflect chosen category
            fabMain.innerHTML = e.currentTarget.innerHTML;
            
            // Open Level 2 Submenu
            populateSubMenu(category);
            
            // Hide the vertical fan
            fabCategories.classList.add('hidden');
            fabCategories.classList.remove('flex');
        });
    });
}

function populateSubMenu(category) {
    const submenu = document.getElementById('fab-submenu');
    submenu.innerHTML = ''; // Clear previous tools
    
    let toolsHTML = '';

    if (category === CATEGORIES.HAND) {
        submenu.classList.add('hidden');
        setActiveTool(TOOLS.PAN);
        return; // Hand has no sub-menu
    } else if (category === CATEGORIES.ERASER) {
        submenu.classList.add('hidden');
        setActiveTool(TOOLS.ERASER);
        return; // Eraser has no sub-menu
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

    // Attach listeners to new tool buttons
    submenu.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setActiveTool(e.currentTarget.getAttribute('data-tool'));
            
            // Highlight active tool visually
            submenu.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });
}

function setActiveTool(toolId) {
    state.ui.currentTool = toolId;
    console.log(`Tool Switched to: ${toolId}`);
}

// ==========================================
// 5. GENERIC UI CONTROLS
// ==========================================
function initUIControls() {
    // Transparency Slider
    const slider = document.getElementById('smokiness-slider');
    const tracingLayer = document.getElementById('tracing-layer');

    slider.addEventListener('input', (e) => {
        state.ui.smokiness = e.target.value;
        const opacity = e.target.value / 100;
        tracingLayer.style.backgroundColor = `rgba(255, 255, 255, ${opacity})`;
    });

    // Export PDF
    document.getElementById('btn-export').addEventListener('click', () => {
        generatePDF();
    });

    // Hidden Black Box Trigger (Tap Area ID 5 times)
    let tapCount = 0;
    let tapTimer;
    document.getElementById('display-area-id').addEventListener('click', () => {
        tapCount++;
        clearTimeout(tapTimer);
        if (tapCount >= 5) {
            downloadCrashLog();
            tapCount = 0;
        }
        tapTimer = setTimeout(() => { tapCount = 0; }, 2000);
    });

    // Slide-out Menu Wiring
    const btnMenu = document.getElementById('btn-menu');
    const btnCloseMenu = document.getElementById('btn-close-menu');
    const settingsMenu = document.getElementById('settings-menu');
    const menuOverlay = document.getElementById('menu-overlay');

    const toggleMenu = () => {
        const isClosed = settingsMenu.classList.contains('-translate-x-full');
        if (isClosed) {
            settingsMenu.classList.remove('-translate-x-full');
            menuOverlay.classList.remove('hidden');
            
            // Update Live Stats when opening
            document.getElementById('stat-bldg').innerText = state.features.filter(f => f.category === CATEGORIES.BUILDING).length;
            document.getElementById('stat-lm').innerText = state.features.filter(f => f.category === CATEGORIES.LANDMARK).length;
            document.getElementById('stat-lines').innerText = state.features.filter(f => f.category === CATEGORIES.LINE).length;
        } else {
            settingsMenu.classList.add('-translate-x-full');
            menuOverlay.classList.add('hidden');
        }
    };

    btnMenu.addEventListener('click', toggleMenu);
    btnCloseMenu.addEventListener('click', toggleMenu);
    menuOverlay.addEventListener('click', toggleMenu);

    // Emergency Reset Wiring
    document.getElementById('btn-emergency-reset').addEventListener('click', () => {
        clearDraft();
    });
}