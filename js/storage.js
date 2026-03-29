/**
 * MAP LAYOUT DRAFTER - Storage Engine (Sprint 5 Master)
 * The Local Vault: Saves drafts automatically to survive browser crashes.
 */

import { state } from './config.js';

const STORAGE_KEY = 'lmd_draft_vault_v5';

export function saveDraftLocally() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.features));
        console.log("[Storage Engine] Draft saved successfully.");
    } catch (e) {
        console.error("[Storage Engine] Failed to save draft. Storage full?", e);
    }
}

export function loadDraftLocally() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            state.features = JSON.parse(data);
            console.log(`[Storage Engine] Loaded ${state.features.length} features from vault.`);
            return true;
        }
    } catch (e) {
        console.error("[Storage Engine] Failed to parse saved draft.", e);
    }
    return false;
}

export function clearDraft() {
    localStorage.removeItem(STORAGE_KEY);
    state.features = [];
    state.undoStack = [];
    state.redoStack = [];
    console.log("[Storage Engine] Vault wiped. Restarting...");
    
    // Hard refresh to completely clean the DOM and cache state
    window.location.reload(); 
}
