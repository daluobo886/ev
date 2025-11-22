"""Pydantic schemas for FastAPI responses."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    dates: List[str]
    industries: List[str]


class SnapshotItem(BaseModel):
    ticker: str
    name: Optional[str]
    industry: Optional[str]
    close: Optional[float]
    PE_TTM: Optional[float]
    PB: Optional[float]
    PS_TTM: Optional[float]
    EV_EBITDA: Optional[float]
    value_score: Optional[float]
    PE_TTM_pct: Optional[float] = Field(None, description="PE percentile")
    PB_pct: Optional[float]
    PS_TTM_pct: Optional[float]
    EV_EBITDA_pct: Optional[float]


class SnapshotResponse(BaseModel):
    data: List[SnapshotItem]


class StockSummary(BaseModel):
    ticker: str
    name: Optional[str]
    industry: Optional[str]
    close: Optional[float]
    PE_TTM: Optional[float]
    PB: Optional[float]
    PS_TTM: Optional[float]
    EV_EBITDA: Optional[float]
    value_score: Optional[float]
    universe_value_rank: Optional[int]
    industry_value_rank: Optional[int]


class HeatmapItem(BaseModel):
    industry: Optional[str]
    median_PE_TTM: Optional[float]
    median_PB: Optional[float]
    median_PS_TTM: Optional[float]
    median_value_score: Optional[float]
    count: int


class ScatterPoint(BaseModel):
    ticker: str
    name: Optional[str]
    color: Optional[str]
    value_score: Optional[float]
    mktcap: Optional[float]
    x_value: Optional[float] = Field(None, alias="x")
    y_value: Optional[float] = Field(None, alias="y")


class ScatterResponse(BaseModel):
    points: List[ScatterPoint]
