/**
 * MAP LAYOUT DRAFTER - Elite Drafting Engine (V7 Master)
 * Features: Geometric Shapes, Scale Resizing, and Multi-Project Routing.
 */

import { state, CATEGORIES, TOOLS, getActiveProject } from './config.js';
import { map } from './map.js';
import { saveDraftLocally } from './storage.js';

export const featureLayer = L.featureGroup();
let currentBldgNo = 1;

// Line Drawing State
let isDrawingLine = false;
let activePolylineGroup = null; 
let activeCoordinates = [];

// Inspector State
let activeInspectorFeatureId = null;
let activeInspectorMarker = null;

export function initSymbols() {
    featureLayer.addTo(map);
    setupTouchPhysics();
    setupMapClickRouter();
    initInspectorUI();
    
    // Smooth dynamic scaling bound to map events
    map.on('zoom', scaleDraftSymbols);
    map.on('zoomend', scaleDraftSymbols);

    console.log("[Drafting Engine] V7 Initialized: Geometric Shapes & Scale Engine Online.");
}

// ==========================================
// 1. ELITE TOUCH PHYSICS & RUBBER-BANDING
// ==========================================
function setupTouchPhysics() {
    const mapContainer = document.getElementById('map');

    mapContainer.addEventListener('touchstart', (e) => {
        if (state.ui.currentCategory === CATEGORIES.HAND) {
            map.dragging.enable();
            return;
        }

        if (e.touches.length === 1) {
            map.dragging.disable();
            if (state.ui.currentCategory === CATEGORIES.LINE) {
                const rect = mapContainer.getBoundingClientRect();
                const x = e.touches[0].clientX - rect.left;
                const y = e.touches[0].clientY - rect.top;
                const latlng = map.containerPointToLatLng([x, y]);
                startLine(latlng);
            }
        } else if (e.touches.length > 1) {
            map.dragging.enable();
            if (isDrawingLine) finishLine();
        }
    }, { passive: false });

    mapContainer.addEventListener('touchmove', (e) => {
        if (isDrawingLine && e.touches.length === 1) {
            e.preventDefault(); 
            const rect = mapContainer.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;
            const latlng = map.containerPointToLatLng([x, y]);
            updateLine(latlng);
        }
    }, { passive: false });

    mapContainer.addEventListener('touchend', (e) => {
        if (isDrawingLine && e.touches.length === 0) {
            finishLine();
        }
    });
}

function setupMapClickRouter() {
    map.on('click', (e) => {
        const cat = state.ui.currentCategory;
        const tool = state.ui.currentTool;

        if (cat === CATEGORIES.BUILDING) placeBuilding(e.latlng, tool);
        else if (cat === CATEGORIES.LANDMARK) placeLandmark(e.latlng, tool);
    });
}

// ==========================================
// 2. DOUBLE-TAP EDIT & FEATURE EVENTS
// ==========================================
function bindFeatureEvents(layer, featureData) {
    layer.on('click', () => handleFeatureTap(featureData, layer));
    layer.on('dblclick', () => handleRename(featureData, layer));
}

function handleRename(feature, layer) {
    if (feature.category === CATEGORIES.LANDMARK || feature.category === CATEGORIES.LINE) {
        const rawName = feature.label.replace(/\[|\]/g, '');
        const newName = prompt(`Rename ${feature.category}:`, rawName);
        
        if (newName && newName.trim() !== "") {
            feature.label = `[${newName.trim()}]`;
            
            if (feature.category === CATEGORIES.LANDMARK) {
                layer.setIcon(generateLandmarkIcon(feature.type, feature.label, feature.scale || 1));
                scaleDraftSymbols();
            } else if (feature.category === CATEGORIES.LINE) {
                layer.eachLayer(l => {
                    if (l.options.color === '#000' || l.options.color === '#4b5563') {
                        const originalColor = l.options.color;
                        l.setStyle({ color: '#3b82f6' });
                        setTimeout(() => l.setStyle({ color: originalColor }), 500);
                    }
                });
            }
            saveState();
        }
    }
}

// ==========================================
// 3. ELITE VECTOR GENERATORS (Geometry Engine)
// ==========================================
function getInitials(fullName) {
    const raw = fullName.replace(/\[|\]/g, '').trim();
    const parts = raw.split(' ');
    let initials = parts[0].charAt(0).toUpperCase();
    if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        if (!isNaN(lastPart)) initials += lastPart; 
        else initials += lastPart.charAt(0).toUpperCase(); 
    }
    return initials.substring(0, 3); 
}

