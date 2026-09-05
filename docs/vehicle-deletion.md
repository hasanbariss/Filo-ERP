# Reviewed vehicle deletion

Owned and contractor vehicle delete buttons both open `reviewVehicleDeletion` through `deleteRecord('araclar', ...)`.

The authenticated preview lists linked tables, counts, sample rows and paginated details. Each group defaults to keep. Required links must be explicitly deleted or, where nullable and safe, detached before the vehicle can be deleted. Unknown downstream links and custom delete/update triggers block unsupported actions.

Execution checks the exact plate, explicit choices and the preview fingerprint under transaction locks. Changed records require a fresh review. Selected actions, derived GPS deletions, maintenance-plan detachment, vehicle deletion and audit insertion occur in one transaction; any failure rolls back all changes. The audit stores the vehicle and reviewed summary, not a full backup of deleted rows.

Drivers, customers, accounting accounts, invoices/payments, card movements and uploaded files are retained. Independent workspace history, saved snapshots and stock references are retained. Detached legacy records may display an empty plate. Deleting service/fuel/maintenance rows changes reports based on those rows.

The migration defines the workflow and audit table; it does not delete existing data. No production vehicle is deleted by the tests.

Checks:
- `PGLITE_MODULE=<module path> node scripts/test-vehicle-deletion-sql.cjs`: local PostgreSQL fixtures for keep blockers, selected deletion, detachment, stale review, pagination, rollback and permissions.
- `PLAYWRIGHT_MODULE=<module path> node scripts/test-deletion-feedback-ui.cjs`: mocked browser confirmation and responsive notification behavior.
