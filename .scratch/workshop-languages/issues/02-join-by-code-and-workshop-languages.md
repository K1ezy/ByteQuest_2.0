# 02: Join with a code alone, and Workshop languages on the profile

**What to build:** Joining any Workshop needs only its join code, whatever its Workshop language: no language question, no 'different track' refusal, and no onboarding language step. New student accounts start with no language. Everywhere the app showed a student's track (API responses, account menu, profile header, workspace shell, instructor student pages) it shows the student's Workshop languages instead, for example 'Python · Java'. A student in no Workshop sees 'Join a Workshop to see its activities' instead of 'Choose your programming language'.

**Blocked by:** None (can start immediately)

**Status:** done
GitHub: #8

- [x] A student already in a Python Workshop joins a Java Workshop with only its code (API test)
- [x] The onboarding endpoint and screen no longer ask for or store a language
- [x] Provisioned students have no default language
- [x] Profile and instructor API responses expose workshop_languages; the frontend shows it
- [x] A student with no Workshop sees the join prompt on the Quest Map (component test)
