from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from xml.sax.saxutils import escape
import zipfile


REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "templates"
OUTPUT_PATH = OUTPUT_DIR / "investment_advisor_import_template.xlsx"
SAMPLE_OUTPUT_PATH = OUTPUT_DIR / "investment_advisor_import_sample.xlsx"


SheetDef = dict[str, object]


DATA_SHEETS: list[SheetDef] = [
    {
        "name": "advisors",
        "columns": [
            "advisor_code",
            "advisor_name",
            "email",
            "branch",
            "region",
            "active",
        ],
        "required": "Yes",
        "purpose": "Advisor master data for dashboard scoping.",
        "keys": "advisor_code",
    },
    {
        "name": "clients",
        "columns": [
            "client_ref",
            "advisor_code",
            "first_name",
            "last_name",
            "email",
            "phone",
            "date_of_birth",
            "risk_profile",
            "vitality_status",
            "client_since",
            "status",
            "id_number",
            "annual_income",
            "target_retirement_age",
            "annual_income_need",
            "source_as_of_date",
        ],
        "required": "Yes",
        "purpose": "Client book owned by advisors.",
        "keys": "client_ref -> advisor_code",
    },
    {
        "name": "products",
        "columns": [
            "product_code",
            "provider_name",
            "product_name",
            "product_family",
            "product_type",
            "vehicle_type",
            "comparison_group",
            "risk_band",
            "target_market",
            "minimum_investment",
            "minimum_debit_order",
            "default_phase",
            "initial_commission_pct",
            "recurring_commission_pct",
            "trail_commission_pct",
            "eac_confidence",
            "active",
            "source_asof_date",
        ],
        "required": "Yes",
        "purpose": "Single-provider product catalogue linked directly to policy.",
        "keys": "product_code",
    },
    {
        "name": "product_costs",
        "columns": [
            "product_code",
            "component_type",
            "charge_basis",
            "value_min",
            "value_max",
            "frequency",
            "notes",
            "is_included_in_eac",
            "display_order",
            "source_as_of_date",
        ],
        "required": "Optional",
        "purpose": "Recurring and upfront product cost components for product intelligence.",
        "keys": "product_code + component_type + display_order",
    },
    {
        "name": "product_features",
        "columns": [
            "product_code",
            "feature_key",
            "feature_value",
            "display_label",
            "source_as_of_date",
        ],
        "required": "Optional",
        "purpose": "Human-readable product features shown alongside product details.",
        "keys": "product_code + feature_key + display_label",
    },
    {
        "name": "product_sources",
        "columns": [
            "product_code",
            "source_url",
            "document_type",
            "page_ref",
            "evidence_snippet",
            "captured_at",
            "source_as_of_date",
        ],
        "required": "Optional",
        "purpose": "Source evidence for product costs/features.",
        "keys": "product_code + source_url + document_type + page_ref",
    },
    {
        "name": "policies",
        "columns": [
            "policy_number",
            "client_ref",
            "product_code",
            "policy_name",
            "policy_type",
            "phase",
            "status",
            "inception_date",
            "commence_date",
            "anniversary_date",
            "annuity_income_review_date",
            "initial_investment",
            "current_value",
            "units_held",
            "recurring_premium",
            "monthly_contribution",
            "single_premium",
            "monthly_income",
            "drawdown_rate_pct",
            "beneficiary_nominated",
            "as_of_date",
            "source_as_of_date",
        ],
        "required": "Yes",
        "purpose": "Client-held investment products. Replaces the old wrapper concept.",
        "keys": "policy_number -> client_ref + product_code",
    },
    {
        "name": "policy_holdings",
        "columns": [
            "policy_number",
            "fund_isin",
            "allocation_pct",
            "current_value",
            "units_held",
            "inception_date",
            "as_of_date",
            "source_as_of_date",
        ],
        "required": "Optional",
        "purpose": "Underlying fund exposure per policy snapshot.",
        "keys": "policy_number + fund_isin + as_of_date",
    },
    {
        "name": "transactions",
        "columns": [
            "policy_number",
            "fund_isin",
            "transaction_type",
            "transaction_date",
            "amount",
            "units",
            "nav_price",
            "status",
            "source_as_of_date",
        ],
        "required": "Optional",
        "purpose": "Policy cashflow and activity history for dashboard and client pages.",
        "keys": "policy_number + transaction_type + transaction_date + amount",
    },
    {
        "name": "advisor_aum",
        "columns": [
            "advisor_code",
            "as_of_date",
            "total_aum",
            "total_clients",
            "active_policies",
            "monthly_revenue",
            "source_as_of_date",
        ],
        "required": "Optional",
        "purpose": "Advisor-level AUM snapshots used by briefing and leaderboard views.",
        "keys": "advisor_code + as_of_date",
    },
    {
        "name": "sectors",
        "columns": [
            "sector_name",
            "asisa_category_name",
            "source_as_of_date",
        ],
        "required": "Yes",
        "purpose": "Top-level ASISA sector classification.",
        "keys": "sector_name",
    },
    {
        "name": "peer_groups",
        "columns": [
            "peer_group_name",
            "display_group_name",
            "sector_name",
            "source_as_of_date",
        ],
        "required": "Yes",
        "purpose": "Peer groups within sectors.",
        "keys": "peer_group_name -> sector_name",
    },
    {
        "name": "periods",
        "columns": [
            "period_code",
            "period_type",
            "end_date",
            "is_annualized",
            "display_order",
            "source_as_of_date",
        ],
        "required": "Yes",
        "purpose": "Canonical reporting periods for fund analytics.",
        "keys": "period_code",
    },
    {
        "name": "funds",
        "columns": [
            "fund_isin",
            "fund_name",
            "ticker",
            "inception_date",
            "management_fee",
            "net_expense_ratio",
            "fund_size",
            "morningstar_rating_overall",
            "peer_group_name",
            "sector_name",
            "source_asof_date",
        ],
        "required": "Yes",
        "purpose": "Fund master data linked to holdings and analytics.",
        "keys": "fund_isin -> peer_group_name + sector_name",
    },
    {
        "name": "fund_performance",
        "columns": [
            "fund_isin",
            "period_code",
            "as_of_date",
            "return_annualized",
            "return_cumulative",
            "best_month",
            "worst_month",
            "up_capture_ratio",
            "down_capture_ratio",
            "up_percent_ratio",
            "down_percent_ratio",
            "r_squared",
            "source_as_of_date",
        ],
        "required": "Optional",
        "purpose": "Fund performance fact table.",
        "keys": "fund_isin + period_code + as_of_date",
    },
    {
        "name": "fund_risk",
        "columns": [
            "fund_isin",
            "period_code",
            "as_of_date",
            "std_dev_annualized",
            "sharpe_ratio_annualized",
            "sortino_ratio_annualized",
            "treynor_ratio_annualized",
            "tracking_error_annualized",
            "source_as_of_date",
        ],
        "required": "Optional",
        "purpose": "Fund risk fact table.",
        "keys": "fund_isin + period_code + as_of_date",
    },
    {
        "name": "fund_flows",
        "columns": [
            "fund_isin",
            "period_code",
            "as_of_date",
            "estimated_net_flow",
            "fund_size",
            "source_as_of_date",
        ],
        "required": "Optional",
        "purpose": "Fund flow fact table.",
        "keys": "fund_isin + period_code + as_of_date",
    },
    {
        "name": "fund_rankings",
        "columns": [
            "fund_isin",
            "peer_group_name",
            "period_code",
            "as_of_date",
            "peer_group_rank",
            "peer_group_quartile",
            "investments_ranked_count",
            "source_as_of_date",
        ],
        "required": "Optional",
        "purpose": "Fund peer-group ranking fact table.",
        "keys": "fund_isin + period_code + as_of_date",
    },
    {
        "name": "peer_group_stats",
        "columns": [
            "peer_group_name",
            "period_code",
            "as_of_date",
            "metric_name",
            "stat_type",
            "metric_value",
            "source_as_of_date",
        ],
        "required": "Optional",
        "purpose": "Peer group aggregate statistics.",
        "keys": "peer_group_name + period_code + as_of_date + metric_name + stat_type",
    },
]

