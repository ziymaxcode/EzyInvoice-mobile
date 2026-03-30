# React POS & Billing System 🛒

A modern, offline-first Point of Sale (POS) and billing application built with React, TypeScript, and Tailwind CSS. Designed to work seamlessly on the web and as a native Android application using Capacitor.

## ✨ Key Features

*   **Offline-First Database:** All data (products, bills, settings) is stored locally on the device using IndexedDB (via Dexie.js), ensuring the app works perfectly without an internet connection.
*   **Billing & Cart Management:** Fast and intuitive billing interface with cart management, tax calculations, and discount application.
*   **Edit Bills:** Modify existing bills, adjust stock automatically, and reprint updated receipts.
*   **Inventory Management:** Track products, manage categories, and monitor stock levels.
*   **Bluetooth Thermal Printing:** Connect to ESC/POS Bluetooth thermal printers (58mm/80mm) directly from the web or Android app to print receipts.
*   **UPI Payment Integration:** Add your Shop's UPI ID to automatically generate "Scan to Pay" QR codes on printed receipts and PDF invoices.
*   **WhatsApp Sharing:** Share digital receipts directly with customers via WhatsApp, including a clickable UPI payment link for instant payments.
*   **PDF Invoices:** Generate and download professional PDF receipts.
*   **Reports & Analytics:** View sales history, daily revenue charts, and export data to CSV.
*   **Data Backup & Restore:** Securely backup your entire database to a JSON file and restore it across devices.
*   **Role-Based Access:** Secure sensitive areas (like wiping data or changing settings) with an Admin PIN.

## 🛠️ Tech Stack

*   **Frontend Framework:** React 19, Vite, TypeScript
*   **Styling:** Tailwind CSS, Lucide React (Icons)
*   **State Management:** Zustand
*   **Local Database:** Dexie.js (IndexedDB)
*   **Routing:** React Router DOM
*   **Native Integration:** Capacitor (Bluetooth LE, Filesystem, Share)
*   **Utilities:** date-fns, jsPDF, qrcode, recharts

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   npm or yarn

### Installation

1. Clone the repository and navigate to the project folder.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Web App

Start the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

### Building for Production

To build the web application:
```bash
npm run build
```
The compiled files will be in the `dist/` directory.

## 📱 Android Development (Capacitor)

This project uses Capacitor to wrap the web app into a native Android APK, enabling native features like Bluetooth printing and file sharing.

1. Build the web project and sync with Capacitor:
   ```bash
   npm run cap:sync
   ```
2. Open the project in Android Studio:
   ```bash
   npm run cap:open:android
   ```
3. From Android Studio, you can build the APK or run the app on a connected Android device/emulator.

## 📂 Project Structure

*   `/src/presentation/`: UI components organized by feature (billing, inventory, reports, settings, auth).
*   `/src/data/`: Database schema and Dexie.js configuration (`database.ts`).
*   `/src/services/`: Core business logic and external integrations (Printer Service, Receipt Builder, ESC/POS Encoder).
*   `/src/core/`: Shared utilities and helpers.

## 🔒 Security Note
This application stores all business data locally on the device. It is highly recommended to regularly use the **Backup Data** feature in the Settings menu to prevent data loss in case the device is lost, damaged, or the browser cache is cleared.
