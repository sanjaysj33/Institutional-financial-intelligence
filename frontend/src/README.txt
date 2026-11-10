CampusLedger frontend update package

Files included:
- App.jsx: current dashboard with visible college-expense navigation count and student roll/name validation.
- Finance.jsx: finance dashboard with green rising arrow for surplus and red falling arrow plus a leading minus sign for loss.
- StaffFinance.jsx: staff ID/name validation.
- CollegeExpenses.jsx: college expense page.
- styles.css: readability and responsive styling.
- main.jsx: React entry point.
- api.js: frontend API client.

Install:
1. Back up your current frontend/src files first.
2. Copy these files into frontend/src, replacing files with the same names.
3. Keep your existing backend running; this package does not modify backend routes or Firebase data.
4. Ensure lucide-react is installed: npm install lucide-react
5. Restart Vite: stop with Ctrl+C, then run npm run dev.

Validation:
- Student admission/roll number: letters and numbers only.
- Student and staff names: letters/spaces only, at least 3 letters.
- Client-side validation improves usability; also add equivalent validation to backend routes before deploying.

Note:
This is a frontend code package assembled from the latest available CampusLedger source files in this conversation. It has not been run against your live Firebase/backend, so test create/edit actions with non-critical records first.
