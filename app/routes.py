"""API route definitions."""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from .factor_engine import (
    FactorEngine,
    get_heatmap_data_json,
    get_scatter_data_json,
    get_snapshot_json,
    get_stock_summary_json,
)
from .schemas import HeatmapItem, ScatterResponse, SnapshotResponse, StockSummary, UploadResponse

router = APIRouter()

# Global engine for demo purposes; in production use dependency injection or cache
factor_engine: Optional[FactorEngine] = None


def get_engine() -> FactorEngine:
    if factor_engine is None:
        raise HTTPException(status_code=400, detail="No factor file uploaded yet")
    return factor_engine


@router.post("/upload-factors", response_model=UploadResponse)
async def upload_factors(file: UploadFile = File(...)):
    """Upload Excel and initialize FactorEngine."""
    suffix = Path(file.filename).suffix
    if suffix.lower() not in {".xlsx", ".xls"}:
        raise HTTPException(status_code=400, detail="Only Excel files are supported")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    global factor_engine
    factor_engine = FactorEngine.from_excel(tmp_path)
    return UploadResponse(
        dates=factor_engine.get_available_dates(),
        industries=factor_engine.get_industries(),
    )


@router.get("/dates")
async def get_dates(engine: FactorEngine = Depends(get_engine)):
    return engine.get_available_dates()


@router.get("/industries")
async def get_industries(date: Optional[str] = None, engine: FactorEngine = Depends(get_engine)):
    return engine.get_industries(date)


@router.get("/tickers")
async def get_tickers(
    date: Optional[str] = None, industry: Optional[str] = None, engine: FactorEngine = Depends(get_engine)
):
    data = engine.get_snapshot(date) if date else engine.df
    if industry:
        data = data[data["industry"] == industry]
    return sorted(data["ticker"].unique())


@router.get("/snapshot", response_model=SnapshotResponse)
async def snapshot(date: str, industry: Optional[str] = None, engine: FactorEngine = Depends(get_engine)):
    try:
        records = get_snapshot_json(engine, date, industry)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return SnapshotResponse(data=records)


@router.get("/stock-summary", response_model=StockSummary)
async def stock_summary(date: str, ticker: str, engine: FactorEngine = Depends(get_engine)):
    try:
        record = get_stock_summary_json(engine, date, ticker)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StockSummary(**record)


@router.get("/heatmap", response_model=list[HeatmapItem])
async def heatmap(date: str, engine: FactorEngine = Depends(get_engine)):
    try:
        data = get_heatmap_data_json(engine, date)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return data


@router.get("/scatter", response_model=ScatterResponse)
async def scatter(
    date: str,
    x: str,
    y: str,
    color_by: str = "industry",
    engine: FactorEngine = Depends(get_engine),
):
    try:
        data = get_scatter_data_json(engine, date, x, y, color_by)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    points = [{"x": item.pop(x, None), "y": item.pop(y, None), **item} for item in data]
    return ScatterResponse(points=points)
