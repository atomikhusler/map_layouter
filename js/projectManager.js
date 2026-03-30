/**
 * MAP LAYOUT DRAFTER - V9 Premium Architecture
 * Project Manager Module (Atomic State Transitions)
 * Fixes: Strict DOM Type-Guarding, Flawless Area Switching.
 */

import { state } from './config.js';
import { saveDraftLocally } from './storage.js';
import { redrawAllFeatures } from './symbol.js';
import { map } from './map.js';

/**
 * Executes a flawless transition between project slots.
 */
export function switchProject(targetProjectId) {
    if (state.activeProjectId === targetProjectId) return; // Already here

    // 1. Atomic Save: Lock down the current project's progress first
    saveDraftLocally();

    // 2. State Pivot: Switch the active brain
    state.activeProjectId = targetProjectId;
    const activeProject = state.projects[targetProjectId];

    // 3. UI Update: Change the Area ID badge (Type-Safe)
    const areaDisplay = document.getElementById('display-area-id');
    if (areaDisplay instanceof HTMLElement) {
        areaDisplay.innerText = `Area: ${state.user.hlbId || "Unknown"} (${activeProject.name})`;
    }

    // 4. Map Purge & Rebuild: Clear the screen and draw the new project's features
    redrawAllFeatures();

    // 5. Viewport Teleport: Fly the camera to the new project's saved anchor
    if (activeProject.isAreaLocked && activeProject.mapCenterLat && activeProject.mapCenterLng) {
        // Unrestrict the map temporarily to allow the flight
        map.setMaxBounds(null); 
        map.flyTo([activeProject.mapCenterLat, activeProject.mapCenterLng], activeProject.mapZoom || 17, { 
            duration: 1.5,
            animate: true 
        });
        
        // Re-lock the map bounds after the flight completes
        map.once('moveend', () => {
            if (activeProject.mapBounds && activeProject.mapBounds.length === 2) {
                const bounds = L.latLngBounds(activeProject.mapBounds[0], activeProject.mapBounds[1]);
                map.setMaxBounds(bounds);
            }
        });
    }

    console.log(`[Project Manager] Successfully pivoted to ${activeProject.name}`);
}

/**
 * Renames a specific project slot and immediately syncs to the Omni-Vault.
 */
export function renameProject(projectId, newName) {
    if (!newName || newName.trim() === "") return;
    
    state.projects[projectId].name = newName.trim();
    saveDraftLocally();
    
    console.log(`[Project Manager] Slot ${projectId} renamed to "${newName.trim()}"`);
}

/**
 * Surgically eradicates a specific project's data without harming other drafts.
 */
export function deleteProject(projectId) {
    const project = state.projects[projectId];
    
    // Wipe all localized memory banks
    project.features = [];
    project.undoStack = [];
    project.redoStack = [];
    
    // Break the viewport anchors
    project.isAreaLocked = false;
    project.mapCenterLat = null;
    project.mapCenterLng = null;
    project.mapZoom = null;
    project.mapBounds = null;

    // Sync the empty state to the Omni-Vault
    saveDraftLocally();

    // If the user deleted the project they are currently looking at, clear the screen
    if (state.activeProjectId === projectId) {
        redrawAllFeatures();
        const areaDisplay = document.getElementById('display-area-id');
        if (areaDisplay instanceof HTMLElement) {
            areaDisplay.innerText = `Area: NOT SET (${project.name})`;
        }
        
        // Remove map restrictions so they can search for a new area
        map.setMaxBounds(null);
        map.setMinZoom(0);
    }
    
    console.log(`[Project Manager] Eradicated all data for ${project.name}`);
}