SAMPLE_ROWS: dict[str, list[list[str]]] = {
    "advisors": [
        ["AD001", "Nandi Maseko", "nandi.maseko@example.com", "Cape Town", "Western Cape", "TRUE"],
        ["AD002", "Johan van der Merwe", "johan.vdm@example.com", "Johannesburg", "Gauteng", "TRUE"],
    ],
    "clients": [
        ["CL001", "AD001", "Lerato", "Khumalo", "lerato.khumalo@example.com", "0825550101", "1986-04-14", "moderate", "gold", "2019-03-01", "active", "8604140123088", "1200000", "65", "600000", "2026-03-31"],
        ["CL002", "AD001", "Thabo", "Mokoena", "thabo.mokoena@example.com", "0835550102", "1958-11-02", "conservative", "silver", "2015-07-15", "active", "5811025099084", "850000", "60", "540000", "2026-03-31"],
        ["CL003", "AD002", "Aisha", "Patel", "aisha.patel@example.com", "0845550103", "1990-08-21", "aggressive", "blue", "2020-05-01", "dormant", "9008210134083", "1400000", "65", "700000", "2026-03-31"],
        ["CL004", "AD002", "Sipho", "Dlamini", "sipho.dlamini@example.com", "0715550104", "1982-01-10", "moderate", "gold", "2017-09-10", "active", "8201105432081", "980000", "63", "500000", "2026-03-31"],
    ],
    "products": [
        ["PRD-LIB-RA-CORE", "Liberty", "Liberty Core Retirement Annuity", "Core Retirement", "retirement_annuity", "retirement_annuity", "retirement_high_equity", "balanced", "Long-term retirement savers", "500", "500", "accumulation", "0.0000", "0.0000", "0.0075", "medium", "TRUE", "2026-03-31"],
        ["PRD-LIB-RA-INDEX", "Liberty", "Liberty Index Retirement Annuity", "Core Retirement", "retirement_annuity", "retirement_annuity", "retirement_high_equity", "balanced", "Cost-conscious retirement savers", "500", "500", "accumulation", "0.0000", "0.0000", "0.0060", "high", "TRUE", "2026-03-31"],
        ["PRD-LIB-TFSA", "Liberty", "Liberty Tax-Free Savings Plan", "Core Savings", "tfsa", "tfsa", "tax_free_flexible", "moderate", "Tax-free discretionary savers", "500", "250", "accumulation", "0.0000", "0.0000", "0.0050", "medium", "TRUE", "2026-03-31"],
        ["PRD-LIB-LA", "Liberty", "Liberty Living Annuity Select", "Income Solutions", "living_annuity", "living_annuity", "income_drawdown", "income", "Retirees drawing income", "250000", "0", "drawdown", "0.0000", "0.0000", "0.0100", "medium", "TRUE", "2026-03-31"],
        ["PRD-LIB-END", "Liberty", "Liberty Secure Endowment", "Wealth Builder", "endowment", "endowment", "moderate_growth", "conservative", "Medium-term tax-aware savers", "50000", "0", "accumulation", "0.0000", "0.0000", "0.0065", "medium", "TRUE", "2026-03-31"],
        ["PRD-LIB-UT", "Liberty", "Liberty Growth Unit Trust", "Flexible Invest", "unit_trust", "unit_trust", "moderate_growth", "aggressive", "Flexible long-term investors", "1000", "500", "accumulation", "0.0000", "0.0000", "0.0060", "high", "TRUE", "2026-03-31"],
    ],
    "product_costs": [
        ["PRD-LIB-RA-CORE", "total_expense_ratio", "annual_pct", "0.0130", "0.0130", "annual", "Latest recurring TER.", "TRUE", "1", "2026-03-31"],
        ["PRD-LIB-RA-CORE", "platform_fee", "annual_pct", "0.0020", "0.0020", "annual", "Platform servicing fee.", "TRUE", "2", "2026-03-31"],
        ["PRD-LIB-RA-INDEX", "total_expense_ratio", "annual_pct", "0.0080", "0.0080", "annual", "Index-based TER.", "TRUE", "1", "2026-03-31"],
        ["PRD-LIB-RA-INDEX", "platform_fee", "annual_pct", "0.0010", "0.0010", "annual", "Platform servicing fee.", "TRUE", "2", "2026-03-31"],
        ["PRD-LIB-TFSA", "total_expense_ratio", "annual_pct", "0.0110", "0.0110", "annual", "Latest recurring TER.", "TRUE", "1", "2026-03-31"],
        ["PRD-LIB-TFSA", "platform_fee", "annual_pct", "0.0015", "0.0015", "annual", "Platform servicing fee.", "TRUE", "2", "2026-03-31"],
        ["PRD-LIB-LA", "administration_fee", "annual_pct", "0.0025", "0.0025", "annual", "Policy administration charge.", "TRUE", "1", "2026-03-31"],
        ["PRD-LIB-LA", "total_expense_ratio", "annual_pct", "0.0090", "0.0090", "annual", "Underlying portfolio TER.", "TRUE", "2", "2026-03-31"],
        ["PRD-LIB-END", "total_expense_ratio", "annual_pct", "0.0120", "0.0120", "annual", "Latest recurring TER.", "TRUE", "1", "2026-03-31"],
        ["PRD-LIB-END", "platform_fee", "annual_pct", "0.0020", "0.0020", "annual", "Platform servicing fee.", "TRUE", "2", "2026-03-31"],
        ["PRD-LIB-UT", "total_expense_ratio", "annual_pct", "0.0090", "0.0090", "annual", "Latest recurring TER.", "TRUE", "1", "2026-03-31"],
        ["PRD-LIB-UT", "platform_fee", "annual_pct", "0.0010", "0.0010", "annual", "Platform servicing fee.", "TRUE", "2", "2026-03-31"],
    ],
    "product_features": [
        ["PRD-LIB-RA-CORE", "tax_wrapper", "Retirement annuity", "Tax wrapper", "2026-03-31"],
        ["PRD-LIB-TFSA", "annual_allowance", "36000", "Annual allowance", "2026-03-31"],
        ["PRD-LIB-LA", "income_review_cycle", "Annual", "Income review cycle", "2026-03-31"],
        ["PRD-LIB-END", "term", "5 years", "Policy term", "2026-03-31"],
        ["PRD-LIB-UT", "liquidity", "Daily dealing", "Liquidity", "2026-03-31"],
    ],
    "product_sources": [
        ["PRD-LIB-RA-CORE", "https://example.com/liberty-ra-core", "factsheet", "p1", "Sample factsheet used for template illustration.", "2026-04-01T09:00:00Z", "2026-03-31"],
        ["PRD-LIB-RA-INDEX", "https://example.com/liberty-ra-index", "factsheet", "p1", "Sample factsheet used for template illustration.", "2026-04-01T09:00:00Z", "2026-03-31"],
        ["PRD-LIB-TFSA", "https://example.com/liberty-tfsa", "factsheet", "p2", "Sample factsheet used for template illustration.", "2026-04-01T09:00:00Z", "2026-03-31"],
        ["PRD-LIB-LA", "https://example.com/liberty-la", "brochure", "p3", "Sample brochure used for template illustration.", "2026-04-01T09:00:00Z", "2026-03-31"],
        ["PRD-LIB-END", "https://example.com/liberty-endowment", "brochure", "p4", "Sample brochure used for template illustration.", "2026-04-01T09:00:00Z", "2026-03-31"],
        ["PRD-LIB-UT", "https://example.com/liberty-ut", "factsheet", "p2", "Sample factsheet used for template illustration.", "2026-04-01T09:00:00Z", "2026-03-31"],
    ],
    "policies": [
        ["POL-RA-001", "CL001", "PRD-LIB-RA-CORE", "Lerato Retirement Annuity", "retirement_annuity", "accumulation", "active", "2019-03-01", "2019-03-01", "2026-03-01", "", "850000", "1250000", "125000.000000", "7500", "7500", "", "", "", "TRUE", "2026-03-31", "2026-03-31"],
        ["POL-TFSA-001", "CL001", "PRD-LIB-TFSA", "Lerato TFSA", "tfsa", "accumulation", "active", "2021-01-15", "2021-01-15", "", "", "120000", "210000", "21000.000000", "3000", "3000", "", "", "", "TRUE", "2026-03-31", "2026-03-31"],
        ["POL-LA-001", "CL002", "PRD-LIB-LA", "Thabo Living Annuity", "living_annuity", "drawdown", "active", "2018-07-01", "2018-07-01", "2026-07-01", "2026-07-01", "1600000", "1850000", "154000.000000", "", "", "", "12000", "0.0600", "FALSE", "2026-03-31", "2026-03-31"],
        ["POL-END-001", "CL003", "PRD-LIB-END", "Aisha Secure Endowment", "endowment", "accumulation", "active", "2020-05-01", "2020-05-01", "2026-05-01", "", "500000", "640000", "64000.000000", "", "", "500000", "", "", "TRUE", "2026-03-31", "2026-03-31"],
        ["POL-UT-001", "CL003", "PRD-LIB-UT", "Aisha Growth Unit Trust", "unit_trust", "accumulation", "active", "2022-02-01", "2022-02-01", "", "", "280000", "420000", "42000.000000", "5000", "5000", "", "", "", "TRUE", "2026-03-31", "2026-03-31"],
        ["POL-RA-002", "CL004", "PRD-LIB-RA-CORE", "Sipho Retirement Annuity", "retirement_annuity", "accumulation", "active", "2017-09-10", "2017-09-10", "2026-09-10", "", "720000", "980000", "98000.000000", "6500", "6500", "", "", "", "TRUE", "2026-03-31", "2026-03-31"],
    ],
    "policy_holdings": [
        ["POL-RA-001", "ZAE0000000001", "0.60", "750000", "75000.000000", "2019-03-01", "2026-03-31", "2026-03-31"],
        ["POL-RA-001", "ZAE0000000002", "0.25", "312500", "31250.000000", "2019-03-01", "2026-03-31", "2026-03-31"],
        ["POL-RA-001", "ZAE0000000003", "0.15", "187500", "18750.000000", "2019-03-01", "2026-03-31", "2026-03-31"],
        ["POL-TFSA-001", "ZAE0000000005", "0.70", "147000", "14700.000000", "2021-01-15", "2026-03-31", "2026-03-31"],
        ["POL-TFSA-001", "ZAE0000000004", "0.30", "63000", "6300.000000", "2021-01-15", "2026-03-31", "2026-03-31"],
        ["POL-LA-001", "ZAE0000000001", "0.50", "925000", "77083.333333", "2018-07-01", "2026-03-31", "2026-03-31"],
        ["POL-LA-001", "ZAE0000000003", "0.35", "647500", "53958.333333", "2018-07-01", "2026-03-31", "2026-03-31"],
        ["POL-LA-001", "ZAE0000000004", "0.15", "277500", "23125.000000", "2018-07-01", "2026-03-31", "2026-03-31"],
        ["POL-END-001", "ZAE0000000005", "0.55", "352000", "35200.000000", "2020-05-01", "2026-03-31", "2026-03-31"],
        ["POL-END-001", "ZAE0000000001", "0.45", "288000", "28800.000000", "2020-05-01", "2026-03-31", "2026-03-31"],
        ["POL-UT-001", "ZAE0000000002", "0.65", "273000", "27300.000000", "2022-02-01", "2026-03-31", "2026-03-31"],
        ["POL-UT-001", "ZAE0000000005", "0.35", "147000", "14700.000000", "2022-02-01", "2026-03-31", "2026-03-31"],
        ["POL-RA-002", "ZAE0000000001", "0.70", "686000", "68600.000000", "2017-09-10", "2026-03-31", "2026-03-31"],
        ["POL-RA-002", "ZAE0000000003", "0.30", "294000", "29400.000000", "2017-09-10", "2026-03-31", "2026-03-31"],
    ],
    "transactions": [
        ["POL-RA-001", "ZAE0000000001", "contribution", "2026-03-05", "7500", "750.000000", "10.0000", "settled", "2026-03-31"],
        ["POL-TFSA-001", "ZAE0000000005", "contribution", "2026-03-27", "3000", "200.000000", "15.0000", "settled", "2026-03-31"],
        ["POL-LA-001", "ZAE0000000004", "withdrawal", "2026-04-10", "12000", "850.000000", "14.1176", "settled", "2026-03-31"],
        ["POL-LA-001", "ZAE0000000001", "fee", "2026-03-31", "950", "", "", "settled", "2026-03-31"],
        ["POL-END-001", "ZAE0000000005", "switch_in", "2026-02-14", "50000", "3333.333333", "15.0000", "settled", "2026-03-31"],
        ["POL-UT-001", "ZAE0000000002", "contribution", "2026-04-02", "5000", "250.000000", "20.0000", "settled", "2026-03-31"],
        ["POL-RA-002", "ZAE0000000001", "contribution", "2026-04-01", "6500", "650.000000", "10.0000", "settled", "2026-03-31"],
        ["POL-RA-001", "ZAE0000000003", "dividend", "2026-01-15", "4200", "300.000000", "14.0000", "settled", "2026-03-31"],
    ],
    "advisor_aum": [
        ["AD001", "2026-03-31", "3310000", "2", "3", "8200", "2026-03-31"],
        ["AD002", "2026-03-31", "2040000", "2", "3", "5100", "2026-03-31"],
    ],
    "sectors": [
        ["SA Equity", "Domestic Equity", "2026-03-31"],
        ["Fixed Income", "Domestic Interest Bearing", "2026-03-31"],
        ["Multi-Asset", "Domestic Asset Allocation", "2026-03-31"],
        ["Money Market", "Domestic Money Market", "2026-03-31"],
        ["Real Estate", "Domestic Real Estate", "2026-03-31"],
    ],
    "peer_groups": [
        ["ASISA SA Equity General", "SA Equity General", "SA Equity", "2026-03-31"],
        ["ASISA SA Interest Bearing Variable Term", "Variable Term Income", "Fixed Income", "2026-03-31"],
        ["ASISA SA Multi Asset High Equity", "Multi-Asset High Equity", "Multi-Asset", "2026-03-31"],
        ["ASISA SA Interest Bearing Money Market", "Money Market", "Money Market", "2026-03-31"],
        ["ASISA Global Equity General", "Global Equity", "SA Equity", "2026-03-31"],
    ],
    "periods": [
        ["1Y", "trailing_1_year", "2026-03-31", "TRUE", "1", "2026-03-31"],
        ["3Y", "trailing_3_year", "2026-03-31", "TRUE", "2", "2026-03-31"],
        ["5Y", "trailing_5_year", "2026-03-31", "TRUE", "3", "2026-03-31"],
        ["SI", "since_inception", "2026-03-31", "TRUE", "4", "2026-03-31"],
    ],
    "funds": [
        ["ZAE0000000001", "Liberty Balanced Fund", "LBAL", "2014-06-01", "0.0095", "0.0140", "12500000000", "4.2", "ASISA SA Multi Asset High Equity", "Multi-Asset", "2026-03-31"],
        ["ZAE0000000002", "Liberty SA Equity Leaders Fund", "LEAD", "2012-09-01", "0.0120", "0.0165", "8300000000", "4.0", "ASISA SA Equity General", "SA Equity", "2026-03-31"],
        ["ZAE0000000003", "Liberty Income Plus Fund", "LINC", "2010-02-01", "0.0080", "0.0105", "6400000000", "3.8", "ASISA SA Interest Bearing Variable Term", "Fixed Income", "2026-03-31"],
        ["ZAE0000000004", "Liberty Money Market Fund", "LMMF", "2008-01-01", "0.0045", "0.0060", "10200000000", "3.5", "ASISA SA Interest Bearing Money Market", "Money Market", "2026-03-31"],
        ["ZAE0000000005", "Liberty Global Equity Feeder Fund", "LGEF", "2016-03-01", "0.0115", "0.0150", "7100000000", "4.1", "ASISA Global Equity General", "SA Equity", "2026-03-31"],
    ],
    "fund_performance": [
        ["ZAE0000000001", "1Y", "2026-03-31", "0.1280", "0.1280", "0.0320", "-0.0180", "1.0200", "0.8900", "0.6100", "0.4200", "0.9300", "2026-03-31"],
        ["ZAE0000000001", "3Y", "2026-03-31", "0.1120", "0.3740", "0.0290", "-0.0200", "0.9900", "0.9100", "0.5900", "0.4500", "0.9400", "2026-03-31"],
        ["ZAE0000000002", "1Y", "2026-03-31", "0.1540", "0.1540", "0.0510", "-0.0340", "1.0800", "0.9400", "0.6400", "0.3900", "0.9600", "2026-03-31"],
        ["ZAE0000000002", "3Y", "2026-03-31", "0.1360", "0.4660", "0.0470", "-0.0370", "1.0600", "0.9200", "0.6200", "0.4100", "0.9500", "2026-03-31"],
        ["ZAE0000000003", "1Y", "2026-03-31", "0.0970", "0.0970", "0.0170", "-0.0080", "0.9200", "0.9800", "0.5600", "0.5200", "0.9100", "2026-03-31"],
        ["ZAE0000000003", "3Y", "2026-03-31", "0.0840", "0.2740", "0.0140", "-0.0100", "0.9000", "0.9600", "0.5400", "0.5000", "0.9000", "2026-03-31"],
        ["ZAE0000000004", "1Y", "2026-03-31", "0.0780", "0.0780", "0.0070", "0.0040", "0.7100", "1.0100", "0.5100", "0.6100", "0.8800", "2026-03-31"],
        ["ZAE0000000004", "3Y", "2026-03-31", "0.0680", "0.2180", "0.0060", "0.0030", "0.7000", "1.0000", "0.5000", "0.6000", "0.8700", "2026-03-31"],
        ["ZAE0000000005", "1Y", "2026-03-31", "0.1820", "0.1820", "0.0580", "-0.0410", "1.1200", "0.8800", "0.6700", "0.3600", "0.9500", "2026-03-31"],
        ["ZAE0000000005", "3Y", "2026-03-31", "0.1490", "0.5150", "0.0520", "-0.0440", "1.1000", "0.8600", "0.6500", "0.3800", "0.9400", "2026-03-31"],
    ],
    "fund_risk": [
        ["ZAE0000000001", "1Y", "2026-03-31", "0.1120", "0.8400", "1.0300", "0.5400", "0.0460", "2026-03-31"],
        ["ZAE0000000001", "3Y", "2026-03-31", "0.1040", "0.9100", "1.1100", "0.5600", "0.0430", "2026-03-31"],
        ["ZAE0000000002", "1Y", "2026-03-31", "0.1680", "0.7900", "0.9800", "0.5100", "0.0610", "2026-03-31"],
        ["ZAE0000000002", "3Y", "2026-03-31", "0.1610", "0.8600", "1.0400", "0.5300", "0.0580", "2026-03-31"],
        ["ZAE0000000003", "1Y", "2026-03-31", "0.0590", "0.7200", "0.9000", "0.4400", "0.0250", "2026-03-31"],
        ["ZAE0000000003", "3Y", "2026-03-31", "0.0560", "0.7800", "0.9400", "0.4500", "0.0220", "2026-03-31"],
        ["ZAE0000000004", "1Y", "2026-03-31", "0.0070", "0.6100", "0.6500", "0.3000", "0.0040", "2026-03-31"],
        ["ZAE0000000004", "3Y", "2026-03-31", "0.0065", "0.6200", "0.6600", "0.3100", "0.0035", "2026-03-31"],
        ["ZAE0000000005", "1Y", "2026-03-31", "0.1810", "0.8800", "1.0900", "0.5700", "0.0640", "2026-03-31"],
        ["ZAE0000000005", "3Y", "2026-03-31", "0.1730", "0.9500", "1.1400", "0.5900", "0.0600", "2026-03-31"],
    ],
    "fund_flows": [
        ["ZAE0000000001", "1Y", "2026-03-31", "420000000", "12500000000", "2026-03-31"],
        ["ZAE0000000002", "1Y", "2026-03-31", "310000000", "8300000000", "2026-03-31"],
        ["ZAE0000000003", "1Y", "2026-03-31", "180000000", "6400000000", "2026-03-31"],
        ["ZAE0000000004", "1Y", "2026-03-31", "-50000000", "10200000000", "2026-03-31"],
        ["ZAE0000000005", "1Y", "2026-03-31", "275000000", "7100000000", "2026-03-31"],
    ],
    "fund_rankings": [
        ["ZAE0000000001", "ASISA SA Multi Asset High Equity", "1Y", "2026-03-31", "4", "2", "18", "2026-03-31"],
        ["ZAE0000000002", "ASISA SA Equity General", "1Y", "2026-03-31", "2", "1", "25", "2026-03-31"],
        ["ZAE0000000003", "ASISA SA Interest Bearing Variable Term", "1Y", "2026-03-31", "5", "2", "16", "2026-03-31"],
        ["ZAE0000000004", "ASISA SA Interest Bearing Money Market", "1Y", "2026-03-31", "8", "3", "14", "2026-03-31"],
        ["ZAE0000000005", "ASISA Global Equity General", "1Y", "2026-03-31", "1", "1", "12", "2026-03-31"],
    ],
    "peer_group_stats": [
        ["ASISA SA Multi Asset High Equity", "1Y", "2026-03-31", "return_annualized", "median", "0.1190", "2026-03-31"],
        ["ASISA SA Equity General", "1Y", "2026-03-31", "return_annualized", "median", "0.1410", "2026-03-31"],
        ["ASISA SA Interest Bearing Variable Term", "1Y", "2026-03-31", "return_annualized", "median", "0.0880", "2026-03-31"],
        ["ASISA SA Interest Bearing Money Market", "1Y", "2026-03-31", "return_annualized", "median", "0.0730", "2026-03-31"],
        ["ASISA Global Equity General", "1Y", "2026-03-31", "return_annualized", "median", "0.1610", "2026-03-31"],
    ],
}


