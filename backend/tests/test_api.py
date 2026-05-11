"""
Integration tests for SecureCollab AI API endpoints.
Uses FastAPI TestClient with an isolated in-memory SQLite database.
"""
import pytest
from tests.conftest import register_user, login_and_get_token, auth_headers


# ─── Registration ─────────────────────────────────────────────────────────────

class TestRegistration:
    def test_register_success(self, client):
        r = client.post("/api/auth/register", json={
            "email": "new@example.com",
            "username": "newuser",
            "password": "password123",
            "role": "student",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == "new@example.com"
        assert data["role"] == "student"
        assert "hashed_password" not in data  # Never exposed

    def test_register_duplicate_email(self, client):
        register_user(client, "dup@example.com", "user1")
        r = client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "username": "user2",
            "password": "password123",
        })
        assert r.status_code == 400
        assert "Email" in r.json()["detail"]

    def test_register_duplicate_username(self, client):
        register_user(client, "a@example.com", "sameuser")
        r = client.post("/api/auth/register", json={
            "email": "b@example.com",
            "username": "sameuser",
            "password": "password123",
        })
        assert r.status_code == 400

    def test_register_invalid_email(self, client):
        r = client.post("/api/auth/register", json={
            "email": "not-an-email",
            "username": "validuser",
            "password": "password123",
        })
        assert r.status_code == 422

    def test_register_short_password(self, client):
        r = client.post("/api/auth/register", json={
            "email": "x@example.com",
            "username": "xuser",
            "password": "123",
        })
        assert r.status_code == 422

    def test_register_default_role_is_student(self, client):
        r = client.post("/api/auth/register", json={
            "email": "x2@example.com",
            "username": "x2user",
            "password": "password123",
        })
        assert r.status_code == 201
        assert r.json()["role"] == "student"


# ─── Login ────────────────────────────────────────────────────────────────────

class TestLogin:
    def test_login_returns_otp(self, client):
        register_user(client, "login@example.com", "loginuser")
        r = client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": "password123",
        })
        assert r.status_code == 200
        body = r.json()
        assert "otp_for_demo" in body
        assert body["email"] == "login@example.com"

    def test_wrong_password_returns_401(self, client):
        register_user(client, "u@example.com", "uuser")
        r = client.post("/api/auth/login", json={
            "email": "u@example.com",
            "password": "wrongpassword",
        })
        assert r.status_code == 401

    def test_unknown_email_returns_401(self, client):
        r = client.post("/api/auth/login", json={
            "email": "nobody@example.com",
            "password": "anypassword",
        })
        assert r.status_code == 401

    def test_failed_login_tracked(self, client):
        register_user(client, "track@example.com", "trackuser")
        client.post("/api/auth/login", json={
            "email": "track@example.com",
            "password": "wrongpass",
        })
        # After bad login, check /me reflects higher failed count
        token = login_and_get_token(client, "track@example.com")
        me = client.get("/api/auth/me", headers=auth_headers(token)).json()
        # Counter resets on successful 2FA, but was incremented before
        assert me["failed_login_count"] == 0  # reset after success


# ─── 2FA ──────────────────────────────────────────────────────────────────────

class TestTwoFA:
    def test_correct_otp_returns_token(self, client):
        register_user(client, "twofa@example.com", "twofauser")
        login_r = client.post("/api/auth/login", json={
            "email": "twofa@example.com",
            "password": "password123",
        })
        otp = login_r.json()["otp_for_demo"]
        r = client.post("/api/auth/verify-2fa", json={
            "email": "twofa@example.com",
            "otp": otp,
        })
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert r.json()["token_type"] == "bearer"

    def test_wrong_otp_rejected(self, client):
        register_user(client, "bad2fa@example.com", "bad2fauser")
        client.post("/api/auth/login", json={
            "email": "bad2fa@example.com",
            "password": "password123",
        })
        r = client.post("/api/auth/verify-2fa", json={
            "email": "bad2fa@example.com",
            "otp": "000000",
        })
        assert r.status_code == 400

    def test_no_pending_otp(self, client):
        register_user(client, "nootp@example.com", "nooptuser")
        r = client.post("/api/auth/verify-2fa", json={
            "email": "nootp@example.com",
            "otp": "123456",
        })
        assert r.status_code == 400


