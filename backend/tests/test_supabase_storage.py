import pytest

from app.services.storage.supabase_storage import StorageError, SupabasePDFStorage


def test_resolves_supabase_relative_signed_path():
    result = SupabasePDFStorage._resolve_signed_url(
        "/object/sign/private-bucket/file.pdf?token=secret",
        "http://127.0.0.1:54321",
    )

    assert result == (
        "http://127.0.0.1:54321/storage/v1/object/sign/private-bucket/file.pdf?token=secret"
    )


def test_accepts_absolute_signed_url_from_configured_origin():
    result = SupabasePDFStorage._resolve_signed_url(
        "http://127.0.0.1:54321/storage/v1/object/sign/file.pdf?token=secret",
        "http://127.0.0.1:54321",
    )

    assert result.endswith("?token=secret")


@pytest.mark.parametrize(
    "signed_url",
    [
        "https://attacker.example/steal-token",
        "//attacker.example/steal-token",
        "http://user:pass@127.0.0.1:54321/storage/v1/signed",
        "http://127.0.0.1:54321/storage/v1/signed#external-fragment",
    ],
)
def test_rejects_untrusted_signed_url(signed_url):
    with pytest.raises(StorageError):
        SupabasePDFStorage._resolve_signed_url(signed_url, "http://127.0.0.1:54321")
