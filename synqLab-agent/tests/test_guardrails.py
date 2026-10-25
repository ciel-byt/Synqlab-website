"""Tests for the guardrails module."""

from synqlab.agent.guardrails import (
    check_numerical_claims,
    extract_numbers,
    extract_tool_numbers,
    run_guardrails,
)


class TestExtractNumbers:
    def test_integers(self):
        nums = extract_numbers("The pLDDT score is 85 and length is 120")
        assert "85" in nums
        assert "120" in nums

    def test_decimals(self):
        nums = extract_numbers("ΔΔG of -2.35 kcal/mol")
        assert "-2.35" in nums

    def test_scientific_notation(self):
        nums = extract_numbers("Binding energy: 1.5e-4")
        assert "1.5e-4" in nums

    def test_skips_small_integers(self):
        nums = extract_numbers("Found 3 results with score 0")
        assert "3" not in nums
        assert "0" not in nums


class TestNumericalClaims:
    def test_grounded_claims_pass(self):
        messages = [
            {"role": "tool", "content": '{"plddt": 85.2, "ddg": -2.1}'},
        ]
        warnings = check_numerical_claims(
            "The pLDDT score is 85.2 and ΔΔG is -2.1",
            messages,
        )
        assert len(warnings) == 0

    def test_ungrounded_claims_warned(self):
        messages = [
            {"role": "tool", "content": '{"plddt": 85.2}'},
        ]
        warnings = check_numerical_claims(
            "The pLDDT score is 85.2 and ΔΔG is -3.7",
            messages,
        )
        assert len(warnings) == 1
        assert "-3.7" in warnings[0]

    def test_no_tool_outputs(self):
        messages = [{"role": "user", "content": "Hello"}]
        warnings = check_numerical_claims("Score is 85.2", messages)
        assert len(warnings) == 0  # No tool outputs = can't verify = no warning

    def test_empty_response(self):
        warnings = check_numerical_claims("", [])
        assert len(warnings) == 0


class TestRunGuardrails:
    def test_combined_guardrails(self):
        messages = [
            {"role": "tool", "content": '{"plddt": 85.2}'},
        ]
        modified, warnings = run_guardrails("Score is 85.2", messages)
        assert modified == "Score is 85.2"  # No modification
        assert len(warnings) == 0  # 85.2 is grounded

    def test_ungrounded_claim_warning(self):
        messages = [
            {"role": "tool", "content": '{"plddt": 85.2}'},
        ]
        modified, warnings = run_guardrails("Score is 99.9", messages)
        assert len(warnings) == 1
        assert "99.9" in warnings[0]
