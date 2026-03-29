/**
 * MAP LAYOUT DRAFTER - Elite Export Engine (Final Master)
 * Features: CORS-Bypassing PNG Capture, Offline-Safe Multi-Page PDF, CSV & JSON.
 */

import { state, CATEGORIES } from './config.js';

// ==========================================
// 1. DEPENDENCY AUTO-LOADERS (Offline Safety)
// ==========================================
async function ensureHTML2Canvas() {
    if (window.html2canvas) return true;
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => resolve(true);
        script.onerror = () => {
            alert("Network required for first-time PNG/PDF engine initialization.");
            resolve(false);
        };
        document.head.appendChild(script);
    });
}

// ==========================================
// 2. THE ELITE PNG CAPTURE ENGINE
// ==========================================
export async function generatePNG() {
    if (state.features.length === 0) {
        alert("No layout data to capture! Draw your map first.");
        return null;
    }

    const isReady = await ensureHTML2Canvas();
    if (!isReady) return null;

    // ELITE FIX: Eradicate the Tile Pane from the DOM to bypass Google CORS poisoning
    const tilePane = document.querySelector('.leaflet-tile-pane');
    const originalDisplay = tilePane ? tilePane.style.display : '';
    if (tilePane) tilePane.style.display = 'none';

    const mapElement = document.getElementById('map');
    
    // Give DOM 200ms to repaint the clean white paper background
    await new Promise(r => setTimeout(r, 200));

    try {
        const canvas = await window.html2canvas(mapElement, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            scale: 2, // High-Res export
            logging: false
        });

        // Restore map tiles instantly
        if (tilePane) tilePane.style.display = originalDisplay;
        
        return canvas.toDataURL('image/png');
    } catch (err) {
        console.error("Canvas capture failed:", err);
        if (tilePane) tilePane.style.display = originalDisplay;
        alert("Failed to capture map image. Check developer logs.");
        return null;
    }
}

// ==========================================
// 3. THE MULTI-PAGE PDF ENGINE
// ==========================================
export async function generatePDF() {
    if (state.features.length === 0) {
        alert("No data to export! Please draft the layout first.");
        return;
    }

    if (!window.jspdf) {
        alert("PDF Engine failed to load. Check internet connection for initial load.");
        return;
    }

    const exportBtn = document.getElementById('export-pdf');
    let originalText = "PDF Report";
    if (exportBtn) {
        originalText = exportBtn.innerText;
        exportBtn.innerText = "GENERATING...";
    }

    const mapImageStr = await generatePNG();
    if (!mapImageStr) {
        if (exportBtn) exportBtn.innerText = originalText;
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // --- PAGE 1: The Official Drafted Map ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); 
    doc.text("OFFICIAL LAYOUT MAP", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(75, 85, 99);
    doc.text(`Area / Block ID: ${state.user.hlbId || "UNSPECIFIED"}`, 105, 28, { align: "center" });

    // Inject High-Res PNG (A4 width is 210mm. 15mm margins = 180mm width)
    doc.addImage(mapImageStr, 'PNG', 15, 35, 180, 180);

    // Footer
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Drafter: ${state.user.enumeratorName || "Unknown"}`, 15, 230);
    doc.text(`Date Drafted: ${new Date().toLocaleDateString()}`, 15, 236);
    doc.text(`Total Elements: ${state.features.length}`, 15, 242);

    // --- PAGE 2+: The Feature Data Registry ---
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LAYOUT FEATURE REGISTRY", 105, 20, { align: "center" });

    // Table Headers
    doc.setLineWidth(0.5);
    doc.line(15, 30, 195, 30);
    doc.setFontSize(10);
    doc.text("Sl. No.", 15, 36);
    doc.text("Category", 35, 36);
    doc.text("Details (Name / Houses)", 75, 36);
    doc.text("GPS Coordinates", 140, 36);
    doc.line(15, 40, 195, 40);

    doc.setFont("helvetica", "normal");
    let yPos = 48;

    state.features.forEach((f, index) => {
        if (yPos > 270) {
            doc.addPage();
            yPos = 20; 
        }

        let cleanName = f.label ? f.label.replace(/\[|\]/g, '') : "-";
        let coords = "";
        let details = "";

        if (f.category === CATEGORIES.BUILDING) {
            details = `Bldg ${f.bldgNo} | Houses: ${f.houseCount}`;
            coords = `${f.coordinates[0].toFixed(5)}, ${f.coordinates[1].toFixed(5)}`;
        } else if (f.category === CATEGORIES.LINE) {
            details = `Road/Line (${f.type.replace('line_', '')})`;
            coords = `[Path: ${f.coordinates.length} Nodes]`;
        } else {
            details = cleanName;
            coords = `${f.coordinates[0].toFixed(5)}, ${f.coordinates[1].toFixed(5)}`;
        }

        doc.text((index + 1).toString(), 15, yPos);
        doc.text(f.category.toUpperCase(), 35, yPos);
        doc.text(details.substring(0, 30), 75, yPos); 
        doc.text(coords, 140, yPos);

        yPos += 8;
    });

    doc.save(`Layout_Map_${state.user.hlbId || "Draft"}.pdf`);
    if (exportBtn) exportBtn.innerText = originalText;
}

// ==========================================
// 4. DATA EXPORT (CSV & JSON)
// ==========================================
export function generateCSV() {
    if (state.features.length === 0) return alert("No data to export!");

    let csvContent = "Sl_No,Feature_ID,Category,Type,Building_No,House_Count,Feature_Name,Latitude,Longitude\n";

    state.features.forEach((f, index) => {
        const id = f.id || "Unknown";
        const cat = f.category || "Unknown";
        const type = f.type || "Unknown";
        const bNo = f.bldgNo || "N/A";
        const hC = f.houseCount || "N/A";
        let label = (f.label || "N/A").replace(/,/g, " "); 

        let lat, lng;
        if (cat === CATEGORIES.LINE) {
            lat = f.coordinates[0][0].toFixed(6);
            lng = f.coordinates[0][1].toFixed(6);
            label = `[Path Start] ${label}`;
        } else {
            lat = f.coordinates[0].toFixed(6);
            lng = f.coordinates[1].toFixed(6);
        }

        csvContent += `${index + 1},${id},${cat},${type},${bNo},${hC},${label},${lat},${lng}\n`;
    });

    triggerFileDownload(csvContent, `DataLog_${state.user.hlbId || "Draft"}.csv`, 'text/csv;charset=utf-8;');
}

export function generateJSON() {
    if (state.features.length === 0) return alert("No data to export!");
    const jsonStr = JSON.stringify(state, null, 2);
    triggerFileDownload(jsonStr, `GIS_Twin_${state.user.hlbId || "Draft"}.json`, 'application/json');
}

function triggerFileDownload(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
