# 🗺️ Map Layout Drafter
### *The Professional-Grade GIS Utility for Precision Field Mapping*

![App Version](https://img.shields.io/badge/Version-1.2.0-blue)
![Platform](https://img.shields.io/badge/Platform-PWA%20/%20Web-orange)
![License](https://img.shields.io/badge/Status-Operational-success)

**Map Layout Drafter** is an offline-first, high-precision drafting tool designed for professional field workers, enumerators, and surveyors. It bridges the gap between traditional paper-and-pencil layout mapping and complex, heavy GIS software.

---

## 💎 Premium Features

* **⚡ Tactile Interaction Model:** Specialized touch physics that distinguish between a single-finger "Drafting Mode" and a two-finger "Navigation Mode." No more accidental map sliding while tracing.
* **📡 True-Scale Geographic Rendering:** Unlike standard map markers, every building and road is rendered as a geographic vector. Icons physically scale with map zoom to maintain real-world accuracy.
* **☁️ Zero-Signal Reliability:** Built as a robust PWA (Progressive Web App) with an advanced Service Worker. Load your area once, and work for days with zero internet connection.
* **📐 Specialized Toolset:** Includes official drafting symbols for Pucca/Kutcha structures, Metalled/Unmetalled roads, and bracketed landmark annotations.
* **📑 Professional Export:** Generate high-resolution PDF abstracts and raw CSV data logs directly on your device.

---

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Mapping Engine** | Leaflet.js (v1.9.4) |
| **Styling** | Tailwind CSS (v3.4+) |
| **Tile Provider** | Google Satellite Hybrid (High-Res) |
| **Logic** | Vanilla ES6 JavaScript Modules |
| **Persistence** | LocalStorage + Service Worker |
| **Export** | jsPDF (Client-Side) |

---

## 🚀 Deployment Workflow

### Phase 1: Area Initialization
The app forces a "Geographic Lock" before drafting begins. Locate your target block, align the precision crosshair, and lock the boundaries to establish your workspace.

### Phase 2: Professional Drafting
Use the floating multi-level menu to select tools. 
* **One Finger:** Draw lines, place buildings, or drop landmarks.
* **Two Fingers:** Pan and zoom the map without interrupting your active tool.
* **Transparency Slider:** Smoothly transition between Satellite view (for detail) and Paper view (for clean exports).

---

## 📂 Architecture

\`\`\`text
/
├── index.html          # Core UI & Layered Architecture
├── manifest.json       # PWA Configuration
├── sw.js               # Offline Caching Engine
├── css/
│   └── style.css       # Custom Physics & UI Transitions
├── js/
│   ├── config.js       # Central State Logic
│   ├── map.js          # Geographic & GPS Engine
│   ├── symbol.js       # Drafting & Touch Physics
│   ├── storage.js      # Offline Persistence
│   └── export.js       # PDF/CSV Compiler
└── assets/icons/       # High-Res PWA Identity
\`\`\`

---

## 🛡️ Privacy & Safety
This application operates entirely on the **Client-Side**. Your coordinates, drafted maps, and personal data never leave your device. All processing happens in local RAM and storage.

---

## 👨‍💻 Developed By

**Sahil Kumar Rout** *Passionate Educator & Software Systems Developer* 📍 India

---

## ☕ Support the Project

If this utility has saved you hours of field work or helped you achieve 100% accuracy in your mapping, consider supporting its continued development and maintenance.

* **UPI ID:** `your-upi-id@bank` *(Replace with your actual UPI ID)*
* **Buy Me a Coffee:** [buymeacoffee.com/yourusername](https://buymeacoffee.com)
* **PayPal:** [paypal.me/yourusername](https://paypal.me)

---
*Built with ❤️ for field workers everywhere.*
