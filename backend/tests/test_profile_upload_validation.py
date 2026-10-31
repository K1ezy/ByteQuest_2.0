"""Fast, dependency-free checks for avatar content validation."""

from app.api.profiles import _detect_avatar_content_type


def test_detect_avatar_content_type_recognizes_supported_signatures():
    assert _detect_avatar_content_type(b"\x89PNG\r\n\x1a\nrest") == "image/png"
    assert _detect_avatar_content_type(b"\xff\xd8\xff\xe0rest") == "image/jpeg"
    assert _detect_avatar_content_type(b"RIFF\x10\x00\x00\x00WEBPrest") == "image/webp"


def test_detect_avatar_content_type_rejects_metadata_only_and_truncated_files():
    assert _detect_avatar_content_type(b"not really an image") is None
    assert _detect_avatar_content_type(b"RIFFshort") is None
    assert _detect_avatar_content_type(b"") is None
