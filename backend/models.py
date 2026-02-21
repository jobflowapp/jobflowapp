# backend/models.py
from __future__ import annotations

import sqlite3
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    func,
    event,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import relationship

from db import Base


# SQLite must have foreign keys enabled for ON DELETE CASCADE to work
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    profile = relationship(
        "UserProfile",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    business = relationship(
        "Business",
        back_populates="owner",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )

    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    phone = Column(String, nullable=True)
    timezone = Column(String, nullable=True, default="America/New_York")
    default_mileage_rate = Column(Float, nullable=True, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="profile")


class Business(Base):
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    name = Column(String, nullable=False, default="My Business")
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    address_line1 = Column(String, nullable=True)
    address_line2 = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)
    country = Column(String, nullable=True, default="US")

    ein = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)

    invoice_prefix = Column(String, nullable=True, default="INV-")
    next_invoice_number = Column(Integer, nullable=False, default=1)
    default_terms = Column(String, nullable=True, default="Due on receipt")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="business")

    clients = relationship("Client", back_populates="business", cascade="all, delete-orphan", passive_deletes=True)
    vendors = relationship("Vendor", back_populates="business", cascade="all, delete-orphan", passive_deletes=True)
    receipts = relationship("Receipt", back_populates="business", cascade="all, delete-orphan", passive_deletes=True)


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    business = relationship("Business", back_populates="clients")
    jobs = relationship("Job", back_populates="client")


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    default_category = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    business = relationship("Business", back_populates="vendors")
    expenses = relationship("Expense", back_populates="vendor")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String, nullable=False)
    client_name = Column(String, nullable=True)
    status = Column(String, nullable=True)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="jobs")
    client = relationship("Client", back_populates="jobs")

    invoices = relationship("Invoice", back_populates="job", cascade="all, delete-orphan", passive_deletes=True)
    expenses = relationship("Expense", back_populates="job", cascade="all, delete-orphan", passive_deletes=True)
    mileage_entries = relationship("Mileage", back_populates="job", cascade="all, delete-orphan", passive_deletes=True)
    receipts = relationship("Receipt", back_populates="job", cascade="all, delete-orphan", passive_deletes=True)


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True, index=True)

    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True, index=True)

    amount = Column(Float, nullable=False, default=0)
    note = Column(String, nullable=True)
    status = Column(String, nullable=True, default="unpaid")

    invoice_number = Column(String, nullable=True)
    due_date = Column(String, nullable=True)
    pdf_url = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", back_populates="invoices")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True, index=True)

    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True, index=True)

    amount = Column(Float, nullable=False, default=0)
    category = Column(String, nullable=False, default="Other")
    category_code = Column(String, nullable=True)
    note = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", back_populates="expenses")
    vendor = relationship("Vendor", back_populates="expenses")
    receipts = relationship("Receipt", back_populates="expense", cascade="all, delete-orphan", passive_deletes=True)


class Mileage(Base):
    __tablename__ = "mileage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True, index=True)

    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True, index=True)

    miles = Column(Float, nullable=False, default=0)
    note = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", back_populates="mileage_entries")


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)

    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id", ondelete="CASCADE"), nullable=True, index=True)

    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True, index=True)

    file_url = Column(String, nullable=False)
    key = Column(String, nullable=True)
    content_type = Column(String, nullable=True)
    original_filename = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    business = relationship("Business", back_populates="receipts")
    job = relationship("Job", back_populates="receipts")
    expense = relationship("Expense", back_populates="receipts")
