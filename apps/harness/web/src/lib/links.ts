const REPOSITORY = "https://github.com/alifconstantine/const";
const RELEASES_REPOSITORY = "https://github.com/alifconstantine/const-harness-release";
export const LINKS = {
  repository: REPOSITORY,
  docs: "/docs",
  releases: `${RELEASES_REPOSITORY}/releases`,
  changelog: `${REPOSITORY}/commits/main/apps/harness`,
  issues: `${REPOSITORY}/issues`,
  pulls: `${REPOSITORY}/pulls`,
  router: "https://router.const.web.id",
  accounts: "https://accounts.const.web.id",
  learn: "https://learn.const.web.id",
} as const;
