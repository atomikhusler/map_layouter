/**
 * MAP LAYOUT DRAFTER - Omni-Vault Engine (V7 Master)
 * Features: Full State Sync, Hot-Resume (Session), and V5 Legacy Migration.
 */

import { state } from './config.js';

const STORAGE_KEY = 'lmd_omni_vault_v7';
const LEGACY_KEY = 'lmd_draft_vault_v5';

export function saveDraftLocally() {
    try {
        // Atomic Save: Write the entire application memory to local disk & session RAM
        const stateString = JSON.stringify(state);
        localStorage.setItem(STORAGE_KEY, stateString);
        sessionStorage.setItem(STORAGE_KEY, stateString); 
        console.log("[Omni-Vault] State successfully synchronized.");
    } catch (e) {
        console.error("[Omni-Vault] Storage failure. Disk full?", e);
    }
}

export function loadDraftLocally() {
    try {
        // 1. Check for a Hot-Resume or Cold-Boot
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

        // 2. Legacy Migration Check (If an old V5 vault exists)
        const legacyData = localStorage.getItem(LEGACY_KEY);
        if (legacyData) {
            console.log("[Omni-Vault] Legacy V5 data detected. Initiating migration...");
            const legacyFeatures = JSON.parse(legacyData);
            
            // Rescue old features and push them into Draft 1
            state.projects["draft_1"].features = legacyFeatures;
            state.projects["draft_1"].isAreaLocked = true; 
            state.activeProjectId = "draft_1";
            
            // Destroy the obsolete vault and construct the new V7 Omni-Vault
            localStorage.removeItem(LEGACY_KEY);
            saveDraftLocally();
            
            console.log(`[Omni-Vault] Migration successful. Rescued ${legacyFeatures.length} features.`);
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
