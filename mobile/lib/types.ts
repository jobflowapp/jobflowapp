// mobile/lib/types.ts

export type Job = {
  id: number;
  title: string;
  customer?: string | null;
  address?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};


export type Invoice = {
  id: number;
  job_id: number;
  amount: number;
  status?: string | null;
  note?: string | null;
  created_at?: string;
};

export type Expense = {
  id: number;
  job_id: number;
  amount: number;
  category?: string | null;
  note?: string | null;
  created_at?: string;
};

export type MileageEntry = {
  id: number;
  job_id: number;
  miles: number;
  note?: string | null;
  created_at?: string;
};
export type JobCreate = {
  title: string
  client_name?: string | null
  status: string
  start_date?: string | null
  end_date?: string | null
}
