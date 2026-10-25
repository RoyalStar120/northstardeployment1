import re
from dataclasses import dataclass, asdict
from typing import List, Dict, Any


@dataclass
class ValidationIssue:
    type: str
    severity: str
    text: str
    reason: str


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def extract_numbers(text: str) -> List[str]:
    return re.findall(r"\b\d+(?:\.\d+)?\+?%?\b", text)


def extract_years(text: str) -> List[str]:
    return re.findall(r"\b(?:19|20)\d{2}\b", text)


def contains_phrase(text: str, phrase: str) -> bool:
    return normalize(phrase) in normalize(text)


def validate_resume(
    resume: str,
    confirmed: Dict[str, Any],
) -> Dict[str, Any]:

    issues: List[ValidationIssue] = []
    resume_norm = normalize(resume)

    # ---------------------------------------------------------
    # 1. Alternate contact / privacy
    # ---------------------------------------------------------

    alternate_contact = confirmed.get("alternate_contact")

    if alternate_contact and contains_phrase(resume, alternate_contact):
        issues.append(
            ValidationIssue(
                type="privacy",
                severity="critical",
                text=alternate_contact,
                reason="Alternate contacts should not appear on the resume by default.",
            )
        )

    # ---------------------------------------------------------
    # 2. Employers
    # ---------------------------------------------------------

    confirmed_employers = confirmed.get("employers", [])

    possible_employers = confirmed.get("possible_employers", [])

    for employer in possible_employers:
        if contains_phrase(resume, employer) and employer not in confirmed_employers:
            issues.append(
                ValidationIssue(
                    type="unsupported_employer",
                    severity="critical",
                    text=employer,
                    reason="Employer was not confirmed by the user.",
                )
            )

    # ---------------------------------------------------------
    # 3. Job titles
    # ---------------------------------------------------------

    confirmed_titles = confirmed.get("job_titles", [])
    blocked_titles = confirmed.get("unconfirmed_job_titles", [])

    for title in blocked_titles:
        if contains_phrase(resume, title) and title not in confirmed_titles:
            issues.append(
                ValidationIssue(
                    type="unsupported_job_title",
                    severity="critical",
                    text=title,
                    reason="Job title was not confirmed by the user.",
                )
            )

    # ---------------------------------------------------------
    # 4. Dates / years
    # ---------------------------------------------------------

    confirmed_dates = [str(x) for x in confirmed.get("dates", [])]
    found_years = extract_years(resume)

    for year in found_years:
        if year not in confirmed_dates:
            issues.append(
                ValidationIssue(
                    type="unsupported_date",
                    severity="critical",
                    text=year,
                    reason="Date/year appears in resume but was not confirmed.",
                )
            )

    # ---------------------------------------------------------
    # 5. Durations
    # ---------------------------------------------------------

    duration_patterns = [
        r"\b\d+\s+(?:year|years|month|months|week|weeks)\b",
        r"\bover\s+\d+\s+(?:year|years|month|months|week|weeks)\b",
    ]

    confirmed_durations = [
        normalize(x) for x in confirmed.get("durations", [])
    ]

    for pattern in duration_patterns:
        for match in re.findall(pattern, resume, flags=re.I):
            if normalize(match) not in confirmed_durations:
                issues.append(
                    ValidationIssue(
                        type="unsupported_duration",
                        severity="critical",
                        text=match,
                        reason="Duration was not confirmed by the user.",
                    )
                )

    # ---------------------------------------------------------
    # 6. Metrics / quantities
    # ---------------------------------------------------------

    confirmed_numbers = {
        str(x).lower() for x in confirmed.get("confirmed_numbers", [])
    }

    # Remove numbers that belong to already-handled structures so they
    # are not double-counted as generic metrics.
    scrubbed = resume

    # ---------------------------------------------------------
    # Remove confirmed phone numbers, regardless of formatting.
    #
    # Examples that should all be treated as the same number:
    # 4255985206
    # 425-598-5206
    # 425 598 5206
    # (425) 598-5206
    # ---------------------------------------------------------

    raw_contact_numbers = [
        str(x) for x in confirmed.get("contact_numbers", [])
    ]

    confirmed_contact_digits = {
        re.sub(r"\D", "", value)
        for value in raw_contact_numbers
        if re.sub(r"\D", "", value)
    }

    # Backward compatibility for older callers that supplied
    # phone-number pieces such as ["555", "610", "1820"].
    joined_contact_digits = "".join(
        re.sub(r"\D", "", value)
        for value in raw_contact_numbers
    )

    if len(joined_contact_digits) >= 7:
        confirmed_contact_digits.add(joined_contact_digits)

    phone_pattern = re.compile(
        r"(?<!\d)(?:\+?1[\s.\-]*)?"
        r"(?:\(?\d{3}\)?[\s.\-]*)"
        r"\d{3}[\s.\-]*\d{4}(?!\d)"
    )

    def remove_confirmed_phone(match):
        candidate_digits = re.sub(r"\D", "", match.group(0))

        # Strip a leading US country code for comparison.
        candidate_without_country = (
            candidate_digits[1:]
            if len(candidate_digits) == 11 and candidate_digits.startswith("1")
            else candidate_digits
        )

        for confirmed_digits in confirmed_contact_digits:
            confirmed_without_country = (
                confirmed_digits[1:]
                if len(confirmed_digits) == 11 and confirmed_digits.startswith("1")
                else confirmed_digits
            )

            if candidate_without_country == confirmed_without_country:
                return ""

        return match.group(0)

    scrubbed = phone_pattern.sub(remove_confirmed_phone, scrubbed)

    # Also remove an exact unformatted confirmed contact number if present.
    for safe_value in raw_contact_numbers:
        scrubbed = scrubbed.replace(str(safe_value), "")

    # Remove ZIP codes.
    scrubbed = re.sub(r"\b\d{5}\b", "", scrubbed)

    # Remove durations such as "1 year", "6 months", etc.
    scrubbed = re.sub(
        r"\b\d+\s+(?:year|years|month|months|week|weeks)\b",
        "",
        scrubbed,
        flags=re.I,
    )

    # Remove known certification names that contain numbers.
    numeric_certifications = [
        "OSHA 10",
    ]

    for cert in numeric_certifications:
        scrubbed = re.sub(
            re.escape(cert),
            "",
            scrubbed,
            flags=re.I,
        )

    found_numbers = extract_numbers(scrubbed)

    for number in found_numbers:
        if number.lower() not in confirmed_numbers:
            issues.append(
                ValidationIssue(
                    type="unsupported_metric",
                    severity="critical",
                    text=number,
                    reason="Numeric claim was not confirmed by the user.",
                )
            )

    # ---------------------------------------------------------
    # 7. Certifications
    # ---------------------------------------------------------

    known_certifications = [
        "Food Handler Card",
        "Forklift Certified",
        "OSHA 10",
        "First Aid",
        "CPR",
        "ServSafe",
    ]

    confirmed_certs = confirmed.get("certifications", [])

    for cert in known_certifications:
        if contains_phrase(resume, cert):
            if not any(normalize(cert) == normalize(x) for x in confirmed_certs):
                issues.append(
                    ValidationIssue(
                        type="unsupported_certification",
                        severity="critical",
                        text=cert,
                        reason="Certification was not confirmed by the user.",
                    )
                )

    # ---------------------------------------------------------
    # 8. Languages
    # ---------------------------------------------------------

    known_languages = [
        "Spanish",
        "Vietnamese",
        "Mandarin",
        "Chinese",
        "French",
        "Hindi",
        "Arabic",
        "Korean",
        "Russian",
        "Tagalog",
        "Bilingual",
    ]

    confirmed_languages = confirmed.get("languages", [])

    for language in known_languages:
        if contains_phrase(resume, language):
            if not any(
                normalize(language) == normalize(x)
                for x in confirmed_languages
            ):
                issues.append(
                    ValidationIssue(
                        type="unsupported_language",
                        severity="critical",
                        text=language,
                        reason="Language ability was not confirmed.",
                    )
                )

    # ---------------------------------------------------------
    # 9. High-risk inferred skills
    # ---------------------------------------------------------

    skill_boundaries = {
        "Inventory Management": [
            "inventory management",
            "managed inventory",
        ],
        "Forklift Operation": [
            "forklift operator",
            "operated forklift",
            "forklift operation",
        ],
        "Logistics Management": [
            "logistics management",
            "managed logistics",
        ],
    }

    confirmed_skills = [
        normalize(x) for x in confirmed.get("skills", [])
    ]

    for skill_name, phrases in skill_boundaries.items():
        present = any(phrase in resume_norm for phrase in phrases)

        if present and normalize(skill_name) not in confirmed_skills:
            issues.append(
                ValidationIssue(
                    type="unsupported_skill",
                    severity="critical",
                    text=skill_name,
                    reason=f"{skill_name} requires explicit support and cannot be inferred automatically.",
                )
            )

    # ---------------------------------------------------------
    # Result
    # ---------------------------------------------------------

    critical = [i for i in issues if i.severity == "critical"]

    return {
        "valid": len(critical) == 0,
        "critical_issue_count": len(critical),
        "issue_count": len(issues),
        "issues": [asdict(i) for i in issues],
    }


if __name__ == "__main__":
    # Quick built-in test
    confirmed = {
        "alternate_contact": "Harbor Outreach Desk",
        "employers": [],
        "possible_employers": ["Harbor Outreach Desk"],
        "job_titles": [],
        "unconfirmed_job_titles": ["Forklift Operator"],
        "dates": [],
        "durations": [],
        "confirmed_numbers": ["50+"],
        "contact_numbers": ["555", "610", "1820"],
        "certifications": ["Food Handler Card"],
        "languages": [],
        "skills": [
            "Food Preparation",
            "Cleaning",
            "Sanitation",
            "Heavy Lifting 50+ lbs",
            "Reliability & Punctuality",
        ],
    }

    bad_resume = """
    MAYA REED

    Harbor Outreach Desk

    SUMMARY
    Reliable worker with 1 year of warehouse experience.

    CERTIFICATIONS
    Food Handler Card
    OSHA 10

    EXPERIENCE
    Forklift Operator
    Operated forklift and managed inventory.
    """

    result = validate_resume(bad_resume, confirmed)

    import json
    print(json.dumps(result, indent=2))
