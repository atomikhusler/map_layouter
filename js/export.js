/**
 * MAP LAYOUT DRAFTER - Export Engine
 * Generates downloadable data files (CSV, PDF) directly on the device with zero internet.
 */

import { state, CATEGORIES } from './config.js';

/**
 * Generates and downloads a CSV file of all mapped features.
 * This is the ultimate "Source of Truth" raw data.
 */
export function generateCSV() {
    if (state.features.length === 0) {
        alert("No data to export! Please draw on the map first.");
        return;
    }

    // 1. Create the CSV Header
    let csvContent = "Feature_ID,Category,Type,Building_No,House_Count,Landmark_Label,Latitude,Longitude\n";

    // 2. Loop through our central state and format the rows
    state.features.forEach(feature => {
        const id = feature.id || "Unknown";
        const category = feature.category || "Unknown";
        const type = feature.type || "Unknown";
        const bldgNo = feature.bldgNo || "N/A";
        const houseCount = feature.houseCount || "N/A";
        
        // Sanitize strings to prevent CSV column breaking
        let label = feature.label || "N/A";
        label = label.replace(/,/g, " "); // Strip commas

        // Handle Line arrays vs Point coordinates
        let lat, lng;
        if (category === CATEGORIES.LINE) {
            // For lines, we log the starting point in the basic CSV
            lat = feature.coordinates[0][0].toFixed(6);
            lng = feature.coordinates[0][1].toFixed(6);
            label = `[Line Start: ${feature.coordinates.length} nodes]`;
        } else {
            lat = feature.coordinates[0].toFixed(6);
            lng = feature.coordinates[1].toFixed(6);
        }

        csvContent += `${id},${category},${type},${bldgNo},${houseCount},${label},${lat},${lng}\n`;
    });

    // 3. Trigger the silent download
    triggerFileDownload(csvContent, `MapData_${state.user.hlbId}_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Generates a clean PDF Report of the drafted data using jsPDF.
 */
export function generatePDF() {
    if (state.features.length === 0) {
        alert("No data to export! Please draw on the map first.");
        return;
    }

    // Initialize jsPDF (Loaded globally via CDN in index.html)
    if (!window.jspdf) {
        alert("PDF Engine failed to load. Please check your internet connection for the initial load.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // --- Official Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("MAP LAYOUT DRAFTER", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text("Area Abstract & Feature Log", 105, 28, { align: "center" });

    // --- Metadata Section ---
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Enumerator Name: ${state.user.enumeratorName}`, 20, 45);
    doc.text(`Area / HLB ID: ${state.user.hlbId}`, 20, 52);
    doc.text(`Total Features Mapped: ${state.features.length}`, 20, 59);
    doc.text(`Date of Export: ${new Date().toLocaleDateString()}`, 20, 66);

    // --- Data Table Header ---
    doc.setLineWidth(0.5);
    doc.line(20, 75, 190, 75); // Top line
    doc.setFont("helvetica", "bold");
    doc.text("Category", 25, 82);
    doc.text("Details (No / Houses / Label)", 65, 82);
    doc.text("GPS Coordinates", 140, 82);
    doc.line(20, 85, 190, 85); // Bottom line

    // --- Data Table Rows ---
    doc.setFont("helvetica", "normal");
    let yPos = 92;

    state.features.forEach((feature) => {
        // If we run out of space on the A4 page, add a new page
        if (yPos > 270) {
            doc.addPage();
            yPos = 20; // Reset Y position
        }

        let detailStr = "-";
        let latLngStr = "-";

        if (feature.category === CATEGORIES.BUILDING) {
            detailStr = `Bldg: ${feature.bldgNo} | Houses: ${feature.houseCount}`;
            latLngStr = `${feature.coordinates[0].toFixed(4)}, ${feature.coordinates[1].toFixed(4)}`;
        } else if (feature.category === CATEGORIES.LANDMARK) {
            detailStr = feature.label;
            latLngStr = `${feature.coordinates[0].toFixed(4)}, ${feature.coordinates[1].toFixed(4)}`;
        } else if (feature.category === CATEGORIES.LINE) {
            detailStr = `Line (${feature.type.replace('line_', '')})`;
            latLngStr = `[Path: ${feature.coordinates.length} nodes]`;
        }

        doc.text(feature.category, 25, yPos);
        doc.text(detailStr, 65, yPos);
        doc.text(latLngStr, 140, yPos);

        yPos += 8; // Move down for the next row
    });

    // --- Silent Download ---
    doc.save(`Area_${state.user.hlbId}_Report.pdf`);
    console.log("[Export Engine] PDF successfully generated and downloaded.");
}

/**
 * Utility function to force a file download in the browser
 */
function triggerFileDownload(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}