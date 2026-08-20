"""Central router registration — import all sub-routers into one place."""
from __future__ import annotations

from fastapi import FastAPI

from routes import (
    admin,
    ai,
    auth,
    backup,
    customers,
    expenses,
    exports,
    health,
    inventory,
    locations,
    lottery,
    overview,
    part_prices,
    products,
    production,
    reports,
    shifts,
    sparepart_transfers,
    transactions,
    users,
    warehouse,
)

ALL_ROUTERS = [
    auth.router,
    users.router,
    products.router,
    customers.router,
    transactions.router,
    reports.router,
    part_prices.router,
    expenses.router,
    locations.router,
    overview.router,
    lottery.router,
    admin.router,
    production.router,
    warehouse.router,
    sparepart_transfers.router,
    inventory.router,
    shifts.router,
    ai.router,
    exports.router,
    backup.router,
    health.router,
]


def register_routes(app: FastAPI) -> None:
    for r in ALL_ROUTERS:
        app.include_router(r)
