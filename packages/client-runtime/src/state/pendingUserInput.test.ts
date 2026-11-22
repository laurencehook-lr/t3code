import { describe, expect, it } from "vite-plus/test";

import {
  buildPendingUserInputAnswers,
  isPendingUserInputOptionSelected,
  resolvePendingUserInputAnswer,
  setPendingUserInputCustomAnswer,
  setPendingUserInputNote,
  togglePendingUserInputOptionSelection,
} from "./pendingUserInput.ts";

const singleSelectQuestion = {
  id: "scope",
  header: "Scope",
  question: "What should the plan target first?",
  options: [
    { label: "Orchestration-first", description: "Focus on orchestration first" },
    { label: "Node.js", description: "Reuse TypeScript" },
  ],
  multiSelect: false,
} as const;

const nativeChoiceQuestion = {
  id: "result",
  header: "Result",
  question: "Which result should be used?",
  options: [
    { value: " first\t", label: "Result", description: "First result" },
    { value: "second", label: "Result", description: "Second result" },
  ],
  allowCustomAnswer: false,
  multiSelect: false,
} as const;

describe("resolvePendingUserInputAnswer", () => {
  it("preserves exact editor text, including a deliberately cleared answer", () => {
    const question = { ...singleSelectQuestion, initialAnswer: "  Proposed message\n" };
    expect(resolvePendingUserInputAnswer(question, { customAnswer: question.initialAnswer })).toBe(
      question.initialAnswer,
    );
    expect(resolvePendingUserInputAnswer(question, { customAnswer: "  Edited message\n\n" })).toBe(
      "  Edited message\n\n",
    );
    expect(resolvePendingUserInputAnswer(question, { customAnswer: "" })).toBe("");
    expect(resolvePendingUserInputAnswer(question, { customAnswer: " \n" })).toBe(" \n");
    expect(
      setPendingUserInputCustomAnswer(
        question,
        { selectedOptionValues: ["Orchestration-first"] },
        "",
      ),
    ).toEqual({ customAnswer: "" });
  });

  it("prefers a custom answer over selected options", () => {
    expect(
      resolvePendingUserInputAnswer(singleSelectQuestion, {
        selectedOptionValues: ["Orchestration-first"],
        customAnswer: "Keep the existing envelope for one release",
      }),
    ).toBe("Keep the existing envelope for one release");
  });

  it("does not replace a required choice with a custom answer", () => {
    expect(
      resolvePendingUserInputAnswer(nativeChoiceQuestion, {
        selectedOptionValues: ["second"],
        customAnswer: "Use another result",
      }),
    ).toBe("second");
  });

  it("does not submit labels or unknown values when an option has a value", () => {
    expect(
      resolvePendingUserInputAnswer(nativeChoiceQuestion, {
        selectedOptionValues: ["Result", "unknown"],
      }),
    ).toBeNull();
  });

  it("matches a label only for an option without a value", () => {
    expect(
      resolvePendingUserInputAnswer(singleSelectQuestion, { selectedOptionValues: [" Node.js "] }),
    ).toBe("Node.js");
  });

  it("lets an optional text question stay blank", () => {
    const textQuestion = { id: "notes", options: [] };
    expect(resolvePendingUserInputAnswer({ ...textQuestion, required: false }, undefined)).toBe("");
    expect(
      resolvePendingUserInputAnswer({ ...textQuestion, required: false }, { customAnswer: " " }),
    ).toBe("");
    expect(resolvePendingUserInputAnswer(textQuestion, { customAnswer: " " })).toBeNull();
    expect(
      resolvePendingUserInputAnswer({ ...textQuestion, required: true }, { customAnswer: "" }),
    ).toBeNull();
  });

  it("accepts ready attachment-only answers while preserving selected options", () => {
    expect(resolvePendingUserInputAnswer(singleSelectQuestion, { attachmentCount: 1 })).toBe("");
    expect(
      resolvePendingUserInputAnswer(singleSelectQuestion, {
        attachmentCount: 1,
        selectedOptionValues: ["Node.js"],
      }),
    ).toBe("Node.js");
    expect(
      resolvePendingUserInputAnswer(singleSelectQuestion, {
        attachmentCount: 1,
        attachmentsBlocked: true,
      }),
    ).toBeNull();
    expect(
      resolvePendingUserInputAnswer(
        { ...singleSelectQuestion, allowCustomAnswer: false },
        { attachmentCount: 1 },
      ),
    ).toBeNull();
  });
});

describe("togglePendingUserInputOptionSelection", () => {
  it("selects and removes options with the same label independently", () => {
    const question = { ...nativeChoiceQuestion, multiSelect: true };
    const firstSelected = togglePendingUserInputOptionSelection(question, undefined, " first\t");
    const bothSelected = togglePendingUserInputOptionSelection(question, firstSelected, "second");

    expect(buildPendingUserInputAnswers([question], { result: bothSelected })).toEqual({
      result: [" first\t", "second"],
    });

    const secondSelected = togglePendingUserInputOptionSelection(
      question,
      bothSelected,
      " first\t",
    );
    expect(buildPendingUserInputAnswers([question], { result: secondSelected })).toEqual({
      result: ["second"],
    });
  });

  it("submits raw option values and leaves the draft alone for an unknown option", () => {
    const first = togglePendingUserInputOptionSelection(
      nativeChoiceQuestion,
      undefined,
      " first\t",
    );
    expect(isPendingUserInputOptionSelected(nativeChoiceQuestion, first, " first\t")).toBe(true);
    expect(isPendingUserInputOptionSelected(nativeChoiceQuestion, first, "second")).toBe(false);
    expect(buildPendingUserInputAnswers([nativeChoiceQuestion], { result: first })).toEqual({
      result: " first\t",
    });
    expect(togglePendingUserInputOptionSelection(nativeChoiceQuestion, first, "Result")).toBe(
      first,
    );
  });
});

