import assert from "node:assert/strict";
import test from "node:test";
import { Octokit } from "octokit";
import { createPrSnapshot, isPrQuietPeriodActive } from "./pr-snapshot.js";

test("pins the actual base parent of a synthetic merge", () => {
    assert.deepEqual(
        createPrSnapshot("head", "merge", ["synthetic-base", "head"]),
        {
            headSha: "head",
            baseSha: "synthetic-base",
            mergeSha: "merge",
        },
    );
});

test("rejects a synthetic merge for a different head", () => {
    assert.equal(createPrSnapshot("head", "merge", ["base", "old-head"]), undefined);
});

test("rejects a commit that is not a two-parent merge", () => {
    assert.equal(createPrSnapshot("head", "merge", ["head"]), undefined);
});

const head = {
    repo: { owner: { login: "contributor" }, name: "TypeScript" },
    ref: "feature/branch",
};

function createActivityApi(activities?: { timestamp: string; activity_type: string; }[]) {
    return new Octokit({
        request: {
            fetch: async (input: string | URL | Request) => {
                assert(activities, "Exempt PRs should not request branch activity");
                const url = new URL(input instanceof Request ? input.url : input);
                assert.equal(url.pathname, "/repos/contributor/TypeScript/activity");
                assert.equal(url.searchParams.get("ref"), "refs/heads/feature/branch");
                assert.equal(url.searchParams.get("direction"), "desc");
                assert.equal(url.searchParams.get("time_period"), "day");
                assert.equal(url.searchParams.get("per_page"), "1");
                return new Response(JSON.stringify(activities), {
                    headers: { "content-type": "application/json" },
                });
            },
        },
    }).rest;
}

test("exempts team-authored PRs from the quiet period", async () => {
    assert.equal(
        await isPrQuietPeriodActive(
            createActivityApi(),
            "2026-09-21T18:06:55Z",
            head,
            true,
            2 * 60 * 1000,
        ),
        false,
    );
});

test("exempts same-repository PRs regardless of author", async () => {
    assert.equal(
        await isPrQuietPeriodActive(
            createActivityApi(),
            "2026-09-21T18:06:55Z",
            head,
            false,
            2 * 60 * 1000,
            true,
        ),
        false,
    );
});

for (const activity_type of ["push", "force_push", "branch_creation", "pr_merge", "merge_queue_merge"]) {
    test(`retains the quiet period for a recent ${activity_type} to a non-team fork PR`, async () => {
        assert.equal(
            await isPrQuietPeriodActive(
                createActivityApi([{ timestamp: "2026-09-21T18:06:00Z", activity_type }]),
                "2026-09-21T18:06:55Z",
                head,
                false,
                2 * 60 * 1000,
            ),
            true,
        );
    });
}

test("allows non-team fork PRs after the quiet period", async () => {
    assert.equal(
        await isPrQuietPeriodActive(
            createActivityApi([{ timestamp: "2026-09-21T18:06:00Z", activity_type: "push" }]),
            "2026-09-21T18:08:00Z",
            head,
            false,
            2 * 60 * 1000,
            false,
        ),
        false,
    );
});

test("ignores regenerated synthetic merges when the head branch has no recent activity", async () => {
    assert.equal(
        await isPrQuietPeriodActive(
            createActivityApi([]),
            "2026-10-28T21:25:09Z",
            head,
            false,
            2 * 60 * 1000,
        ),
        false,
    );
});

test("rejects head pushes after the command was posted", async () => {
    assert.equal(
        await isPrQuietPeriodActive(
            createActivityApi([{ timestamp: "2026-09-21T18:07:00Z", activity_type: "force_push" }]),
            "2026-09-21T18:06:55Z",
            head,
            false,
            2 * 60 * 1000,
        ),
        true,
    );
});

test("surfaces activity API failures instead of bypassing the quiet period", async () => {
    const api = new Octokit({
        request: {
            fetch: async () => new Response(JSON.stringify({ message: "Not Found" }), {
                status: 404,
                headers: { "content-type": "application/json" },
            }),
        },
    }).rest;
    await assert.rejects(
        isPrQuietPeriodActive(api, "2026-09-21T18:06:55Z", head, false, 2 * 60 * 1000),
        { status: 404 },
    );
});
