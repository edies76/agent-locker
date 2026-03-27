from auth import token_vault as tv


def test_provider_connection_detection():
    assert tv.provider_connection_for_tool("send_email", {"to": "a@b.com"}) == "google-oauth2"
    assert tv.provider_connection_for_tool("github__create_issue", {"repo": "x"}) == "github"
    assert tv.provider_connection_for_tool("slack__post_message", {"channel": "c"}) == "slack"
    assert tv.provider_connection_for_tool("read_file", {"path": "README.md"}) is None


def test_requires_user_auth_for_connected_providers():
    assert tv.requires_user_auth("send_email", {"to": "a@b.com"}) is True
    assert tv.requires_user_auth("github__create_issue", {"repo": "x"}) is True
    assert tv.requires_user_auth("slack__post_message", {"channel": "c"}) is True
    assert tv.requires_user_auth("read_file", {"path": "README.md"}) is False