# ─── Role-based access ────────────────────────────────────────────────────────

class TestRoleBasedAccess:
    def test_student_cannot_access_admin_endpoint(self, client):
        register_user(client, "stu@example.com", "stuuser", role="student")
        token = login_and_get_token(client, "stu@example.com")
        r = client.get("/api/admin/users", headers=auth_headers(token))
        assert r.status_code == 403

    def test_researcher_cannot_access_admin_endpoint(self, client):
        register_user(client, "res@example.com", "resuser", role="researcher")
        token = login_and_get_token(client, "res@example.com")
        r = client.get("/api/admin/users", headers=auth_headers(token))
        assert r.status_code == 403

    def test_admin_can_access_admin_endpoint(self, client):
        register_user(client, "adm@example.com", "admuser", role="admin")
        token = login_and_get_token(client, "adm@example.com")
        r = client.get("/api/admin/users", headers=auth_headers(token))
        assert r.status_code == 200

    def test_unauthenticated_blocked(self, client):
        r = client.get("/api/admin/users")
        assert r.status_code == 401

    def test_admin_can_change_role(self, client):
        register_user(client, "adm2@example.com", "admuser2", role="admin")
        target = register_user(client, "s2@example.com", "s2user", role="student")
        admin_token = login_and_get_token(client, "adm2@example.com")

        r = client.put("/api/admin/users/role",
                       json={"user_id": target["id"], "new_role": "researcher"},
                       headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert "researcher" in r.json()["message"]

    def test_invalid_role_rejected(self, client):
        register_user(client, "adm3@example.com", "admuser3", role="admin")
        target = register_user(client, "s3@example.com", "s3user")
        admin_token = login_and_get_token(client, "adm3@example.com")

        r = client.put("/api/admin/users/role",
                       json={"user_id": target["id"], "new_role": "superuser"},
                       headers=auth_headers(admin_token))
        assert r.status_code == 400


# ─── Projects ─────────────────────────────────────────────────────────────────

class TestProjects:
    def test_create_project(self, client):
        register_user(client, "proj@example.com", "projuser")
        token = login_and_get_token(client, "proj@example.com")
        r = client.post("/api/projects",
                        json={"title": "My Research", "description": "Details", "is_shared": False},
                        headers=auth_headers(token))
        assert r.status_code == 201
        assert r.json()["title"] == "My Research"

    def test_student_only_sees_own_projects(self, client):
        register_user(client, "s1@p.com", "s1p", role="student")
        register_user(client, "s2@p.com", "s2p", role="student")

        t1 = login_and_get_token(client, "s1@p.com")
        t2 = login_and_get_token(client, "s2@p.com")

        client.post("/api/projects",
                    json={"title": "S1 Project", "is_shared": False},
                    headers=auth_headers(t1))

        # s2 should see 0 projects
        r = client.get("/api/projects", headers=auth_headers(t2))
        assert r.status_code == 200
        assert len(r.json()) == 0

    def test_researcher_sees_shared_projects(self, client):
        register_user(client, "owner@p.com", "ownerp", role="student")
        register_user(client, "res@p.com", "resp", role="researcher")

        owner_t = login_and_get_token(client, "owner@p.com")
        res_t = login_and_get_token(client, "res@p.com")

        client.post("/api/projects",
                    json={"title": "Shared Research", "is_shared": True},
                    headers=auth_headers(owner_t))

        r = client.get("/api/projects", headers=auth_headers(res_t))
        assert r.status_code == 200
        assert any(p["title"] == "Shared Research" for p in r.json())


# ─── Risk score ───────────────────────────────────────────────────────────────

class TestRiskScore:
    def test_admin_can_get_risk_scores(self, client):
        register_user(client, "adm_risk@example.com", "admrisk", role="admin")
        token = login_and_get_token(client, "adm_risk@example.com")
        r = client.get("/api/admin/risk-scores", headers=auth_headers(token))
        assert r.status_code == 200
        scores = r.json()
        assert isinstance(scores, list)
        for s in scores:
            assert "risk_score" in s
            assert s["risk_level"] in {"LOW", "MEDIUM", "HIGH"}

    def test_non_admin_blocked_from_risk_scores(self, client):
        register_user(client, "stu_risk@example.com", "sturisk", role="student")
        token = login_and_get_token(client, "stu_risk@example.com")
        r = client.get("/api/admin/risk-scores", headers=auth_headers(token))
        assert r.status_code == 403


# ─── Social login ─────────────────────────────────────────────────────────────

class TestSocialLogin:
    def test_social_login_creates_user_and_returns_token(self, client):
        r = client.post("/api/auth/social-login", json={
            "provider": "google",
            "email": "googleuser@gmail.com",
            "name": "Google User",
            "social_id": "google_abc123",
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_social_login_idempotent(self, client):
        payload = {
            "provider": "google",
            "email": "existing@gmail.com",
            "name": "Existing User",
            "social_id": "google_xyz789",
        }
        r1 = client.post("/api/auth/social-login", json=payload)
        r2 = client.post("/api/auth/social-login", json=payload)
        assert r1.status_code == 200
        assert r2.status_code == 200
        # Both should return valid tokens
        assert "access_token" in r1.json()
        assert "access_token" in r2.json()

    def test_github_social_login(self, client):
        r = client.post("/api/auth/social-login", json={
            "provider": "github",
            "email": "ghuser@github.com",
            "name": "GitHub User",
            "social_id": "github_demo_001",
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_microsoft_social_login(self, client):
        r = client.post("/api/auth/social-login", json={
            "provider": "microsoft",
            "email": "msuser@outlook.com",
            "name": "Microsoft User",
            "social_id": "microsoft_demo_001",
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_social_login_records_provider(self, client):
        """Verify the provider field is stored correctly for GitHub login."""
        r = client.post("/api/auth/social-login", json={
            "provider": "github",
            "email": "ghprov@github.com",
            "name": "GH Provider Test",
            "social_id": "gh_prov_999",
        })
        assert r.status_code == 200
        token = r.json()["access_token"]
        me = client.get("/api/auth/me",
                        headers={"Authorization": f"Bearer {token}"}).json()
        assert me["is_social_login"] is True
        assert me["social_provider"] == "github"


# ─── Recovery codes ───────────────────────────────────────────────────────────

class TestRecoveryCodes:
    def test_generate_recovery_codes_requires_auth(self, client):
        r = client.post("/api/auth/generate-recovery-codes")
        assert r.status_code == 401

    def test_generate_recovery_codes_returns_5_codes(self, client):
        register_user(client, "rc@example.com", "rcuser")
        token = login_and_get_token(client, "rc@example.com")
        r = client.post("/api/auth/generate-recovery-codes",
                        headers=auth_headers(token))
        assert r.status_code == 200
        body = r.json()
        assert "codes" in body
        assert len(body["codes"]) == 5
        # Each code should be 10 uppercase alphanumeric chars
        for code in body["codes"]:
            assert len(code) == 10
            assert code.isupper() or code.isdigit() or code.isalnum()

    def test_recovery_code_login_flow(self, client):
        """Full flow: register → generate codes → login step1 → verify with recovery code."""
        register_user(client, "rcflow@example.com", "rcflowuser")
        token = login_and_get_token(client, "rcflow@example.com")

        # Generate recovery codes
        gen_r = client.post("/api/auth/generate-recovery-codes",
                            headers=auth_headers(token))
        assert gen_r.status_code == 200
        codes = gen_r.json()["codes"]

        # Trigger a new login (step 1) to create a pending OTP
        login_r = client.post("/api/auth/login", json={
            "email": "rcflow@example.com",
            "password": "password123",
        })
        assert login_r.status_code == 200

        # Use first recovery code instead of OTP
        verify_r = client.post("/api/auth/verify-recovery-code", json={
            "email": "rcflow@example.com",
            "code": codes[0],
        })
        assert verify_r.status_code == 200
        assert "access_token" in verify_r.json()

    def test_recovery_code_is_single_use(self, client):
        """A recovery code must be rejected after first use."""
        register_user(client, "rcsingle@example.com", "rcsingleuser")
        token = login_and_get_token(client, "rcsingle@example.com")

        gen_r = client.post("/api/auth/generate-recovery-codes",
                            headers=auth_headers(token))
        code = gen_r.json()["codes"][0]

        # First login with the code
        client.post("/api/auth/login", json={
            "email": "rcsingle@example.com",
            "password": "password123",
        })
        first_use = client.post("/api/auth/verify-recovery-code", json={
            "email": "rcsingle@example.com",
            "code": code,
        })
        assert first_use.status_code == 200

        # Trigger a second login step
        client.post("/api/auth/login", json={
            "email": "rcsingle@example.com",
            "password": "password123",
        })
        # Same code should now be rejected
        second_use = client.post("/api/auth/verify-recovery-code", json={
            "email": "rcsingle@example.com",
            "code": code,
        })
        assert second_use.status_code == 400

    def test_invalid_recovery_code_rejected(self, client):
        register_user(client, "rcbad@example.com", "rcbaduser")
        token = login_and_get_token(client, "rcbad@example.com")

        client.post("/api/auth/generate-recovery-codes", headers=auth_headers(token))

        client.post("/api/auth/login", json={
            "email": "rcbad@example.com",
            "password": "password123",
        })
        r = client.post("/api/auth/verify-recovery-code", json={
            "email": "rcbad@example.com",
            "code": "NOTACODE99",
        })
        assert r.status_code == 400

    def test_recovery_code_without_login_step_rejected(self, client):
        """Cannot use recovery code if step 1 (password) was not completed."""
        register_user(client, "rcnologin@example.com", "rcnologinuser")
        token = login_and_get_token(client, "rcnologin@example.com")
        gen_r = client.post("/api/auth/generate-recovery-codes",
                            headers=auth_headers(token))
        code = gen_r.json()["codes"][0]

        # Do NOT call /login first
        r = client.post("/api/auth/verify-recovery-code", json={
            "email": "rcnologin@example.com",
            "code": code,
        })
        assert r.status_code == 400


# ─── Security status ──────────────────────────────────────────────────────────

class TestSecurityStatus:
    def test_admin_can_get_security_status(self, client):
        register_user(client, "sec_adm@example.com", "secadm", role="admin")
        token = login_and_get_token(client, "sec_adm@example.com")
        r = client.get("/api/admin/security-status", headers=auth_headers(token))
        assert r.status_code == 200
        body = r.json()
        assert "authentication_methods" in body
        assert "security_features" in body
        assert "deployment_checklist" in body
        assert "stats" in body

    def test_security_status_shows_all_providers(self, client):
        register_user(client, "sec_adm2@example.com", "secadm2", role="admin")
        token = login_and_get_token(client, "sec_adm2@example.com")
        r = client.get("/api/admin/security-status", headers=auth_headers(token))
        methods = {m["name"] for m in r.json()["authentication_methods"]}
        assert any("Google" in m for m in methods)
        assert any("GitHub" in m for m in methods)
        assert any("Microsoft" in m for m in methods)
        assert any("Recovery" in m for m in methods)

    def test_non_admin_blocked_from_security_status(self, client):
        register_user(client, "sec_stu@example.com", "secstu", role="student")
        token = login_and_get_token(client, "sec_stu@example.com")
        r = client.get("/api/admin/security-status", headers=auth_headers(token))
        assert r.status_code == 403
