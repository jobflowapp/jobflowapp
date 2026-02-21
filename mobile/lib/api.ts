// mobile/lib/api.ts
import { getToken, clearToken } from "./token";
import { getApiBaseUrl } from "./config";

export const BASE_URL = getApiBaseUrl();

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type { Job, Invoice, Expense, MileageEntry } from "./types";
import type { Job, Invoice, Expense, JobCreate, MileageEntry } from "./types";

function withJobId(path: string, jobId?: number | null) {
  if (jobId === null || jobId === undefined) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}job_id=${encodeURIComponent(String(jobId))}`;
}

export async function request<T>(path: string, method: HttpMethod, body?: unknown): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    await clearToken();
    throw new Error("Session expired. Please log in again.");
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      (typeof data === "string" ? data : "") ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}

/* ===========================
   JOBS
=========================== */
export function getJobs() {
  return request<Job[]>("/jobs", "GET");
}

export function createJob(data: JobCreate): Promise<Job> {
  return request<Job>("/jobs", "POST", data);
}

export function updateJob(jobId: number, data: Partial<JobCreate> & { status?: string }) {
  return request<Job>(`/jobs/${jobId}`, "PUT", data);
}

export function deleteJob(jobId: number) {
  return request<{ ok: boolean }>(`/jobs/${jobId}`, "DELETE");
}

/* ===========================
   INVOICES
=========================== */
export function getInvoices(jobId?: number | null) {
  return request<Invoice[]>(withJobId("/invoices", jobId), "GET");
}

export function createInvoice(data: { job_id?: number | null; amount: number; status?: string; note?: string | null }) {
  return request<Invoice>("/invoices", "POST", data);
}

export function updateInvoice(invoiceId: number, data: Partial<{ job_id: number | null; amount: number; status: string; note: string | null }>) {
  return request<Invoice>(`/invoices/${invoiceId}`, "PUT", data);
}

export function deleteInvoice(invoiceId: number) {
  return request<{ ok: boolean }>(`/invoices/${invoiceId}`, "DELETE");
}

/* ===========================
   EXPENSES
=========================== */
export function getExpenses(jobId?: number | null) {
  return request<Expense[]>(withJobId("/expenses", jobId), "GET");
}

export function createExpense(data: { job_id?: number | null; amount: number; category: string; note?: string | null }) {
  return request<Expense>("/expenses", "POST", data);
}

export function deleteExpense(expenseId: number) {
  return request<{ ok: boolean }>(`/expenses/${expenseId}`, "DELETE");
}

/* ===========================
   MILEAGE
=========================== */
export function getMileage(jobId?: number | null) {
  return request<MileageEntry[]>(withJobId("/mileage", jobId), "GET");
}

export function createMileage(data: { job_id?: number | null; miles: number; note?: string | null }) {
  return request<MileageEntry>("/mileage", "POST", data);
}

export function deleteMileage(mileageId: number) {
  return request<{ ok: boolean }>(`/mileage/${mileageId}`, "DELETE");
}


/* ===========================
   PROFILE + BUSINESS
=========================== */
export type UserProfile = {
  phone?: string | null;
  timezone?: string | null;
  default_mileage_rate?: number | null;
};

export type BusinessProfile = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  ein?: string | null;
  logo_url?: string | null;
  invoice_prefix?: string | null;
  next_invoice_number: number;
  default_terms?: string | null;
};

export function getProfile() {
  return request<UserProfile>("/me/profile", "GET");
}

export function updateProfile(data: Partial<UserProfile>) {
  return request<UserProfile>("/me/profile", "PUT", data);
}

export function getBusiness() {
  return request<BusinessProfile>("/business", "GET");
}

export function updateBusiness(data: Partial<BusinessProfile>) {
  return request<BusinessProfile>("/business", "PUT", data);
}

/* ===========================
   CLIENTS + VENDORS
=========================== */
export type Client = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
};

export type Vendor = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  default_category?: string | null;
  created_at: string;
};

export function getClients() {
  return request<Client[]>("/clients", "GET");
}

export function createClient(data: Omit<Client, "id" | "created_at">) {
  return request<Client>("/clients", "POST", data);
}

export function getVendors() {
  return request<Vendor[]>("/vendors", "GET");
}

export function createVendor(data: Omit<Vendor, "id" | "created_at">) {
  return request<Vendor>("/vendors", "POST", data);
}

/* ===========================
   RECEIPTS (S3 presigned uploads)
=========================== */
export type ReceiptPresign = { key: string; upload_url: string; file_url: string };

export type Receipt = {
  id: number;
  file_url: string;
  key?: string | null;
  content_type?: string | null;
  original_filename?: string | null;
  size_bytes?: number | null;
  job_id?: number | null;
  expense_id?: number | null;
  vendor_id?: number | null;
  created_at: string;
};

export async function presignReceipt(filename: string, content_type: string) {
  return request<ReceiptPresign>("/receipts/presign", "POST", { filename, content_type });
}

export async function uploadReceiptToPresignedUrl(uploadUrl: string, fileUri: string, contentType: string) {
  // Expo fetch can PUT the file as a blob
  const res = await fetch(fileUri);
  const blob = await res.blob();

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!put.ok) {
    const t = await put.text().catch(() => "");
    throw new Error(t || `Upload failed (${put.status})`);
  }
}

export function createReceipt(data: Omit<Receipt, "id" | "created_at">) {
  return request<Receipt>("/receipts", "POST", data);
}

export function getReceipts(params?: { job_id?: number; expense_id?: number }) {
  const q: string[] = [];
  if (params?.job_id) q.push(`job_id=${encodeURIComponent(String(params.job_id))}`);
  if (params?.expense_id) q.push(`expense_id=${encodeURIComponent(String(params.expense_id))}`);
  const suffix = q.length ? `?${q.join("&")}` : "";
  return request<Receipt[]>(`/receipts${suffix}`, "GET");
}

export function generateInvoicePdf(invoiceId: number) {
  return request<Invoice>(`/invoices/${invoiceId}/pdf`, "POST");
}