function generateLandmarkIcon(tool, fullName, scaleMultiplier = 1) {
    const initials = getInitials(fullName);
    let iconHtml = '';

    // The Geometric Shape Engine
    if (tool === TOOLS.LM_SQUARE) {
        iconHtml = `<div class="w-8 h-8 border-[2.5px] border-black bg-white shadow-md flex items-center justify-center font-black text-xs text-black">${initials}</div>`;
    } else if (tool === TOOLS.LM_PENTAGON) {
        iconHtml = `<div class="relative w-9 h-9 flex items-center justify-center drop-shadow-md"><svg width="36" height="36" viewBox="0 0 36 36" class="absolute inset-0"><polygon points="18,3 34,14 28,32 8,32 2,14" fill="white" stroke="black" stroke-width="2.5"/></svg><span class="relative z-10 font-black text-xs text-black mt-1">${initials}</span></div>`;
    } else if (tool === TOOLS.LM_HEXAGON) {
        iconHtml = `<div class="relative w-9 h-9 flex items-center justify-center drop-shadow-md"><svg width="36" height="36" viewBox="0 0 36 36" class="absolute inset-0"><polygon points="18,3 32,10 32,26 18,33 4,26 4,10" fill="white" stroke="black" stroke-width="2.5"/></svg><span class="relative z-10 font-black text-xs text-black">${initials}</span></div>`;
    } else {
        // Default Circle
        iconHtml = `<div class="w-8 h-8 rounded-full border-[2px] border-black bg-white shadow-md flex items-center justify-center font-black text-xs text-black">${initials}</div>`;
    }

    const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center transform-origin-center transition-transform duration-75" data-scale="${scaleMultiplier}">${iconHtml}</div>`;
    return L.divIcon({ className: 'draft-symbol', html: wrapperHtml, iconSize: [44, 44], iconAnchor: [22, 22] });
}