def build_instructions_rows() -> list[list[str]]:
    rows: list[list[str]] = [
        [
            "Section",
            "Value",
            "Notes",
            "Key Rules",
        ],
        [
            "Workbook",
            "Investment Advisor CRM import template",
            "Use one workbook per import batch where possible.",
            "Keep sheet names unchanged.",
        ],
        [
            "Dates",
            "YYYY-MM-DD",
            "Use ISO dates only.",
            "Avoid Excel locale-formatted dates.",
        ],
        [
            "Percentages",
            "Decimal fractions",
            "Use 0.075 for 7.5%.",
            "Do not use '%' strings.",
        ],
        [
            "Money",
            "Raw numbers only",
            "No currency symbols or thousands separators in cells.",
            "All monetary values are ZAR.",
        ],
        [
            "Business keys",
            "Use codes and references",
            "Do not supply database surrogate IDs.",
            "Importer should resolve IDs internally.",
        ],
        [
            "Required tabs",
            "advisors, clients, products, policies, sectors, peer_groups, periods, funds",
            "Other sheets are optional depending on available source data.",
            "Dashboard can still run with partial analytics, but richer tabs need fund facts.",
        ],
        [],
        [
            "Sheet",
            "Required",
            "Purpose",
            "Business keys / joins",
        ],
    ]

    for sheet in DATA_SHEETS:
        rows.append(
            [
                str(sheet["name"]),
                str(sheet["required"]),
                str(sheet["purpose"]),
                str(sheet["keys"]),
            ]
        )

    return rows


