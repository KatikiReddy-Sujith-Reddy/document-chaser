# Document Chaser: Jobs to be Done

## 1. Problem

Northgate spends 17 of its 62-day onboarding cycle chasing clients for missing documents. Gaps are discovered one at a time, so clients receive three rounds of requests, each taking 5 to 6 days. Relationship managers (RMs) rewrite each request by hand. Nobody is prompted when a client goes quiet.

## 2. Personas

RM (Relationship Manager): owns the client relationship. Reviews, edits, approves, and sends every request. Handles escalations.

Onboarding Analyst: runs case checks. Needs to know which requirement drives each gap.

Client: receives requests and supplies documents. Wants one list, with reasons and one deadline.

Team Lead: monitors stalled cases and cycle time across the team.

## 3. Primary job

When a case is missing documents, I want every gap found and requested in one message, so the client supplies everything once and the case moves forward.

Trigger: a case is opened, or a document is submitted and the checklist is re-evaluated.
Outcome: one consolidated request, approved by an RM, that covers 100 percent of open gaps.

## 4. Job map

Each job below lists its trigger, the desired outcome, and the measure that proves it.

Job 1, Complete gap view (Analyst). Trigger: case review. Outcome: every missing and non-compliant item is listed at once, with its requirement. Measure: partial-request rate, target zero in the pilot.

Job 2, Fast, accurate draft (RM). Trigger: gap list ready. Outcome: a draft exists within seconds and matches the gap list exactly. Measure: draft generation time, and share of drafts that pass the deterministic checks in section 7.

Job 3, Controlled send (RM). Trigger: draft reviewed. Outcome: the RM edits and approves; the RM sends from their own mail client. Measure: zero auto-sends, and share of drafts approved with no edits.

Job 4, Timely follow-up (RM). Trigger: no client reply after the approval date. Outcome: a reminder task on day 3 and a call task on day 5, with no client contact by the system. Measure: share of follow-up tasks actioned within one working day.

Job 5, Visible cycle time (Team Lead). Trigger: weekly review. Outcome: median days from request to receipt, and rounds per case, before and after the change. Measure: the metrics view itself.

Job 6, Clear request (Client). Trigger: receiving the request. Outcome: each item appears once, with its reason and one deadline, in one message. Measure: client follow-up questions per request (tracked qualitatively in pilot).

## 5. Forces

Push: repeated rework of the same request across three rounds; long gaps before a case advances.
Pull: one consolidated request; a draft ready in seconds; automatic prompts to the RM.
Anxiety: an automated send to the wrong client, or an automated judgment about a document. The design keeps a human approval step and excludes authenticity judgments.
Habit: RMs already send email. The send stays in their own mail client.

## 6. Success measures

Primary: median days from requested to received, across requirements. Baseline is 17 days across 3 rounds of 5 to 6 days. Pilot target is set after the first measured cohort, and is not assumed here.

Secondary: chasing rounds per case (baseline 3); drafts approved without edits; follow-up tasks actioned within one working day.

Definitions: "requested" is the date the approved request was sent, recorded as a requested event. "received" is the date the document is recorded as received. Cycle time is received minus requested, in whole calendar days.

## 7. Acceptance criteria

Job 1: For any seeded case, the gap list returns every missing or non-compliant item in a single response, each with a reason and a requirement reference.

Job 2: The draft endpoint returns within 8 seconds, or returns the template draft. The draft lists every gap item exactly once, contains exactly one deadline, and mentions no item absent from the gap list.

Job 3: The approve endpoint performs no network call to any client, email, or model service. It records approval and returns a mailto link. A test proves this.

Job 4: For a case approved on day 0 with no client reply: a reminder task is due on day 3, a call task on day 5, and the case is parked on day 7. A client reply before a rule fires cancels the subsequent tasks.

Job 5: The metrics endpoint returns the baseline (17 days, 3 rounds) and the pilot median computed from seeded received requirements, using the same formula for both.

Job 6: The draft shows each item once, with its reason, and a single response date.

## 8. Out of scope

Automatic sending of any message. Judging whether a document is genuine, forged, or fraudulent. Credit, risk, or onboarding decisions. Real client data or real identifiers. Authentication and multi-user access. Integration with a mail server. Any feature not listed in sections 3 to 7.

## 9. Open questions

Pilot median target. Whether a future phase replaces the mailto handoff with an integrated send channel. Whether the Stitch screens will be provided as HTML, React, or exported components, since that determines how much of the frontend is reused.
