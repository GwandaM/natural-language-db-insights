# Import Workbook Template

Generated workbook:

- `templates/investment_advisor_import_template.xlsx`
- `templates/investment_advisor_import_sample.xlsx`

Regenerate it with:

```bash
npm run template:workbook
```

Validate a workbook without writing to the database:

```bash
npm run seed:validate
```

Import the default sample workbook:

```bash
npm run migrate
npm run seed
```

Import your own workbook:

```bash
npm run seed -- path/to/your-workbook.xlsx
```

Rules:

- Keep sheet names unchanged.
- Use business keys from the workbook, not database IDs.
- Dates must be `YYYY-MM-DD`.
- Percentages must be decimal fractions, for example `0.075`.
- Monetary values must be raw numbers only.
- `policy` is the parent investment product/container record.
- `policy_holdings` is the underlying fund exposure per policy snapshot.
- `product.provider_name` is a plain display field because the app is single-provider for now.

The sample workbook contains realistic demo rows that are internally linked across all tabs:

- advisors map to clients via `advisor_code`
- clients map to policies via `client_ref`
- policies map to products via `product_code`
- policy holdings map to funds via `fund_isin`
- fund analytics map through `period_code`, `peer_group_name`, and `sector_name`

Tabs included:

- `Instructions`
- `advisors`
- `clients`
- `products`
- `product_costs`
- `product_features`
- `product_sources`
- `policies`
- `policy_holdings`
- `transactions`
- `advisor_aum`
- `sectors`
- `peer_groups`
- `periods`
- `funds`
- `fund_performance`
- `fund_risk`
- `fund_flows`
- `fund_rankings`
- `peer_group_stats`
