import assert from "node:assert/strict";
import type { Octokit } from "octokit";

export interface PrSnapshot {
    headSha: string;
    baseSha: string;
    mergeSha: string;
}

export function createPrSnapshot(
    headSha: string,
    mergeSha: string,
    mergeParentShas: readonly string[],
): PrSnapshot | undefined {
    if (mergeParentShas.length !== 2 || mergeParentShas[1] !== headSha) {
        return undefined;
    }

    return {
        headSha,
        baseSha: mergeParentShas[0],
        mergeSha,
    };
}

export async function isPrQuietPeriodActive(
    api: Octokit["rest"],
    commentCreatedAt: string,
    head: {
        repo: { owner: { login: string; }; name: string; } | null;
        ref: string;
    },
    prAuthorIsTeamMember: boolean,
    quietPeriodMs: number,
    prIsFromSameRepository = false,
): Promise<boolean> {
    if (prIsFromSameRepository || prAuthorIsTeamMember) {
        return false;
    }

    assert(head.repo, "Cannot check head pushes because the PR's head repository is unavailable");
    const { data: activities } = await api.repos.listActivities({
        owner: head.repo.owner.login,
        repo: head.repo.name,
        ref: `refs/heads/${head.ref}`,
        direction: "desc",
        time_period: "day",
        per_page: 1,
    });
    const latestActivity = activities[0];
    if (!latestActivity) {
        return false;
    }

    const quietForMs = new Date(commentCreatedAt).getTime() - new Date(latestActivity.timestamp).getTime();
    return quietForMs < quietPeriodMs;
}
