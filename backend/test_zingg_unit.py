from app.ingestion.synonyms import extract_canonical_fields, clean_name
from app.services.zingg_er import is_name_alias_match, run_entity_resolution

def test_synonym_extraction():
    row = {
        "cust_name": "  Dr. Vikram Malhotra  ",
        "mobile_no": "9871100223",
        "pan_card": "ABCDE1234F",
        "aliases": "V. Malhotra, Vikram M., @vikram_m",
        "acc_no": "98765432101",
        "residential_address": "Sector 34-A, Chandigarh"
    }
    canon = extract_canonical_fields(row)
    assert canon["name"] == "Vikram Malhotra", f"Name was: {canon['name']}"
    assert canon["national_id"] == "ABCDE1234F", f"National ID was: {canon['national_id']}"
    assert canon["account"] == "98765432101", f"Account was: {canon['account']}"
    assert "V. Malhotra" in canon["aliases"]
    assert "Vikram M." in canon["aliases"]
    print("[PASS] test_synonym_extraction passed.")

def test_alias_matching():
    assert is_name_alias_match("Vikram Malhotra", "V. Malhotra")
    assert is_name_alias_match("Vikram Malhotra", "Vikram M.")
    assert is_name_alias_match("Arjun Malhotra", "Malhotra Arjun")
    assert is_name_alias_match("Meera Kapoor", "Meera Kappor")
    assert not is_name_alias_match("Vikram Malhotra", "Sameer Khan")
    print("[PASS] test_alias_matching passed.")

def test_black_circuit_resolution():
    res = run_entity_resolution("INV-2026-BLACK-CIRCUIT")
    assert res["status"] == "success"
    assert res["golden_profiles"] == 10, f"Expected 10 profiles, got {res['golden_profiles']}"
    assert res["zingg_docker_used"] is True
    print("[PASS] test_black_circuit_resolution passed.")

if __name__ == "__main__":
    test_synonym_extraction()
    test_alias_matching()
    test_black_circuit_resolution()
    print("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<")
