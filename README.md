# Hello AI

## Objective

Provide a Cloudflare-native AI prototype surface for hardened JSON-contract responses and route-based API experimentation.

## Current Role

This repository is a prototype and testing lane for Worker-based AI endpoints, not the canonical BranchOps internal control plane.

## Boundary Rules

- Keep internal business logic, private operating records, and sensitive production credentials out of this repository.
- Treat this repo as a public-safe prototype surface.
- Do not let prototype scope drift into the primary system-of-record lane.

## System of Record

- Prototype worker/API experimentation: this repository
- Internal operating platform: `OffDaBranch/branchops-platform`
- Public product narrative: `OffDaBranch/branchops-public`

## Follow-Up

Normalize branch and repository settings in GitHub UI so the long-term stable branch posture is explicit.
