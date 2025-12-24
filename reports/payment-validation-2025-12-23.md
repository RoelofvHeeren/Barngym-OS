# Payment Validation Report
**Generated**: 2025-12-23T09:43:48.929Z

## Summary

| Provider | Count | Oldest Transaction | Newest Transaction |
|----------|-------|-------------------|-------------------|
| **Stripe** | 669 | 2021-04-11 | 2025-06-26 |
| **Glofox** | 431 | 2023-01-06 | 2025-12-01 |
| **Starling** | 386 | 2023-02-07 | 2025-12-18 |

## Totals

- **Payment Table Total** (Stripe + Glofox): **1,100**
- **Transaction Table** (Starling): **386**

## Validation

- **Expected Range**: 1,100 - 1,167 payments
- **Actual Payment Count**: 1,100

✅ **Status**: Payment count is within expected range

## Data Sources

### Stripe
- Source: `Payment` table where `sourceSystem = 'stripe'`
- 669 records found

### Glofox
- Source: `Payment` table where `sourceSystem = 'glofox'`
- 431 records found

### Starling
- Source: `Transaction` table where `provider` or `source` contains 'starling'
- 386 records found
- Providers/Sources: starling, Starling

## Notes

- **Payment Table**: Contains historical payment records from Stripe and Glofox integrations
- **Transaction Table**: Contains transaction records including Starling bank transfers
- The expected range (1100-1167) was based on previous migration estimates

