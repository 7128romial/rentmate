"""Unit tests for the scoring algorithm — stdlib only, no app needed."""

from datetime import date
from types import SimpleNamespace

from matching import (
    calculate_match_score,
    _score_location,
    _score_budget,
    _score_lifestyle,
    _score_dates,
)


def P(**kw):
    defaults = dict(
        city="תל אביב", rent_price=4000, smoking_allowed=False,
        pets_allowed=False, property_type="apartment", roommate_gender=None,
        available_from=None,
    )
    defaults.update(kw)
    return SimpleNamespace(**defaults)


def PR(**kw):
    defaults = dict(
        preferred_city="תל אביב", max_rent=5000, smoking="no", pets=False,
        preferred_gender="any", move_in_date=None,
    )
    defaults.update(kw)
    return SimpleNamespace(**defaults)


def test_location_exact_match():
    assert _score_location(PR(preferred_city="תל אביב"), P(city="תל אביב")) == 30


def test_location_mismatch():
    assert _score_location(PR(preferred_city="חיפה"), P(city="תל אביב")) == 0


def test_location_no_preference_gives_half():
    assert _score_location(PR(preferred_city=None), P()) == 15


def test_budget_well_under():
    assert _score_budget(PR(max_rent=10000), P(rent_price=5000)) == 35


def test_budget_over():
    assert _score_budget(PR(max_rent=1000), P(rent_price=5000)) == 0


def test_total_is_sum_of_parts():
    s = calculate_match_score(PR(), P())
    assert s["total"] == s["location"] + s["budget"] + s["lifestyle"] + s["dates"]
    assert 0 <= s["total"] <= 100


def test_dates_exact_window():
    today = date.today()
    s = _score_dates(PR(move_in_date=today), P(available_from=today))
    assert s == 10
