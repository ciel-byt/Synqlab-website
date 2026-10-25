"""Live database introspection router."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import inspect, text

from synqlab.auth.dependencies import get_current_user
from synqlab.auth.models import User
from synqlab.storage.db import get_engine, get_session

router = APIRouter(prefix="/api/database", tags=["database"])


class TableSummary(BaseModel):
    name: str
    row_count: int


class ColumnSchema(BaseModel):
    name: str
    type: str
    nullable: bool
    primary_key: bool


class TableDetail(BaseModel):
    name: str
    columns: list[ColumnSchema]
    row_count: int


class TableNode(BaseModel):
    name: str
    columns: list[ColumnSchema]


class TableRelationship(BaseModel):
    from_table: str
    from_column: str
    to_table: str
    to_column: str


class SchemaMap(BaseModel):
    tables: list[TableNode]
    relationships: list[TableRelationship]


def _quote_table_name(table_name: str) -> str:
    if not table_name.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid table name.")
    return f'"{table_name}"'


def _row_count(table_name: str) -> int:
    session = get_session()
    try:
        quoted = _quote_table_name(table_name)
        result = session.execute(text(f"SELECT COUNT(*) FROM {quoted}"))
        return int(result.scalar() or 0)
    finally:
        session.close()


@router.get("/tables", response_model=list[TableSummary])
def list_tables(_: User = Depends(get_current_user)) -> list[TableSummary]:
    inspector = inspect(get_engine())
    table_names = sorted(inspector.get_table_names())
    return [TableSummary(name=name, row_count=_row_count(name)) for name in table_names]


@router.get("/tables/{table_name}", response_model=TableDetail)
def get_table_detail(table_name: str, _: User = Depends(get_current_user)) -> TableDetail:
    inspector = inspect(get_engine())
    table_names = set(inspector.get_table_names())
    if table_name not in table_names:
        raise HTTPException(status_code=404, detail="Table not found.")

    pk_columns = set(inspector.get_pk_constraint(table_name).get("constrained_columns") or [])
    columns = [
        ColumnSchema(
            name=col["name"],
            type=str(col["type"]),
            nullable=bool(col.get("nullable", True)),
            primary_key=col["name"] in pk_columns,
        )
        for col in inspector.get_columns(table_name)
    ]
    return TableDetail(name=table_name, columns=columns, row_count=_row_count(table_name))


@router.get("/schema-map", response_model=SchemaMap)
def get_schema_map(_: User = Depends(get_current_user)) -> SchemaMap:
    inspector = inspect(get_engine())
    table_names = sorted(inspector.get_table_names())
    tables: list[TableNode] = []
    relationships: list[TableRelationship] = []

    for table_name in table_names:
        pk_columns = set(inspector.get_pk_constraint(table_name).get("constrained_columns") or [])
        columns = [
            ColumnSchema(
                name=col["name"],
                type=str(col["type"]),
                nullable=bool(col.get("nullable", True)),
                primary_key=col["name"] in pk_columns,
            )
            for col in inspector.get_columns(table_name)
        ]
        tables.append(TableNode(name=table_name, columns=columns))

        for fk in inspector.get_foreign_keys(table_name):
            referred_table = fk.get("referred_table")
            constrained = fk.get("constrained_columns") or []
            referred = fk.get("referred_columns") or []
            if not referred_table:
                continue
            for from_column, to_column in zip(constrained, referred):
                relationships.append(
                    TableRelationship(
                        from_table=table_name,
                        from_column=from_column,
                        to_table=referred_table,
                        to_column=to_column,
                    )
                )

    return SchemaMap(tables=tables, relationships=relationships)


@router.get("/tables/{table_name}/rows")
def get_table_rows(table_name: str, current_user: User = Depends(get_current_user)) -> list[dict[str, Any]]:
    inspector = inspect(get_engine())
    if table_name not in set(inspector.get_table_names()):
        raise HTTPException(status_code=404, detail="Table not found.")

    quoted = _quote_table_name(table_name)
    session = get_session()
    try:
        result = session.execute(text(f"SELECT * FROM {quoted} LIMIT 100"))
        rows: list[dict[str, Any]] = []
        for row in result.mappings():
            record = dict(row)
            if "password_hash" in record and record["password_hash"] is not None:
                record["password_hash"] = "••••••••"
            rows.append(record)
        return rows
    finally:
        session.close()
