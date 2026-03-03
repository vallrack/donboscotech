# **App Name**: Don Bosco Track

## Core Features:

- User & Role Management: Register and authenticate users (Docents, Coordinators, Administrators) using email or Firebase Authentication. Implement role-based access control where Docents can only view their own attendance, and Coordinators/Admins have full management capabilities.
- Dynamic QR Code Attendance: Generate dynamic QR codes for docents to scan with their device for clock-in/out. A Firebase Cloud Function will validate the QR token to ensure security and prevent fraudulent scans.
- Manual Attendance Marking: Provide a user interface for Coordinators to manually mark attendance for docents, including a 'Cumplió Jornada' checkbox for exceptional cases. This allows flexibility when QR scanning is not possible.
- Geolocation Tracking: Capture and store GPS coordinates at the time of attendance marking to verify that the docent is physically present at the institution. This data will be saved with each attendance record in Firestore.
- Attendance Dashboard & Filtering: Display attendance records for all users (or self, based on role) and allow Coordinators/Admins to quickly filter records by date ranges (weekly, bi-weekly, monthly) using efficient Firestore queries.
- AI-Powered Report Generation Tool: Generate comprehensive attendance reports. This tool, powered by Firebase Cloud Functions, will calculate accumulated hours per docent based on entry/exit timestamps and export them in PDF for visualization and Excel/CSV for administrative processes like payroll.

## Style Guidelines:

- Primary color: A deep, institutional red (#B1123B) to convey strength and passion, inspired by the Ciudad Don Bosco logo. Hue: 350, Saturation: 75%, Lightness: 45%.
- Background color: A very light, desaturated off-white (#F7F0F2) with a hint of red to maintain harmony and provide a clean, uncluttered canvas. Hue: 350, Saturation: 15%, Lightness: 95%.
- Accent color: A soft, muted magenta (#DA8CC2) analogous to the primary red, offering a subtle contrasting highlight for interactive elements or key information. Hue: 320, Saturation: 60%, Lightness: 70%.
- Additionally, a neutral charcoal grey (#5C5C5C) should be used for text and secondary UI elements, as suggested by the user and present in the brand's logo, to ensure readability and professional contrast.
- Headline and Body Font: 'Inter' (sans-serif) for its modern, clear, and objective aesthetic, ensuring excellent readability across all informational and functional elements of the application.
- Utilize simple, outline-style icons that are universally recognized for actions like login, scan, edit, report, and filter to ensure clarity and ease of navigation.
- Implement a clean, organized card-based layout for data display, providing a consistent visual hierarchy that emphasizes attendance records and reporting options. Utilize ample white space for a professional feel.
- Subtle, fast feedback animations should be used for user interactions, such as successful QR code scans, button clicks, and data loading states, to enhance responsiveness without distracting.