def col_name(index: int) -> str:
    result = ""
    current = index
    while current > 0:
        current, remainder = divmod(current - 1, 26)
        result = chr(65 + remainder) + result
    return result


def inline_str_cell(ref: str, value: str) -> str:
    return (
        f'<c r="{ref}" t="inlineStr">'
        f"<is><t>{escape(value)}</t></is>"
        f"</c>"
    )


def worksheet_xml(rows: Iterable[Iterable[str]]) -> str:
    row_xml: list[str] = []
    for row_index, row in enumerate(rows, start=1):
        cells: list[str] = []
        for col_index, value in enumerate(row, start=1):
            if value is None:
                continue
            text = str(value)
            if text == "":
                continue
            cells.append(inline_str_cell(f"{col_name(col_index)}{row_index}", text))
        row_xml.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    dimension_cols = max((len(list(row)) for row in rows), default=1)
    # `rows` may be a list in our usage. If a generic iterable is passed, the
    # caller should materialize it first.
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<dimension ref="A1:{col_name(max(dimension_cols, 1))}{max(len(rows), 1)}"/>'
        "<sheetViews><sheetView workbookViewId=\"0\"/></sheetViews>"
        "<sheetFormatPr defaultRowHeight=\"15\"/>"
        f"<sheetData>{''.join(row_xml)}</sheetData>"
        "</worksheet>"
    )


