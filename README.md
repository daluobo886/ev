# A-share Valuation MVP

This project provides a minimal A-share valuation analysis stack with a FastAPI backend and React + ECharts frontend. A pure frontend demo with simulated data is also included so you can preview visuals directly (e.g., via GitHub Pages) without running Python services.

## Backend

- **Tech**: FastAPI, pandas, numpy
- **Run**: `uvicorn app.main:app --reload`
- **Key module**: `app/factor_engine.py` implements `FactorEngine` for reading Excel factor data, cleaning, z-score standardization, and composite value scoring.

## Frontend

- **Tech**: React (Vite) + echarts-for-react
- **Run mock-only preview** (no backend required):
  ```bash
  cd frontend
  npm install
  npm run dev
  ```
  The SPA uses `src/mockData.js` for sample A-share factors.
- **Static build for GitHub Pages**:
  ```bash
  npm run build
  ```
  Deploy the generated `frontend/dist` folder as-is; it has no API dependency for the demo.

## Excel Format

Upload an Excel file with a sheet named `factors` and columns such as `date`, `ticker`, `industry`, `PE_TTM`, `PB`, `PS_TTM`, `EV_EBITDA`, etc.

## Notes

- API base path: `/api`
- CORS is open for local development.
- Extend `FactorEngine` to add new factor composites (quality, growth, risk) or cross-market comparisons.
