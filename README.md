# A-Share Valuation Static Preview

This repository now contains a single, self-contained HTML demo that runs entirely in the browser with mocked A-share factor data. It is optimized for quick visual review (e.g., GitHub Pages) without any backend or build tooling.

## Features
- Dark-themed layout with market overview, industry heatmap, PB vs ROE scatter, snapshot table, and stock valuation card.
- Interactive selectors for date / industry / ticker powered by in-page mock data (multiple dates included).
- All computations (percentiles, z-like scores, value score) are handled in JavaScript—no uploads or APIs required.

## Usage
1. Open `index.html` directly in your browser, or host it statically (GitHub Pages, Vercel static, S3, etc.).
2. Use the selectors on the left to switch dates/industries/tickers and explore the charts and table.

No additional dependencies or commands are needed.