def workbook_xml(sheet_names: list[str]) -> str:
    sheets = []
    for index, name in enumerate(sheet_names, start=1):
        sheets.append(
            f'<sheet name="{escape(name)}" sheetId="{index}" r:id="rId{index}"/>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        "<bookViews><workbookView/></bookViews>"
        f"<sheets>{''.join(sheets)}</sheets>"
        "</workbook>"
    )


def workbook_rels_xml(sheet_count: int) -> str:
    rels = []
    for index in range(1, sheet_count + 1):
        rels.append(
            f'<Relationship Id="rId{index}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            f'Target="worksheets/sheet{index}.xml"/>'
        )

    rels.append(
        f'<Relationship Id="rId{sheet_count + 1}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
        'Target="styles.xml"/>'
    )

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f"{''.join(rels)}"
        "</Relationships>"
    )


def root_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" '
        'Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" '
        'Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" '
        'Target="docProps/app.xml"/>'
        "</Relationships>"
    )


def content_types_xml(sheet_count: int) -> str:
    overrides = [
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/docProps/core.xml" '
        'ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
        '<Override PartName="/xl/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ]

    for index in range(1, sheet_count + 1):
        overrides.append(
            f'<Override PartName="/xl/worksheets/sheet{index}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        f"{''.join(overrides)}"
        "</Types>"
    )


def app_xml(sheet_names: list[str]) -> str:
    titles = "".join(f"<vt:lpstr>{escape(name)}</vt:lpstr>" for name in sheet_names)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        "<Application>OpenAI Codex</Application>"
        f"<TitlesOfParts><vt:vector size=\"{len(sheet_names)}\" baseType=\"lpstr\">{titles}</vt:vector></TitlesOfParts>"
        f"<HeadingPairs><vt:vector size=\"2\" baseType=\"variant\">"
        "<vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>"
        f"<vt:variant><vt:i4>{len(sheet_names)}</vt:i4></vt:variant>"
        "</vt:vector></HeadingPairs>"
        "</Properties>"
    )


