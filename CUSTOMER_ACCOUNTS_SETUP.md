# Customer account setup

The storefront code restores customer information and historical orders after
Firebase sign-in. Complete these NocoDB and Firebase settings before deploying.

## 1. NocoDB Customers table

Create a table named `Customers` with these exact columns:

- `Firebase UID` — Single line text
- `Email` — Email or Single line text
- `Name` — Single line text
- `Phone` — Phone number or Single line text
- `Phone Normalized` — Single line text
- `Address` — Long text
- `Phone Verified` — Checkbox
- `Auth Provider` — Single line text

Copy the table ID and add it in Easypanel:

```env
VITE_NOCODB_TABLE_CUSTOMERS=your_customers_table_id
```

## 2. Existing Orders table

Add these exact columns without deleting any existing columns:

- `Customer UID` — Single line text
- `Customer Email` — Email or Single line text
- `Customer Phone Normalized` — Single line text

Historical orders remain unchanged. After a customer verifies their phone, the
store matches those orders through the existing `Customer Phone` column.

## 3. Firebase Authentication

- Enable the Phone provider in Authentication > Sign-in method.
- Keep Google and Email/Password enabled as needed.
- Add `errayhany.com`, `www.errayhany.com`, and
  `imdenmanadger.online` to Authentication > Settings > Authorized domains.

Google/email customers verify the phone used for past orders once by SMS.
Returning logins then restore their profile and order history on any device.

