import { afterEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import {
  anySendJobActive,
  claimRecipient,
  classifySendFailure,
  finishSendJob,
  isSendJobLive,
  releaseRecipient,
  startSendJob,
  stopSendJob,
} from "./campaignSend";

/**
 * A stand-in for the MySQL connection, holding one campaign_recipients row.
 * Drizzle still builds the real SQL; this applies the part that matters here:
 * an UPDATE only takes effect if its WHERE clause guards on status 'pending'.
 */
function dbWithOneRecipient() {
  const row = { status: "pending", sentAt: null as Date | null };
  const client = {
    query: async (query: { sql: string } | string, params: unknown[] = []) => {
      const text = typeof query === "string" ? query : query.sql;
      const guardsOnPending = /where .*`status` = \?/i.test(text) && params.includes("pending");
      if (guardsOnPending && row.status !== "pending") return [{ affectedRows: 0 }, []];
      row.status = params.includes("sent") ? "sent" : "pending";
      row.sentAt = params.includes("sent") ? new Date() : null;
      return [{ affectedRows: 1 }, []];
    },
  };
  return { db: drizzle(client as never), row };
}

describe("send jobs", () => {
  afterEach(() => stopSendJob(1));

  it("pausing stops the running loop", () => {
    const running = startSendJob(1);
    stopSendJob(1);
    expect(isSendJobLive(running)).toBe(false);
  });

  it("a loop left sleeping by a pause stays dead after the campaign is resumed", () => {
    const sleeping = startSendJob(1);
    stopSendJob(1);
    const resumed = startSendJob(1);
    expect(isSendJobLive(sleeping)).toBe(false);
    expect(isSendJobLive(resumed)).toBe(true);
  });

  it("starting a campaign again replaces the loop already running it", () => {
    const first = startSendJob(1);
    const second = startSendJob(1);
    expect(isSendJobLive(first)).toBe(false);
    expect(isSendJobLive(second)).toBe(true);
  });

  it("an old loop finishing doesn't end the loop that replaced it", () => {
    const first = startSendJob(1);
    const second = startSendJob(1);
    finishSendJob(first);
    expect(isSendJobLive(second)).toBe(true);
    expect(anySendJobActive()).toBe(true);
  });

  it("pausing one campaign leaves another sending", () => {
    const other = startSendJob(2);
    startSendJob(1);
    stopSendJob(1);
    expect(isSendJobLive(other)).toBe(true);
    stopSendJob(2);
  });
});

describe("claimRecipient", () => {
  it("lets only one of two loops have a recipient", async () => {
    const { db } = dbWithOneRecipient();
    expect(await claimRecipient(db as never, 7)).toBe(true);
    expect(await claimRecipient(db as never, 7)).toBe(false);
  });

  it("counts the recipient toward today's limit as soon as it's claimed", async () => {
    const { db, row } = dbWithOneRecipient();
    await claimRecipient(db as never, 7);
    expect(row.status).toBe("sent");
    expect(row.sentAt).toBeInstanceOf(Date);
  });

  it("can be claimed again once released, because the email never left", async () => {
    const { db, row } = dbWithOneRecipient();
    await claimRecipient(db as never, 7);
    await releaseRecipient(db as never, 7);
    expect(row).toEqual({ status: "pending", sentAt: null });
    expect(await claimRecipient(db as never, 7)).toBe(true);
  });
});

describe("classifySendFailure", () => {
  it("stops the campaign when the relay says try later", () => {
    expect(classifySendFailure({ responseCode: 421, command: "DATA" })).toBe("stop");
  });

  it("stops the campaign when the relay rejects over its sending limit", () => {
    expect(classifySendFailure({ responseCode: 550, response: "550 Daily sending quota exceeded" })).toBe("stop");
  });

  it("stops the campaign when it can't connect or log in", () => {
    expect(classifySendFailure({ code: "ECONNECTION", command: "CONN" })).toBe("stop");
    expect(classifySendFailure({ code: "EAUTH", command: "AUTH PLAIN", responseCode: 535 })).toBe("stop");
  });

  it("treats a rejected address as that recipient's failure alone", () => {
    expect(classifySendFailure({ responseCode: 550, command: "RCPT TO", response: "550 No such user" })).toBe("failed");
  });

  it("never retries a timeout after the email was handed over: it may have gone out", () => {
    expect(classifySendFailure({ code: "ETIMEDOUT", command: "DATA" })).toBe("failed");
    expect(classifySendFailure({ code: "ESOCKET", command: "DATA" })).toBe("failed");
  });
});
