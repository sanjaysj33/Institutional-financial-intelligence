import { firebaseAuth } from "./firebase";


const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const firebaseUser = firebaseAuth.currentUser;
  const token = firebaseUser ? await firebaseUser.getIdToken() : null;
  const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep the default error message.
    }

    throw new Error(
      typeof message === "string"
        ? message
        : JSON.stringify(message)
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// DEPARTMENTS
export const departmentApi = {
  list: () => request("/api/departments"),

  create: (data) =>
    request("/api/departments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request(`/api/departments/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id) =>
    request(`/api/departments/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

// STUDENTS
export const studentApi = {
  list: () => request("/api/students"),

  create: (data) =>
    request("/api/students", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  bulk: (data) =>
    request("/api/students/bulk", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request(`/api/students/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  discontinue: (id) =>
    request(`/api/students/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  permanentDelete: (id) =>
    request(
      `/api/students/${encodeURIComponent(id)}/permanent`,
      { method: "DELETE" }
    ),

  updateBatch: (id, data) =>
    request(`/api/students/${encodeURIComponent(id)}/batch`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  editBatch: (payload) =>
    request("/api/students/batch/edit", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  graduateBatch: (payload) =>
    request("/api/students/batch/graduate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  graduate: (id) =>
    request(`/api/students/${encodeURIComponent(id)}/graduate`, {
      method: "POST",
    }),

  bulkGraduate: (ids) =>
    request("/api/students/bulk-graduate", {
      method: "POST",
      body: JSON.stringify({ student_ids: ids }),
    }),
};

// STAFF
export const staffApi = {
  list: () => request("/api/staff"),

  create: (data) =>
    request("/api/staff", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request(`/api/staff/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  relieve: (id) =>
    request(
      `/api/staff/${encodeURIComponent(id)}/relieve`,
      { method: "POST" }
    ),
};

// FINANCE
export const financeApi = {
  overview: () => request("/api/finance/overview"),

  fees: () => request("/api/finance/fees"),

  assignFee: (data) =>
    request("/api/finance/fees", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateFee: (id, data) =>
    request(`/api/finance/fees/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  payments: () => request("/api/finance/payments"),

  recordPayment: (data) =>
    request("/api/finance/payments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePayment: (id, data) =>
    request(`/api/finance/payments/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  donations: () => request("/api/finance/donations"),

  recordDonation: (data) =>
    request("/api/finance/donations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDonation: (id, data) =>
    request(`/api/finance/donations/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  payroll: () => request("/api/finance/payroll"),

  recordPayroll: (data) =>
    request("/api/finance/payroll", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // COLLEGE EXPENSES
  expenses: () =>
    request("/api/finance/expenses"),

  recordExpense: (data) =>
    request("/api/finance/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateExpense: (id, data) =>
    request(`/api/finance/expenses/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteExpense: (id) =>
    request(`/api/finance/expenses/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};


// Owner-only login account administration endpoints.
export const authApi = {
  me: () => request("/api/auth/me"),
  createStaff: (data) => request("/api/auth/staff", { method: "POST", body: JSON.stringify(data) }),
  listStaffAccounts: () => request("/api/auth/staff"),
  disableStaffAccount: (uid) => request(`/api/auth/staff/${encodeURIComponent(uid)}/disable`, { method: "PATCH" }),
};
