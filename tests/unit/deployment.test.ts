import { it, expect } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  copyFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const image = (letter: string) =>
  "ghcr.io/example/app@sha256:" + letter.repeat(64);
function fixture(previous = image("a"), failure = "") {
  const dir = mkdtempSync(join(tmpdir(), "saas-rollout-"));
  copyFileSync("deploy/deploy.sh", join(dir, "deploy.sh"));
  writeFileSync(
    join(dir, ".env"),
    "IMAGE_REPOSITORY=ghcr.io/example/app\nCOMPOSE_PROJECT_NAME=example-prod\n",
  );
  if (previous) writeFileSync(join(dir, ".validated-image"), previous);
  writeFileSync(join(dir, "flock"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(
    join(dir, "docker"),
    '#!/bin/sh\necho "$APP_IMAGE $*" >> "$DEPLOY_TEST_LOG"\ncase "$*" in *"pull app"*) [ "$DEPLOY_FAILURE" != pull ];; *"up -d"*) [ "$DEPLOY_FAILURE" != startup ] || [ "$APP_IMAGE" = "$DEPLOY_TEST_PREVIOUS" ];; *"exec -T"*) [ "$DEPLOY_FAILURE" != health ];; *) exit 0;; esac\n',
    { mode: 0o755 },
  );
  return {
    dir,
    run: (target: string) =>
      spawnSync("bash", [join(dir, "deploy.sh"), target], {
        env: {
          ...process.env,
          PATH: dir + ":" + process.env.PATH,
          DEPLOY_TEST_LOG: join(dir, "calls"),
          DEPLOY_TEST_PREVIOUS: previous,
          DEPLOY_FAILURE: failure,
        },
        encoding: "utf8",
      }),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
    calls: () =>
      existsSync(join(dir, "calls"))
        ? readFileSync(join(dir, "calls"), "utf8")
        : "",
  };
}
it.each(["startup", "health"])(
  "restores previous validated app after %s failure without touching PostgreSQL or volumes",
  (failure) => {
    const f = fixture(image("a"), failure);
    try {
      expect(f.run(image("b")).status).toBe(1);
      expect(f.calls()).toContain(image("a") + " compose");
      expect(f.calls()).toContain("--no-deps --wait");
      expect(f.calls()).not.toMatch(/down|migrate|up .* db/);
      expect(readFileSync(join(f.dir, ".validated-image"), "utf8")).toBe(
        image("a"),
      );
    } finally {
      f.cleanup();
    }
  },
);
it("a failed image pull leaves the app and markers alone", () => {
  const f = fixture(image("a"), "pull");
  try {
    expect(f.run(image("b")).status).not.toBe(0);
    expect(f.calls()).not.toContain("up -d");
    expect(readFileSync(join(f.dir, ".validated-image"), "utf8")).toBe(
      image("a"),
    );
  } finally {
    f.cleanup();
  }
});
it("does not erase rollback history when redeploying the same digest", () => {
  const f = fixture();
  try {
    writeFileSync(join(f.dir, ".previous-image"), image("c"));
    expect(f.run(image("a")).status).toBe(0);
    expect(readFileSync(join(f.dir, ".previous-image"), "utf8")).toBe(
      image("c"),
    );
  } finally {
    f.cleanup();
  }
});
it("rolls back under the same project lock and records the replaced image", () => {
  const f = fixture();
  try {
    writeFileSync(join(f.dir, ".previous-image"), image("c"));
    expect(f.run("--rollback").status).toBe(0);
    expect(readFileSync(join(f.dir, ".validated-image"), "utf8").trim()).toBe(
      image("c"),
    );
    expect(readFileSync(join(f.dir, ".previous-image"), "utf8").trim()).toBe(
      image("a"),
    );
  } finally {
    f.cleanup();
  }
});
it("fails clearly on first-deployment failure without fabricating a rollback", () => {
  const f = fixture("", "startup");
  try {
    const result = f.run(image("b"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no previous");
    expect(existsSync(join(f.dir, ".validated-image"))).toBe(false);
  } finally {
    f.cleanup();
  }
});
it("rejects another product repository before any Docker mutation", () => {
  const f = fixture();
  try {
    expect(
      f.run(image("b").replace("example/app", "example/other")).status,
    ).toBe(1);
    expect(f.calls()).toBe("");
  } finally {
    f.cleanup();
  }
});
it("rejects mutable image tags before touching deployment state", () => {
  const f = fixture();
  try {
    const result = f.run("ghcr.io/example/app:latest");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid image digest");
    expect(f.calls()).toBe("");
  } finally {
    f.cleanup();
  }
});
