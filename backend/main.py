from __future__ import annotations

import io
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

import boto3
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, EmailStr
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from db import Base, SessionLocal, engine
from models import (
    Business,
    Client,
    Expense,
    Invoice,
    Job,
    Mileage,
    Receipt,
    User,
    UserProfile,
    Vendor,
)

# ----------------------------
# App setup
# ----------------------------
app = FastAPI(title="JobFlow API")
Base.metadata.create_all(bind=engine)

def _env(name: str, default: str) -> str:
    val = os.getenv(name)
    return val if val is not None and val.strip() else default

def _parse_cors_origins(raw: str) -> list[str]:
    raw = raw.strip()
    if raw == "*":
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(_env("CORS_ORIGINS", "*")),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Auth config
# ----------------------------
SECRET_KEY = _env("SECRET_KEY", "CHANGE_ME_TO_A_LONG_RANDOM_SECRET")
ALGORITHM = _env("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_DAYS = int(_env("ACCESS_TOKEN_EXPIRE_DAYS", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# ----------------------------
# DB dependency
# ----------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ----------------------------
# Helpers
# ----------------------------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def ensure_profile_and_business(db: Session, user: User) -> tuple[UserProfile, Business]:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(user_id=user.id, timezone=_env("DEFAULT_TIMEZONE", "America/New_York"))
        db.add(profile)

    biz = db.query(Business).filter(Business.owner_user_id == user.id).first()
    if not biz:
        name = (user.full_name or "").strip() or "My Business"
        biz = Business(owner_user_id=user.id, name=name)
        db.add(biz)

    db.commit()
    db.refresh(profile)
    db.refresh(biz)
    return profile, biz

def current_business(db: Session, user: User) -> Business:
    _, biz = ensure_profile_and_business(db, user)
    return biz

# ----------------------------
# S3 helpers (S3-compatible: AWS S3 / Cloudflare R2 / Backblaze B2)
# ----------------------------
def s3_client():
    access = os.getenv("S3_ACCESS_KEY_ID")
    secret = os.getenv("S3_SECRET_ACCESS_KEY")
    bucket = os.getenv("S3_BUCKET")
    if not (access and secret and bucket):
        raise HTTPException(status_code=500, detail="S3 not configured (missing S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY/S3_BUCKET)")

    endpoint_url = os.getenv("S3_ENDPOINT_URL")  # set for R2/B2; omit for AWS
    region = os.getenv("S3_REGION", "us-east-1")

    return boto3.client(
        "s3",
        aws_access_key_id=access,
        aws_secret_access_key=secret,
        region_name=region,
        endpoint_url=endpoint_url,
    )

def s3_public_base_url() -> Optional[str]:
    v = os.getenv("S3_PUBLIC_BASE_URL")
    return v.strip().rstrip("/") if v and v.strip() else None

def s3_object_public_url(bucket: str, key: str) -> str:
    base = s3_public_base_url()
    if base:
        return f"{base}/{key}"
    endpoint_url = os.getenv("S3_ENDPOINT_URL")
    region = os.getenv("S3_REGION", "us-east-1")
    if endpoint_url:
        # many S3-compatible providers expose direct URLs; base URL is preferred
        return f"{endpoint_url.rstrip('/')}/{bucket}/{key}"
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"

def s3_presign_put(bucket: str, key: str, content_type: str) -> str:
    client = s3_client()
    return client.generate_presigned_url(
        ClientMethod="put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=int(os.getenv("S3_PRESIGN_EXPIRES_SECONDS", "900")),
    )

def s3_put_bytes(bucket: str, key: str, content_type: str, data: bytes) -> str:
    client = s3_client()
    client.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
    return s3_object_public_url(bucket, key)

# ----------------------------
# Schemas
# ----------------------------
class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class AuthSignupIn(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class AuthLoginIn(BaseModel):
    email: EmailStr
    password: str

class AuthOut(BaseModel):
    token: str
    userId: int

class UserProfileOut(_ORM):
    phone: Optional[str] = None
    timezone: Optional[str] = None
    default_mileage_rate: Optional[float] = 0.0

class UserProfileUpdateIn(BaseModel):
    phone: Optional[str] = None
    timezone: Optional[str] = None
    default_mileage_rate: Optional[float] = None

class BusinessOut(_ORM):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    ein: Optional[str] = None
    logo_url: Optional[str] = None
    invoice_prefix: Optional[str] = None
    next_invoice_number: int
    default_terms: Optional[str] = None

class BusinessUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    ein: Optional[str] = None
    logo_url: Optional[str] = None
    invoice_prefix: Optional[str] = None
    next_invoice_number: Optional[int] = None
    default_terms: Optional[str] = None

class ClientCreateIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class ClientOut(_ORM):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

class VendorCreateIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    default_category: Optional[str] = None

class VendorOut(_ORM):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    default_category: Optional[str] = None
    created_at: datetime

class JobCreateIn(BaseModel):
    title: str
    client_name: Optional[str] = None
    client_id: Optional[int] = None

class JobUpdateIn(BaseModel):
    title: Optional[str] = None
    client_name: Optional[str] = None
    status: Optional[str] = None
    client_id: Optional[int] = None

class JobOut(_ORM):
    id: int
    title: str
    client_name: Optional[str] = None
    status: Optional[str] = None
    client_id: Optional[int] = None
    created_at: datetime

class InvoiceCreateIn(BaseModel):
    job_id: Optional[int] = None
    amount: float
    status: Optional[str] = "unpaid"
    note: Optional[str] = None
    due_date: Optional[str] = None

class InvoiceUpdateIn(BaseModel):
    job_id: Optional[int] = None
    amount: Optional[float] = None
    status: Optional[str] = None
    note: Optional[str] = None
    due_date: Optional[str] = None

class InvoiceOut(_ORM):
    id: int
    job_id: Optional[int] = None
    amount: float
    status: Optional[str] = None
    note: Optional[str] = None
    due_date: Optional[str] = None
    invoice_number: Optional[str] = None
    pdf_url: Optional[str] = None
    created_at: datetime

class MileageCreateIn(BaseModel):
    job_id: Optional[int] = None
    miles: float
    note: Optional[str] = None

class MileageOut(_ORM):
    id: int
    job_id: Optional[int]
    miles: float
    note: Optional[str]
    created_at: datetime

class ExpenseCreateIn(BaseModel):
    job_id: Optional[int] = None
    vendor_id: Optional[int] = None
    amount: float
    category: str
    category_code: Optional[str] = None
    note: Optional[str] = None

class ExpenseUpdateIn(BaseModel):
    job_id: Optional[int] = None
    vendor_id: Optional[int] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    category_code: Optional[str] = None
    note: Optional[str] = None

class ExpenseOut(_ORM):
    id: int
    job_id: Optional[int]
    vendor_id: Optional[int]
    amount: float
    category: str
    category_code: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

class ReceiptPresignIn(BaseModel):
    filename: str
    content_type: str

class ReceiptPresignOut(BaseModel):
    key: str
    upload_url: str
    file_url: str

class ReceiptCreateIn(BaseModel):
    key: Optional[str] = None
    file_url: str
    content_type: Optional[str] = None
    original_filename: Optional[str] = None
    size_bytes: Optional[int] = None
    job_id: Optional[int] = None
    expense_id: Optional[int] = None
    vendor_id: Optional[int] = None

class ReceiptOut(_ORM):
    id: int
    file_url: str
    key: Optional[str] = None
    content_type: Optional[str] = None
    original_filename: Optional[str] = None
    size_bytes: Optional[int] = None
    job_id: Optional[int] = None
    expense_id: Optional[int] = None
    vendor_id: Optional[int] = None
    created_at: datetime

# ----------------------------
# Health
# ----------------------------
@app.get("/health")
def health():
    return {"ok": True}

# ----------------------------
# Auth routes
# ----------------------------
@app.post("/auth/signup", response_model=AuthOut)
def signup(data: AuthSignupIn, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")

    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create profile + business (single business per user)
    ensure_profile_and_business(db, user)

    token = create_access_token(user.id)
    return {"token": token, "userId": user.id}

@app.post("/auth/login", response_model=AuthOut)
def login(data: AuthLoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    ensure_profile_and_business(db, user)

    token = create_access_token(user.id)
    return {"token": token, "userId": user.id}

@app.post("/auth/token")
def token_endpoint(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username.lower()).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    ensure_profile_and_business(db, user)

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}

# ----------------------------
# Profile + Business
# ----------------------------
@app.get("/me/profile", response_model=UserProfileOut)
def get_profile(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    profile, _ = ensure_profile_and_business(db, me)
    return profile

@app.put("/me/profile", response_model=UserProfileOut)
def update_profile(data: UserProfileUpdateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    profile, _ = ensure_profile_and_business(db, me)
    if data.phone is not None:
        profile.phone = data.phone
    if data.timezone is not None:
        profile.timezone = data.timezone
    if data.default_mileage_rate is not None:
        profile.default_mileage_rate = data.default_mileage_rate
    db.commit()
    db.refresh(profile)
    return profile

@app.get("/business", response_model=BusinessOut)
def get_business(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    return biz

@app.put("/business", response_model=BusinessOut)
def update_business(data: BusinessUpdateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(biz, field, value)
    db.commit()
    db.refresh(biz)
    return biz

# ----------------------------
# Clients
# ----------------------------
@app.get("/clients", response_model=List[ClientOut])
def list_clients(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    return db.query(Client).filter(Client.business_id == biz.id).order_by(Client.id.desc()).all()

@app.post("/clients", response_model=ClientOut)
def create_client(data: ClientCreateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    c = Client(business_id=biz.id, **data.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@app.put("/clients/{client_id}", response_model=ClientOut)
def update_client(client_id: int, data: ClientCreateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    c = db.query(Client).filter(Client.id == client_id, Client.business_id == biz.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c

@app.delete("/clients/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    c = db.query(Client).filter(Client.id == client_id, Client.business_id == biz.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(c)
    db.commit()
    return {"ok": True}

# ----------------------------
# Vendors
# ----------------------------
@app.get("/vendors", response_model=List[VendorOut])
def list_vendors(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    return db.query(Vendor).filter(Vendor.business_id == biz.id).order_by(Vendor.id.desc()).all()

@app.post("/vendors", response_model=VendorOut)
def create_vendor(data: VendorCreateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    v = Vendor(business_id=biz.id, **data.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)
    return v

@app.put("/vendors/{vendor_id}", response_model=VendorOut)
def update_vendor(vendor_id: int, data: VendorCreateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    v = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.business_id == biz.id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    for k, val in data.model_dump().items():
        setattr(v, k, val)
    db.commit()
    db.refresh(v)
    return v

@app.delete("/vendors/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    v = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.business_id == biz.id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    db.delete(v)
    db.commit()
    return {"ok": True}

# ----------------------------
# Jobs
# ----------------------------
@app.get("/jobs", response_model=List[JobOut])
def list_jobs(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    return db.query(Job).filter(Job.user_id == me.id, Job.business_id == biz.id).order_by(Job.id.desc()).all()

@app.post("/jobs", response_model=JobOut)
def create_job(data: JobCreateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)

    if data.client_id is not None:
        c = db.query(Client).filter(Client.id == data.client_id, Client.business_id == biz.id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Client not found")

    job = Job(
        user_id=me.id,
        business_id=biz.id,
        title=data.title,
        client_name=data.client_name,
        client_id=data.client_id,
        status="open",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

@app.put("/jobs/{job_id}", response_model=JobOut)
def update_job(job_id: int, data: JobUpdateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == me.id, Job.business_id == biz.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if data.client_id is not None:
        c = db.query(Client).filter(Client.id == data.client_id, Client.business_id == biz.id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Client not found")
        job.client_id = data.client_id

    if data.title is not None:
        job.title = data.title
    if data.client_name is not None:
        job.client_name = data.client_name
    if data.status is not None:
        job.status = data.status

    db.commit()
    db.refresh(job)
    return job

@app.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == me.id, Job.business_id == biz.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"ok": True}

# ----------------------------
# Invoices
# ----------------------------
@app.get("/invoices", response_model=List[InvoiceOut])
def list_invoices(job_id: Optional[int] = None, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    q = db.query(Invoice).filter(Invoice.user_id == me.id, Invoice.business_id == biz.id)
    if job_id is not None:
        q = q.filter(Invoice.job_id == job_id)
    return q.order_by(Invoice.id.desc()).all()

def allocate_invoice_number(db: Session, biz: Business) -> str:
    prefix = biz.invoice_prefix or "INV-"
    number = biz.next_invoice_number or 1
    biz.next_invoice_number = number + 1
    db.commit()
    db.refresh(biz)
    return f"{prefix}{number:04d}"

@app.post("/invoices", response_model=InvoiceOut)
def create_invoice(data: InvoiceCreateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)

    if data.job_id is not None:
        job = db.query(Job).filter(Job.id == data.job_id, Job.user_id == me.id, Job.business_id == biz.id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found for this user")

    inv_num = allocate_invoice_number(db, biz)
    inv = Invoice(
        user_id=me.id,
        business_id=biz.id,
        job_id=data.job_id,
        amount=data.amount,
        note=data.note,
        status=data.status or "unpaid",
        due_date=data.due_date,
        invoice_number=inv_num,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv

@app.put("/invoices/{invoice_id}", response_model=InvoiceOut)
def update_invoice(invoice_id: int, data: InvoiceUpdateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    inv = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.user_id == me.id, Invoice.business_id == biz.id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if data.job_id is not None:
        if data.job_id:
            job = db.query(Job).filter(Job.id == data.job_id, Job.user_id == me.id, Job.business_id == biz.id).first()
            if not job:
                raise HTTPException(status_code=404, detail="Job not found")
        inv.job_id = data.job_id

    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "job_id":
            continue
        setattr(inv, k, v)

    db.commit()
    db.refresh(inv)
    return inv

@app.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    inv = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.user_id == me.id, Invoice.business_id == biz.id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(inv)
    db.commit()
    return {"ok": True}

@app.post("/invoices/{invoice_id}/pdf", response_model=InvoiceOut)
def generate_invoice_pdf(invoice_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    inv = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.user_id == me.id, Invoice.business_id == biz.id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Build PDF
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=LETTER)
    width, height = LETTER

    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, height - 60, biz.name or "Business")

    c.setFont("Helvetica", 11)
    addr = " ".join([x for x in [biz.address_line1, biz.address_line2, biz.city, biz.state, biz.postal_code] if x])
    if addr:
        c.drawString(50, height - 80, addr)

    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, height - 120, f"Invoice {inv.invoice_number or inv.id}")

    c.setFont("Helvetica", 12)
    c.drawString(50, height - 150, f"Amount: ${inv.amount:.2f}")
    c.drawString(50, height - 170, f"Status: {inv.status or ''}")
    if inv.due_date:
        c.drawString(50, height - 190, f"Due date: {inv.due_date}")

    if inv.note:
        c.setFont("Helvetica", 11)
        c.drawString(50, height - 220, "Note:")
        text = c.beginText(50, height - 240)
        text.setFont("Helvetica", 11)
        for line in str(inv.note).splitlines()[:10]:
            text.textLine(line)
        c.drawText(text)

    c.setFont("Helvetica", 10)
    c.drawString(50, 60, biz.default_terms or "Due on receipt")

    c.showPage()
    c.save()
    pdf_bytes = buf.getvalue()

    bucket = os.getenv("S3_BUCKET")
    key = f"business_{biz.id}/invoices/{inv.invoice_number or inv.id}_{uuid.uuid4().hex}.pdf"
    url = s3_put_bytes(bucket, key, "application/pdf", pdf_bytes)
    inv.pdf_url = url
    db.commit()
    db.refresh(inv)
    return inv

# ----------------------------
# Expenses
# ----------------------------
@app.get("/expenses", response_model=List[ExpenseOut])
def list_expenses(job_id: Optional[int] = None, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    q = db.query(Expense).filter(Expense.user_id == me.id, Expense.business_id == biz.id)
    if job_id is not None:
        q = q.filter(Expense.job_id == job_id)
    return q.order_by(Expense.id.desc()).all()

@app.post("/expenses", response_model=ExpenseOut)
def create_expense(data: ExpenseCreateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)

    if data.job_id is not None:
        job = db.query(Job).filter(Job.id == data.job_id, Job.user_id == me.id, Job.business_id == biz.id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found for this user")

    if data.vendor_id is not None:
        vend = db.query(Vendor).filter(Vendor.id == data.vendor_id, Vendor.business_id == biz.id).first()
        if not vend:
            raise HTTPException(status_code=404, detail="Vendor not found")

    exp = Expense(
        user_id=me.id,
        business_id=biz.id,
        job_id=data.job_id,
        vendor_id=data.vendor_id,
        amount=data.amount,
        category=data.category,
        category_code=data.category_code,
        note=data.note,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp

@app.put("/expenses/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: int, data: ExpenseUpdateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    exp = db.query(Expense).filter(Expense.id == expense_id, Expense.user_id == me.id, Expense.business_id == biz.id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")

    if data.job_id is not None:
        if data.job_id:
            job = db.query(Job).filter(Job.id == data.job_id, Job.user_id == me.id, Job.business_id == biz.id).first()
            if not job:
                raise HTTPException(status_code=404, detail="Job not found")
        exp.job_id = data.job_id

    if data.vendor_id is not None:
        if data.vendor_id:
            vend = db.query(Vendor).filter(Vendor.id == data.vendor_id, Vendor.business_id == biz.id).first()
            if not vend:
                raise HTTPException(status_code=404, detail="Vendor not found")
        exp.vendor_id = data.vendor_id

    for k, v in data.model_dump(exclude_unset=True).items():
        if k in {"job_id", "vendor_id"}:
            continue
        setattr(exp, k, v)

    db.commit()
    db.refresh(exp)
    return exp

@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    exp = db.query(Expense).filter(Expense.id == expense_id, Expense.user_id == me.id, Expense.business_id == biz.id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(exp)
    db.commit()
    return {"ok": True}

# ----------------------------
# Mileage
# ----------------------------
@app.get("/mileage", response_model=List[MileageOut])
def list_mileage(job_id: Optional[int] = None, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    q = db.query(Mileage).filter(Mileage.user_id == me.id, Mileage.business_id == biz.id)
    if job_id is not None:
        q = q.filter(Mileage.job_id == job_id)
    return q.order_by(Mileage.id.desc()).all()

@app.post("/mileage", response_model=MileageOut)
def create_mileage(data: MileageCreateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    if data.job_id is not None:
        job = db.query(Job).filter(Job.id == data.job_id, Job.user_id == me.id, Job.business_id == biz.id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found for this user")

    item = Mileage(user_id=me.id, business_id=biz.id, job_id=data.job_id, miles=data.miles, note=data.note)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.delete("/mileage/{mileage_id}")
def delete_mileage(mileage_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    item = db.query(Mileage).filter(Mileage.id == mileage_id, Mileage.user_id == me.id, Mileage.business_id == biz.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Mileage not found")
    db.delete(item)
    db.commit()
    return {"ok": True}

# ----------------------------
# Receipts
# ----------------------------
@app.post("/receipts/presign", response_model=ReceiptPresignOut)
def receipt_presign(data: ReceiptPresignIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)
    bucket = os.getenv("S3_BUCKET")
    safe_name = data.filename.replace("/", "_").replace("\\", "_")
    key = f"business_{biz.id}/receipts/{uuid.uuid4().hex}_{safe_name}"
    upload_url = s3_presign_put(bucket, key, data.content_type)
    return {"key": key, "upload_url": upload_url, "file_url": s3_object_public_url(bucket, key)}

@app.post("/receipts", response_model=ReceiptOut)
def create_receipt(data: ReceiptCreateIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    biz = current_business(db, me)

    if data.job_id is not None:
        job = db.query(Job).filter(Job.id == data.job_id, Job.user_id == me.id, Job.business_id == biz.id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

    if data.expense_id is not None:
        exp = db.query(Expense).filter(Expense.id == data.expense_id, Expense.user_id == me.id, Expense.business_id == biz.id).first()
        if not exp:
            raise HTTPException(status_code=404, detail="Expense not found")

    if data.vendor_id is not None:
        vend = db.query(Vendor).filter(Vendor.id == data.vendor_id, Vendor.business_id == biz.id).first()
        if not vend:
            raise HTTPException(status_code=404, detail="Vendor not found")

    r = Receipt(
        business_id=biz.id,
        key=data.key,
        file_url=data.file_url,
        content_type=data.content_type,
        original_filename=data.original_filename,
        size_bytes=data.size_bytes,
        job_id=data.job_id,
        expense_id=data.expense_id,
        vendor_id=data.vendor_id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r

@app.get("/receipts", response_model=List[ReceiptOut])
def list_receipts(
    job_id: Optional[int] = None,
    expense_id: Optional[int] = None,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    biz = current_business(db, me)
    q = db.query(Receipt).filter(Receipt.business_id == biz.id)
    if job_id is not None:
        q = q.filter(Receipt.job_id == job_id)
    if expense_id is not None:
        q = q.filter(Receipt.expense_id == expense_id)
    return q.order_by(Receipt.id.desc()).all()

@app.delete("/users/me")
def delete_my_account(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    db.delete(me)
    db.commit()
    return {"ok": True}
