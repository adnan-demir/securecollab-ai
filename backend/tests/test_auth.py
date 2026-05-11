"""
Unit tests for authentication utilities (auth.py).
These are pure-function tests with no HTTP layer involved.
"""
import time
from datetime import timedelta
import pytest

from auth import (
    get_password_hash, verify_password,
    create_access_token, decode_token,
    generate_otp, calculate_risk_score,
)


# ─── Password hashing ─────────────────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        hashed = get_password_hash("mypassword")
        assert hashed != "mypassword"

    def test_hash_has_bcrypt_prefix(self):
        hashed = get_password_hash("mypassword")
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    def test_correct_password_verifies(self):
        hashed = get_password_hash("correct-horse-battery-staple")
        assert verify_password("correct-horse-battery-staple", hashed) is True

    def test_wrong_password_rejected(self):
        hashed = get_password_hash("correct")
        assert verify_password("wrong", hashed) is False

    def test_empty_string_rejected(self):
        hashed = get_password_hash("notempty")
        assert verify_password("", hashed) is False

    def test_bcrypt_produces_unique_salts(self):
        h1 = get_password_hash("same")
        h2 = get_password_hash("same")
        # bcrypt adds random salt so hashes differ even for equal passwords
        assert h1 != h2

    def test_different_passwords_differ(self):
        assert get_password_hash("aaa") != get_password_hash("bbb")


# ─── JWT ──────────────────────────────────────────────────────────────────────

class TestJWT:
    def test_create_and_decode(self):
        token = create_access_token({"sub": "42", "role": "student"})
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "42"
        assert payload["role"] == "student"

    def test_payload_contains_expiry(self):
        token = create_access_token({"sub": "1"})
        payload = decode_token(token)
        assert "exp" in payload

    def test_invalid_token_returns_none(self):
        assert decode_token("not.a.valid.token") is None

    def test_empty_string_returns_none(self):
        assert decode_token("") is None

    def test_tampered_signature_rejected(self):
        token = create_access_token({"sub": "1"})
        # Corrupt last 5 chars of signature
        tampered = token[:-5] + "AAAAA"
        assert decode_token(tampered) is None

    def test_expired_token_rejected(self):
        # Create a token that expired 1 second ago
        token = create_access_token({"sub": "1"}, expires_delta=timedelta(seconds=-1))
        assert decode_token(token) is None

    def test_custom_claims_preserved(self):
        token = create_access_token({"sub": "7", "role": "admin", "extra": "data"})
        payload = decode_token(token)
        assert payload["extra"] == "data"


# ─── OTP ──────────────────────────────────────────────────────────────────────

class TestOTP:
    def test_default_length_is_6(self):
        assert len(generate_otp()) == 6

    def test_all_digits(self):
        otp = generate_otp()
        assert otp.isdigit()

    def test_custom_length(self):
        assert len(generate_otp(length=8)) == 8

    def test_uniqueness(self):
        # With 10^6 possibilities, 200 samples should not all be the same
        samples = {generate_otp() for _ in range(200)}
        assert len(samples) > 1


# ─── Risk score ───────────────────────────────────────────────────────────────

class TestRiskScore:
    def test_zero_risk(self):
        assert calculate_risk_score(0, 0, 0) == 0.0

    def test_failed_login_weight(self):
        # 1 failed login = 15 pts
        assert calculate_risk_score(1, 0, 0) == 15.0

    def test_unauthorized_weight(self):
        # 1 unauthorized = 20 pts
        assert calculate_risk_score(0, 1, 0) == 20.0

    def test_unusual_weight(self):
        # 1 unusual = 10 pts
        assert calculate_risk_score(0, 0, 1) == 10.0

    def test_combined(self):
        # 1+1+1 = 15+20+10 = 45
        assert calculate_risk_score(1, 1, 1) == 45.0

    def test_capped_at_100(self):
        assert calculate_risk_score(100, 100, 100) == 100.0

    def test_high_risk_threshold(self):
        # 3 unauthorized attempts = 60 → HIGH
        score = calculate_risk_score(0, 3, 0)
        assert score == 60.0

    def test_returns_float(self):
        assert isinstance(calculate_risk_score(2, 1, 0), float)