def core_xml() -> str:
    created = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        "<dc:title>Investment Advisor Import Template</dc:title>"
        "<dc:creator>OpenAI Codex</dc:creator>"
        "<cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>"
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>'
        "</cp:coreProperties>"
    )


def styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        "</styleSheet>"
    )


def workbook_sheets(populated: bool) -> list[tuple[str, list[list[str]]]]:
    instruction_rows = build_instructions_rows()
    sheets: list[tuple[str, list[list[str]]]] = [("Instructions", instruction_rows)]
    for sheet in DATA_SHEETS:
        rows = [list(map(str, sheet["columns"]))]
        if populated:
            rows.extend(SAMPLE_ROWS.get(str(sheet["name"]), []))
        sheets.append((str(sheet["name"]), rows))
    return sheets


def write_workbook(output_path: Path, populated: bool) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    sheets = workbook_sheets(populated)

    sheet_names = [name for name, _rows in sheets]

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as workbook:
        workbook.writestr("[Content_Types].xml", content_types_xml(len(sheets)))
        workbook.writestr("_rels/.rels", root_rels_xml())
        workbook.writestr("docProps/app.xml", app_xml(sheet_names))
        workbook.writestr("docProps/core.xml", core_xml())
        workbook.writestr("xl/workbook.xml", workbook_xml(sheet_names))
        workbook.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml(len(sheets)))
        workbook.writestr("xl/styles.xml", styles_xml())

        for index, (_name, rows) in enumerate(sheets, start=1):
            workbook.writestr(f"xl/worksheets/sheet{index}.xml", worksheet_xml(rows))


if __name__ == "__main__":
    write_workbook(OUTPUT_PATH, populated=False)
    write_workbook(SAMPLE_OUTPUT_PATH, populated=True)
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Wrote {SAMPLE_OUTPUT_PATH}")
