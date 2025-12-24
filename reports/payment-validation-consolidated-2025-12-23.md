# Payment Validation Report (Consolidated)
**Generated**: 2025-12-23T11:43:19.180Z

## Executive Summary

This report counts **unique transactions** across both the legacy `Payment` table and the current `Transaction` table. It simulates the final state after all payments are migrated.

### Projected Unique Totals
| Provider | Unique Count | Oldest | Newest |
|----------|-------------:|--------|--------|
| **Stripe** | **693** | 2021-04-11 | 2025-12-18 |
| **Glofox** | **1,319** | 2023-01-04 | 2025-12-22 |
| **Starling** | **423** | 2023-02-07 | 2025-12-18 |
| **Other** | **1** | 2024-01-01 | 2024-01-01 |
| **TOTAL** | **2,436** | | |

## Data Sources

- **Payment Table**: 1,167 records
- **Transaction Table**: 2,214 records
- **Overlapping Records**: 945 (Exist in both, deduplicated)

## Migration Impact
The migration script will move any records from `Payment` that do NOT exist in `Transaction`.
- Total Unique Records: **2,436**
- This includes historical file imports AND live webhook data.