function generateBuildingIcon(tool, bldgNo, houseCount, scaleMultiplier = 1) {
    let iconHtml = '';
    const hatch = `background: repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 6px);`;

    if (tool === TOOLS.PUCCA_RES) {
        iconHtml = `<div class="w-7 h-7 border-[2px] border-black bg-white shadow flex items-center justify-center font-bold text-xs">${bldgNo}</div><div class="text-[9px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    } else if (tool === TOOLS.PUCCA_NON_RES) {
        iconHtml = `<div class="w-7 h-7 border-[2px] border-black shadow flex items-center justify-center font-bold text-xs bg-white" style="${hatch}"><span class="bg-white/90 px-[1px] rounded">${bldgNo}</span></div><div class="text-[9px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    } else if (tool === TOOLS.KUTCHA_RES) {
        iconHtml = `<div class="relative w-8 h-8 flex items-center justify-center drop-shadow"><svg width="28" height="28" viewBox="0 0 28 28" class="absolute inset-0"><polygon points="14,2 26,26 2,26" fill="white" stroke="black" stroke-width="2"/></svg><span class="relative z-10 text-[9px] font-bold text-black mt-2">${bldgNo}</span></div><div class="text-[9px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    } else if (tool === TOOLS.KUTCHA_NON_RES) {
        iconHtml = `<div class="relative w-8 h-8 flex items-center justify-center drop-shadow"><svg width="28" height="28" viewBox="0 0 28 28" class="absolute inset-0"><defs><pattern id="hatch" width="4" height="4" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="4" stroke="black" stroke-width="1"/></pattern></defs><polygon points="14,2 26,26 2,26" fill="url(#hatch)" stroke="black" stroke-width="2"/><polygon points="14,2 26,26 2,26" fill="transparent" stroke="black" stroke-width="2"/></svg><span class="relative z-10 text-[9px] font-bold text-black bg-white/90 px-[2px] rounded mt-2">${bldgNo}</span></div><div class="text-[9px] font-bold text-black mt-0.5 text-shadow-white drop-shadow-md">(${houseCount})</div>`;
    }

    const wrapperHtml = `<div class="marker-scaler w-full h-full flex flex-col items-center justify-center transform-origin-center transition-transform duration-75" data-scale="${scaleMultiplier}">${iconHtml}</div>`;
    return L.divIcon({ className: 'draft-symbol', html: wrapperHtml, iconSize: [44, 44], iconAnchor: [22, 22] });
}

function placeBuilding(latlng, tool) {
    const featureId = `bldg_${Date.now()}`;
    const bNo = currentBldgNo.toString();
    const hC = "1";
    const scale = 1.0;

    const divIcon = generateBuildingIcon(tool, bNo, hC, scale);
    const marker = L.marker(latlng, { icon: divIcon }).addTo(featureLayer);

    const featureData = { id: featureId, category: CATEGORIES.BUILDING, type: tool, bldgNo: bNo, houseCount: hC, scale: scale, coordinates: [latlng.lat, latlng.lng] };
    
    bindFeatureEvents(marker, featureData);
    saveState(featureData);
    
    currentBldgNo++;
    scaleDraftSymbols(); 
}

function placeLandmark(latlng, tool) {
    const featureId = `lm_${Date.now()}`;
    let baseName = tool === TOOLS.LM_CUSTOM ? "Landmark 1" : tool.replace('lm_', '');
    baseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    
    const label = `[${baseName}]`;
    const scale = 1.0;
    const divIcon = generateLandmarkIcon(tool, label, scale);
    
    const marker = L.marker(latlng, { icon: divIcon }).addTo(featureLayer);
    const featureData = { id: featureId, category: CATEGORIES.LANDMARK, type: tool, label: label, scale: scale, coordinates: [latlng.lat, latlng.lng] };
    
    bindFeatureEvents(marker, featureData);
    saveState(featureData);
    scaleDraftSymbols();
}

// ==========================================
// 4. PARALLEL & RUBBER-BAND LINE ENGINE
// ==========================================
function startLine(latlng) {
    isDrawingLine = true;
    activeCoordinates = [latlng];
    activePolylineGroup = L.featureGroup().addTo(featureLayer);
    renderLineGraphics(activePolylineGroup, activeCoordinates, state.ui.currentTool);
}

function updateLine(latlng) {
    if (!isDrawingLine || !activePolylineGroup) return;
    if (state.ui.currentTool === TOOLS.LINE_STRAIGHT) activeCoordinates[1] = latlng; 
    else activeCoordinates.push(latlng); 
    activePolylineGroup.eachLayer(layer => layer.setLatLngs(activeCoordinates));
}

function finishLine() {
    isDrawingLine = false;
    if (activeCoordinates.length > 1) {
        const featureId = `line_${Date.now()}`;
        const coordsArray = activeCoordinates.map(ll => [ll.lat, ll.lng]);
        
        let baseName = state.ui.currentTool.replace('line_', '');
        baseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);

        const featureData = { id: featureId, category: CATEGORIES.LINE, type: state.ui.currentTool, label: `[${baseName}]`, coordinates: coordsArray };
        
        bindFeatureEvents(activePolylineGroup, featureData);
        saveState(featureData);
    } else if (activePolylineGroup) {
        featureLayer.removeLayer(activePolylineGroup); 
    }
    activePolylineGroup = null;
    activeCoordinates = [];
}

function renderLineGraphics(group, coords, tool) {
    if (tool === TOOLS.LINE_MAINROAD) {
        L.polyline(coords, { color: '#000', weight: 8 }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 4 }).addTo(group);
    } else if (tool === TOOLS.LINE_METALLED) {
        L.polyline(coords, { color: '#000', weight: 5 }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 2 }).addTo(group);
    } else if (tool === TOOLS.LINE_PATHWAY) {
        L.polyline(coords, { color: '#000', weight: 6, dashArray: '5, 5' }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 4, dashArray: '5, 5' }).addTo(group);
    } else if (tool === TOOLS.LINE_UNMETALLED) {
        L.polyline(coords, { color: '#4b5563', weight: 5 }).addTo(group);
        L.polyline(coords, { color: '#fff', weight: 2, dashArray: '5, 5' }).addTo(group);
    } else if (tool === TOOLS.LINE_BOUNDARY) {
        L.polyline(coords, { color: '#000', weight: 4, dashArray: '15, 10, 5, 10' }).addTo(group);
    } else {
        L.polyline(coords, { color: '#000', weight: 3, smoothFactor: 1.0 }).addTo(group);
    }
    // Touch Hit-Box
    L.polyline(coords, { color: 'transparent', weight: 30, opacity: 0.01 }).addTo(group);
}

// ==========================================
// 5. INSPECTOR & ERASER LOGIC
// ==========================================
function handleFeatureTap(featureData, layer) {
    if (state.ui.currentCategory === CATEGORIES.ERASER) {
        if (confirm(`Eradicate this ${featureData.category}?`)) {
            featureLayer.removeLayer(layer);
            const activeProject = getActiveProject();
            activeProject.features = activeProject.features.filter(f => f.id !== featureData.id);
            saveState(); 
        }
        return;
    }

    if (state.ui.currentCategory === CATEGORIES.HAND && (featureData.category === CATEGORIES.BUILDING || featureData.category === CATEGORIES.LANDMARK)) {
        activeInspectorFeatureId = featureData.id;
        activeInspectorMarker = layer;
        
        const panel = document.getElementById('inspector-panel');
        const overlay = document.getElementById('ui-overlay');

        if (featureData.category === CATEGORIES.BUILDING) {
            document.getElementById('inspect-ref-no').value = featureData.bldgNo;
            document.getElementById('inspect-sub-count').value = featureData.scale || featureData.houseCount || 1;
        } else {
            document.getElementById('inspect-ref-no').value = featureData.label.replace(/\[|\]/g, '');
            document.getElementById('inspect-sub-count').value = featureData.scale || 1;
        }

        overlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
        overlay.classList.add('opacity-100', 'z-[190]');
        panel.classList.remove('hidden');
        
        setTimeout(() => panel.classList.remove('scale-95', 'opacity-0'), 10);
    }
}

function initInspectorUI() {
    document.getElementById('btn-save-feature').addEventListener('click', () => {
        const activeProject = getActiveProject();
        const feature = activeProject.features.find(f => f.id === activeInspectorFeatureId);
        
        if (feature) {
            const refVal = document.getElementById('inspect-ref-no').value;
            const subVal = document.getElementById('inspect-sub-count').value;
            const parsedSubVal = parseFloat(subVal);

            if (feature.category === CATEGORIES.BUILDING) {
                feature.bldgNo = refVal;
                // Scale Engine: If decimal is typed, it's a scale adjustment.
                if (subVal.includes('.') || parsedSubVal < 5) {
                    feature.scale = parsedSubVal;
                } else {
                    feature.houseCount = subVal;
                    feature.scale = 1;
                }
                activeInspectorMarker.setIcon(generateBuildingIcon(feature.type, feature.bldgNo, feature.houseCount, feature.scale));
            } else if (feature.category === CATEGORIES.LANDMARK) {
                feature.label = `[${refVal}]`;
                feature.scale = parsedSubVal || 1;
                activeInspectorMarker.setIcon(generateLandmarkIcon(feature.type, feature.label, feature.scale));
            }
            
            scaleDraftSymbols(); 
            saveState();
        }
        document.getElementById('btn-close-inspector').click();
    });

    document.getElementById('btn-delete-feature').addEventListener('click', () => {
        if(confirm("Delete this feature?")) {
            const activeProject = getActiveProject();
            activeProject.features = activeProject.features.filter(f => f.id !== activeInspectorFeatureId);
            featureLayer.removeLayer(activeInspectorMarker);
            saveState();
            document.getElementById('btn-close-inspector').click();
        }
    });
}

// ==========================================
// 6. UTILITIES & DATA ROUTING
// ==========================================
function scaleDraftSymbols() {
    const currentZoom = map.getZoom();
    const baseZoom = 18; 
    let mapScale = Math.pow(1.5, currentZoom - baseZoom);
    if (mapScale > 2) mapScale = 2; 
    if (mapScale < 0.2) mapScale = 0.2;
    
    document.querySelectorAll('.marker-scaler').forEach(el => {
        const customScale = parseFloat(el.getAttribute('data-scale')) || 1;
        el.style.transform = `scale(${mapScale * customScale})`;
    });
}

function saveState(newFeature = null) {
    const activeProject = getActiveProject();
    if (newFeature) {
        activeProject.features.push(newFeature);
        activeProject.redoStack = []; 
        activeProject.undoStack.push(JSON.parse(JSON.stringify(activeProject.features)));
    }
    saveDraftLocally();
}

export function redrawAllFeatures() {
    featureLayer.clearLayers();
    let highestBldgNo = 0;
    const activeProject = getActiveProject();

    activeProject.features.forEach(f => {
        if (f.category === CATEGORIES.BUILDING) {
            if (parseInt(f.bldgNo) > highestBldgNo) highestBldgNo = parseInt(f.bldgNo);
            const marker = L.marker(f.coordinates, { icon: generateBuildingIcon(f.type, f.bldgNo, f.houseCount, f.scale) }).addTo(featureLayer);
            bindFeatureEvents(marker, f);

        } else if (f.category === CATEGORIES.LANDMARK) {
            const marker = L.marker(f.coordinates, { icon: generateLandmarkIcon(f.type, f.label, f.scale) }).addTo(featureLayer);
            bindFeatureEvents(marker, f);
            
        } else if (f.category === CATEGORIES.LINE) {
            const group = L.featureGroup().addTo(featureLayer);
            renderLineGraphics(group, f.coordinates, f.type);
            bindFeatureEvents(group, f);
        }
    });

    currentBldgNo = highestBldgNo + 1;
    scaleDraftSymbols(); 
}
