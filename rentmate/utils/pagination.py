"""Consistent pagination envelope for list APIs."""

from flask import request


def paginate(query, default_per_page=20, max_per_page=100):
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(max_per_page, request.args.get("per_page", default_per_page, type=int))
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "page": pagination.page,
        "pages": pagination.pages,
        "per_page": per_page,
        "total": pagination.total,
        "items": pagination.items,
    }
