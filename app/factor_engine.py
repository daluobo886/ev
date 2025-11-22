"""FactorEngine module for valuation analytics."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import numpy as np
import pandas as pd


NUMERIC_COLUMNS = [
    "close",
    "mktcap",
    "PE_TTM",
    "PE_FWD",
    "PB",
    "PS_TTM",
    "EV_EBITDA",
    "ROE",
    "EPS_G_3Y",
    "Sales_G_3Y",
    "Beta",
    "RnD_to_Sales",
]


@dataclass
class FactorEngine:
    """Encapsulates factor calculations and standardization utilities."""

    df: pd.DataFrame

    @classmethod
    def from_excel(cls, file_path: str) -> "FactorEngine":
        """Create an engine from an Excel file with basic cleaning."""
        raw = pd.read_excel(file_path, sheet_name="factors")
        df = raw.copy()
        if "date" not in df or "ticker" not in df:
            raise ValueError("Excel must contain 'date' and 'ticker' columns")

        df["date"] = pd.to_datetime(df["date"]).dt.date
        df = df.dropna(subset=["date", "ticker"]).copy()

        for col in NUMERIC_COLUMNS:
            if col in df:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        df = df.dropna(subset=["PE_TTM", "PB", "PS_TTM", "EV_EBITDA"], how="all")
        return cls(df)

    def get_available_dates(self) -> List[str]:
        dates = sorted(self.df["date"].dropna().unique())
        return [d.isoformat() for d in dates]

    def get_available_tickers(self, date: Optional[str] = None) -> List[str]:
        data = self.df
        if date:
            date_dt = pd.to_datetime(date).date()
            data = data[data["date"] == date_dt]
        return sorted(data["ticker"].dropna().unique())

    def get_industries(self, date: Optional[str] = None) -> List[str]:
        data = self.df
        if date:
            date_dt = pd.to_datetime(date).date()
            data = data[data["date"] == date_dt]
        industries = data.get("industry")
        return sorted(industries.dropna().unique()) if industries is not None else []

    def get_snapshot(self, date: str) -> pd.DataFrame:
        date_dt = pd.to_datetime(date).date()
        snapshot = self.df[self.df["date"] == date_dt].copy()
        if snapshot.empty:
            raise ValueError(f"No data found for date {date}")
        return snapshot

    @staticmethod
    def _compute_zscore(series: pd.Series) -> pd.Series:
        mean = series.mean()
        std = series.std(ddof=0)
        if std == 0 or np.isnan(std):
            return pd.Series([0.0] * len(series), index=series.index)
        return (series - mean) / std

    def compute_valuation_zscores(
        self, date: str, universe: str = "all", industry: Optional[str] = None
    ) -> pd.DataFrame:
        snapshot = self.get_snapshot(date)
        if universe == "industry" and industry:
            snapshot = snapshot[snapshot["industry"] == industry]
            if snapshot.empty:
                raise ValueError("No data for requested industry and date")

        factors = ["PE_TTM", "PE_FWD", "PB", "PS_TTM", "EV_EBITDA"]
        result = snapshot.copy()
        for factor in factors:
            if factor not in result:
                continue
            z = self._compute_zscore(result[factor])
            pct = result[factor].rank(pct=True) * 100
            result[f"{factor}_z"] = z
            result[f"{factor}_pct"] = pct
        return result

    def compute_composite_value_score(
        self, date: str, industry: Optional[str] = None
    ) -> pd.DataFrame:
        universe_df = self.compute_valuation_zscores(
            date, universe="industry" if industry else "all", industry=industry
        )
        valuation_z_cols = [
            col
            for col in universe_df.columns
            if col.endswith("_z")
            and (
                col.startswith("PE")
                or col.startswith("PB")
                or col.startswith("PS")
                or col.startswith("EV")
            )
        ]
        if not valuation_z_cols:
            universe_df["value_score"] = np.nan
        else:
            z_sum = sum(-universe_df[col] for col in valuation_z_cols)
            max_min_range = z_sum.max() - z_sum.min()
            if max_min_range == 0:
                value_score = pd.Series([50.0] * len(z_sum), index=z_sum.index)
            else:
                value_score = (z_sum - z_sum.min()) / max_min_range * 100
            universe_df["value_score"] = value_score.fillna(0)
        universe_df["value_rank"] = universe_df["value_score"].rank(
            ascending=False, method="min"
        )
        return universe_df


# Thin wrappers for FastAPI routes

def get_snapshot_json(engine: FactorEngine, date: str, industry: Optional[str] = None):
    df = engine.compute_composite_value_score(date, industry)
    if industry:
        df = df[df["industry"] == industry]
    return df.to_dict(orient="records")


def get_stock_summary_json(engine: FactorEngine, date: str, ticker: str):
    snapshot = engine.compute_composite_value_score(date)
    row = snapshot[snapshot["ticker"] == ticker]
    if row.empty:
        raise ValueError("Ticker not found for date")
    record = row.iloc[0].to_dict()
    industry = record.get("industry")
    industry_df = engine.compute_composite_value_score(date, industry=industry)
    in_industry = industry_df[industry_df["ticker"] == ticker]
    if not in_industry.empty:
        record["industry_value_rank"] = int(in_industry.iloc[0]["value_rank"])
    record["universe_value_rank"] = int(record.get("value_rank", 0))
    return record


def get_heatmap_data_json(engine: FactorEngine, date: str):
    snapshot = engine.compute_composite_value_score(date)
    grouped = snapshot.groupby("industry")
    summary = grouped.agg(
        median_PE_TTM=("PE_TTM", "median"),
        median_PB=("PB", "median"),
        median_PS_TTM=("PS_TTM", "median"),
        median_value_score=("value_score", "median"),
        count=("ticker", "count"),
    ).reset_index()
    return summary.to_dict(orient="records")


def get_scatter_data_json(
    engine: FactorEngine, date: str, x_factor: str, y_factor: str, color_by: str = "industry"
):
    snapshot = engine.compute_composite_value_score(date)
    cols = ["ticker", "name", color_by, x_factor, y_factor, "value_score", "mktcap"]
    existing_cols = [c for c in cols if c in snapshot]
    data = snapshot[existing_cols]
    if color_by in data:
        data = data.rename(columns={color_by: "color"})
    return data.to_dict(orient="records")
