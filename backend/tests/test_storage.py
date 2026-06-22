"""Storage backends: local disk round-trip + factory selection."""

import os

from app.services.storage import LocalStorage, get_storage_backend


def test_local_storage_save_delete_roundtrip(tmp_path):
    store = LocalStorage(str(tmp_path / "deaths"))
    ref = store.save("3/abc_photo.png", b"hello", "image/png")
    assert os.path.exists(ref)
    with open(ref, "rb") as f:
        assert f.read() == b"hello"
    # public_url is browser-loadable (leading slash for the /uploads mount)
    assert store.public_url(ref).startswith("/")
    store.delete(ref)
    assert not os.path.exists(ref)
    # delete is idempotent / safe on a missing file
    store.delete(ref)


def test_factory_defaults_to_local():
    get_storage_backend.cache_clear()
    backend = get_storage_backend()
    assert isinstance(backend, LocalStorage)
