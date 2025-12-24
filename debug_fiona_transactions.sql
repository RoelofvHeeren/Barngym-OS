-- Query to check Fiona McIntosh's transactions
-- Email: fionamcintosh1169@gmail.com

SELECT 
  t.id,
  t.occurredAt,
  t.amountMinor,
  t.status,
  t.productType,
  t.source,
  t.provider,
  c.fullName as contactName,
  l.fullName as leadName
FROM "Transaction" t
LEFT JOIN "Contact" c ON t.contactId = c.id
LEFT JOIN "Lead" l ON t.leadId = l.id
WHERE 
  c.email = 'fionamcintosh1169@gmail.com' 
  OR l.email = 'fionamcintosh1169@gmail.com'
ORDER BY t.occurredAt DESC;

-- Also check Lead and Contact LTV fields
SELECT 
  'Lead' as type,
  id,
  fullName,
  email,
  ltvAllCents,
  ltvAdsCents
FROM "Lead"
WHERE email = 'fionamcintosh1169@gmail.com'
UNION ALL
SELECT 
  'Contact' as type,
  id,
  fullName,
  email,
  ltvAllCents,
  ltvAdsCents
FROM "Contact"
WHERE email = 'fionamcintosh1169@gmail.com';