describe("setPendingUserInputCustomAnswer", () => {
  it("rejects arbitrary text when the provider only accepts offered options", () => {
    expect(setPendingUserInputCustomAnswer(nativeChoiceQuestion, undefined, "Other")).toEqual({});
    expect(
      buildPendingUserInputAnswers([nativeChoiceQuestion], { result: { customAnswer: "Other" } }),
    ).toBeNull();
    expect(
      buildPendingUserInputAnswers([nativeChoiceQuestion], {
        result: { selectedOptionValues: ["second"], customAnswer: "stale draft" },
      }),
    ).toEqual({ result: "second" });
  });
});

const compatQuestion = {
  id: "compat",
  header: "Compat",
  question: "How strict should compatibility be?",
  options: [{ label: "Keep current envelope", description: "Preserve current wire format" }],
  multiSelect: false,
} as const;

describe("setPendingUserInputNote", () => {
  const multiSelectQuestion = { ...singleSelectQuestion, multiSelect: true };

  it("sends the exact option with the note, and drops a blank note", () => {
    const selected = togglePendingUserInputOptionSelection(
      singleSelectQuestion,
      setPendingUserInputNote(singleSelectQuestion, undefined, "  keep the v1 API  "),
      "Node.js",
    );
    expect(resolvePendingUserInputAnswer(singleSelectQuestion, selected)).toBe(
      "Node.js\n\nNote: keep the v1 API",
    );
    expect(
      resolvePendingUserInputAnswer(
        singleSelectQuestion,
        setPendingUserInputNote(singleSelectQuestion, selected, " \n\t"),
      ),
    ).toBe("Node.js");
  });

  it("appends the note after every selected option of a multi-select", () => {
    const first = togglePendingUserInputOptionSelection(multiSelectQuestion, undefined, "Node.js");
    const noted = setPendingUserInputNote(multiSelectQuestion, first, "only on macOS");
    const both = togglePendingUserInputOptionSelection(
      multiSelectQuestion,
      noted,
      "Orchestration-first",
    );
    expect(buildPendingUserInputAnswers([multiSelectQuestion], { scope: both })).toEqual({
      scope: ["Node.js", "Orchestration-first", "Note: only on macOS"],
    });
  });

  it("leaves a custom answer and an options-only question unchanged", () => {
    const noted = setPendingUserInputNote(singleSelectQuestion, undefined, "ignored");
    expect(
      resolvePendingUserInputAnswer(
        singleSelectQuestion,
        setPendingUserInputCustomAnswer(singleSelectQuestion, noted, "Rust instead"),
      ),
    ).toBe("Rust instead");
    expect(resolvePendingUserInputAnswer(singleSelectQuestion, noted)).toBeNull();
    expect(setPendingUserInputNote(nativeChoiceQuestion, undefined, "caveat")).toEqual({});
    const message = { ...singleSelectQuestion, initialAnswer: "Proposed message" };
    expect(
      resolvePendingUserInputAnswer(message, {
        customAnswer: "Proposed message",
        note: "ignored",
      }),
    ).toBe("Proposed message");
    expect(setPendingUserInputNote(message, undefined, "caveat")).toEqual({});
    expect(
      resolvePendingUserInputAnswer(nativeChoiceQuestion, {
        selectedOptionValues: ["second"],
        note: "stale",
      }),
    ).toBe("second");
  });
});

describe("buildPendingUserInputAnswers", () => {
  it("returns a canonical answer map for complete prompts", () => {
    expect(
      buildPendingUserInputAnswers([singleSelectQuestion, compatQuestion], {
        scope: { selectedOptionValues: ["Orchestration-first"] },
        compat: { customAnswer: "Keep the current envelope for one release window" },
      }),
    ).toEqual({
      scope: "Orchestration-first",
      compat: "Keep the current envelope for one release window",
    });
  });
});

it.each([
  ["single-select", singleSelectQuestion, ["Orchestration-first"], '"Orchestration-first"'],
  [
    "multi-select",
    {
      ...singleSelectQuestion,
      multiSelect: true,
      options: [{ label: "Server" }, { label: "Web" }],
    },
    ["Server", "Web"],
    '["Server","Web"]',
  ],
])("sends a %s answer to a question with the id __proto__", (_kind, question, selected, json) => {
  const answers = buildPendingUserInputAnswers(
    [
      { ...question, id: "__proto__" },
      { ...singleSelectQuestion, id: "name" },
    ],
    {
      ["__proto__"]: { selectedOptionValues: selected },
      name: { selectedOptionValues: ["Orchestration-first"] },
    },
  );

  expect(JSON.stringify(answers)).toBe(`{"__proto__":${json},"name":"Orchestration-first"}`);
});
