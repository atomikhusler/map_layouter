/**
 * MAP LAYOUT DRAFTER - V9 Premium Architecture
 * Omni-Vault Storage Engine (Session & Local Sync)
 * Fixes: V9 Migration protocol and strict parsing.
 */

import { state } from './config.js';

const STORAGE_KEY = 'lmd_omni_vault_v9';
const LEGACY_KEY = 'lmd_omni_vault_v7';

export function saveDraftLocally() {
    try {
        // Atomic Save: Write the entire application memory to local disk & session RAM
        const stateString = JSON.stringify(state);
        localStorage.setItem(STORAGE_KEY, stateString);
        sessionStorage.setItem(STORAGE_KEY, stateString); 
    } catch (e) {
        console.error("[Omni-Vault] Storage failure. Disk full?", e);
    }
}

export function loadDraftLocally() {
    try {
        // 1. Check for a Hot-Resume or Cold-Boot (V9 Native)
        let data = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);

        if (data) {
            const parsedData = JSON.parse(data);
            
            // Carefully inject saved data back into the constant state object
            state.user = parsedData.user || state.user;
            state.ui = parsedData.ui || state.ui;
            state.gps = parsedData.gps || state.gps;
            state.activeProjectId = parsedData.activeProjectId || state.activeProjectId;
            state.projects = parsedData.projects || state.projects;
            
            console.log(`[Omni-Vault] Restored Active Project: ${state.activeProjectId}`);
            return true;
        }

        // 2. Legacy Migration Check (Upgrade old V7/V8 data to V9)
        const legacyData = localStorage.getItem(LEGACY_KEY);
        if (legacyData) {
            console.log("[Omni-Vault] Legacy V7/V8 data detected. Migrating to V9 Architecture...");
            const parsedLegacy = JSON.parse(legacyData);
            
            state.user = parsedLegacy.user || state.user;
            state.ui = parsedLegacy.ui || state.ui;
            state.gps = parsedLegacy.gps || state.gps;
            state.activeProjectId = parsedLegacy.activeProjectId || state.activeProjectId;
            state.projects = parsedLegacy.projects || state.projects;
            
            // Destroy the obsolete vault and construct the new V9 Omni-Vault
            localStorage.removeItem(LEGACY_KEY);
            saveDraftLocally();
            
            console.log(`[Omni-Vault] Migration successful.`);
            return true;
        }

    } catch (e) {
        console.error("[Omni-Vault] Critical parsing error during load.", e);
    }
    return false; // True Cold Start (No data at all)
}

export function clearDraft() {
    // Completely eradicate all local and session memory
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    console.log("[Omni-Vault] Memory banks eradicated. Initiating cold reboot...");
    
    window.location.reload(); 
}
