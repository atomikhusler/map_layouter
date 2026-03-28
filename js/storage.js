/**
 * MAP LAYOUT DRAFTER - Storage Engine
 * Handles offline persistence using the browser's LocalStorage.
 */

import { state } from './config.js';

const STORAGE_KEY = 'map_drafter_vault_v1';

/**
 * Serializes the central state and saves it to the hard drive.
 * Called automatically by symbol.js after every tap.
 */
export function saveDraftLocally() {
    try {
        const payload = JSON.stringify({
            user: state.user,
            features: state.features
        });
        localStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {
        console.error("[Storage] Failed to save draft. Quota exceeded?", e);
        alert("CRITICAL WARNING: Storage is full. Export your PDF now.");
    }
}

/**
 * Boots up the memory vault. Runs during app initialization.
 */
export function loadDraftLocally() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            const parsed = JSON.parse(savedData);
            
            // Restore User Data
            state.user = parsed.user;
            
            // Restore Features Data
            if (Array.isArray(parsed.features)) {
                state.features = parsed.features;
                console.log(`[Storage] Restored ${state.features.length} drafted features.`);
            }
            return true;
        }
    } catch (e) {
        console.error("[Storage] Database corruption detected. Wiping local memory.", e);
        localStorage.removeItem(STORAGE_KEY);
    }
    return false;
}

/**
 * Emergency Reset function (Wipes all data for the next block)
 */
export function clearDraft() {
    if (confirm("WARNING: This will permanently delete the current map. Export PDF first! Are you sure?")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload(); // Force refresh to Phase 1
    }
}