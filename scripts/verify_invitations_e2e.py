import urllib.request
import json
import uuid

def req(url, method='GET', data=None, headers=None):
    h = headers or {}
    body = json.dumps(data).encode('utf-8') if data else None
    if data:
        h['Content-Type'] = 'application/json'
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    with urllib.request.urlopen(r) as resp:
        cookie_header = resp.headers.get('Set-Cookie', '')
        return json.loads(resp.read().decode('utf-8')), cookie_header

def main():
    # 1. Login alice
    login_res, cookie = req('http://127.0.0.1:8000/api/v2/auth/login', 'POST', {'username': 'alice', 'password': 'VgarssSecure2026!'})
    token = login_res['token']
    print(f"[OK] Alice logged in: {login_res['user']['username']}")
    print(f"[OK] Set-Cookie received: {'vgarss_session' in cookie}")

    # 2. Get workspaces
    ws_res, _ = req('http://127.0.0.1:8000/api/v2/workspaces', 'GET', headers={'Authorization': f'Bearer {token}'})
    ws_id = ws_res[0]['id']
    print(f"[OK] Workspace retrieved: '{ws_res[0]['name']}' (ID: {ws_id})")

    # 3. Create invitation
    inv_res, _ = req(
        f'http://127.0.0.1:8000/api/v2/workspaces/{ws_id}/invitations',
        'POST',
        {'role': 'MEMBER', 'expires_in_hours': 24, 'max_uses': 5},
        headers={'Authorization': f'Bearer {token}'}
    )
    code = inv_res['code']
    print(f"[OK] Generated invitation code: {code} (Role: {inv_res['role']}, Uses: {inv_res['uses_count']}/{inv_res['max_uses']})")

    # 4. Public preview without authentication
    preview_res, _ = req(f'http://127.0.0.1:8000/api/v2/invitations/{code}', 'GET')
    print(f"[OK] Public preview: Workspace '{preview_res['workspace_name']}', Valid: {preview_res['is_valid']}, Members: {preview_res['member_count']}")

    # 5. Register new member
    new_user = f"guest_{uuid.uuid4().hex[:6]}"
    reg_res, reg_cookie = req(
        'http://127.0.0.1:8000/api/v2/auth/register',
        'POST',
        {'username': new_user, 'email': f'{new_user}@vgarss.dev', 'password': 'password123'}
    )
    new_token = reg_res['token']
    print(f"[OK] Registered new user: {new_user}")

    # 6. Join workspace via invitation code
    join_res, _ = req(
        f'http://127.0.0.1:8000/api/v2/invitations/{code}/join',
        'POST',
        headers={'Authorization': f'Bearer {new_token}'}
    )
    print(f"[OK] Join successful: {join_res['status']} -> Workspace '{join_res['workspace_name']}', Role: {join_res['role']}")

    # 7. Check membership
    new_ws_res, _ = req('http://127.0.0.1:8000/api/v2/workspaces', 'GET', headers={'Authorization': f'Bearer {new_token}'})
    assert any(w['id'] == ws_id for w in new_ws_res), "New user should see joined workspace"
    print(f"[OK] Verified new user sees workspace '{join_res['workspace_name']}' in workspace list.")

    # 8. List invitations as admin
    inv_list, _ = req(f'http://127.0.0.1:8000/api/v2/workspaces/{ws_id}/invitations', 'GET', headers={'Authorization': f'Bearer {token}'})
    current_inv = next(i for i in inv_list if i['code'] == code)
    print(f"[OK] Invitation usage updated: uses_count={current_inv['uses_count']}, max_uses={current_inv['max_uses']}")
    assert current_inv['uses_count'] == 1

    print("\n--- ALL MULTI-USER & INVITATION SYSTEM CHECKS PASSED SUCCESSFULLY ---")

if __name__ == '__main__':
    main()
