"""
Admin dashboard API routes.
Protected by ADMIN_TOKEN from config/settings.
"""

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.analytics import Analytics
from config import settings

router = APIRouter(tags=["admin"])


def verify(x_admin_token: str = Header(...)):
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ------------------------------------------------------------------ stats

@router.get("/stats/today")
def stats_today(_ = Depends(verify)):
    return Analytics.stats_today()


@router.get("/stats/monthly")
def stats_monthly(_ = Depends(verify)):
    return Analytics.stats_monthly()


@router.get("/stats/active-now")
def active_now(_ = Depends(verify)):
    return {"active_now": Analytics.stats_active_now()}


# ------------------------------------------------------------------ donations

class DonationIn(BaseModel):
    donor_name: str
    amount: float
    method: str
    note: Optional[str] = ""


@router.get("/donations")
def list_donations(_ = Depends(verify)):
    return {
        "total": Analytics.donation_total(),
        "donations": Analytics.donations_list()
    }


@router.post("/donations")
def add_donation(body: DonationIn, _ = Depends(verify)):
    Analytics.add_donation(body.donor_name, body.amount, body.method, body.note)
    return {"ok": True}


@router.delete("/donations/{donation_id}")
def delete_donation(donation_id: int, _ = Depends(verify)):
    Analytics.delete_donation(donation_id)
    return {"ok": True}