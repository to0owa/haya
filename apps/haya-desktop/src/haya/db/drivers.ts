// Database drivers the app can use. Only drivers that are installed appear in the connection form.
// A driver that is not here yet is not shown at all. Upload support will add entries here once it exists.

export interface Driver {
  id: string;
  name: string;
  /** Two-letter mark shown in dropdowns, until real logos exist. */
  badge: string;
  defaultPort: number;
}

export const DRIVERS: Driver[] = [
  { id: "postgres", name: "PostgreSQL", badge: "PG", defaultPort: 5432 },
  { id: "cratedb", name: "CrateDB", badge: "CR", defaultPort: 5433 },
];
