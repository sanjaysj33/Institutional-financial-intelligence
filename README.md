# College Financial Intelligence System

Starter version: React + Vite frontend, FastAPI backend, MySQL database.
The first working module is **Department Management (CRUD)**.

## Requirements
- Python 3.10+
- Node.js 20+
- MySQL 8+

## 1. Create the database
Open MySQL and run:

```sql
CREATE DATABASE college_finance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 2. Start the backend
Open a terminal in this project folder:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and set your MySQL username/password.

Example:
`DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/college_finance`

Then run:

```bash
uvicorn app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

## 3. Start the frontend
Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL Vite prints, usually http://localhost:5173.

## First module
- Add a department
- View departments
- Edit a department
- Delete a department

The backend creates the `departments` table automatically for this starter module.

## Important before real college use
This is a learning starter, not production-ready financial software. Before storing real student/staff information, add authentication, role-based authorization, audit logs, backups, validation, migrations (Alembic), and proper financial controls. Never store payment card details or passwords as plain text.
